// Edge Function: dispatcher
// Triggered by post-handler after a new post.
// Asks LLM: "which Chinese historical figure should reply for maximum drama?"
// Auto-creates the character if they don't exist yet.
// Fix for burst starvation (audit item #3): drain loop + stale-task reaper + self-invocation + promise tracking.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const DISPATCHER_PROVIDER = Deno.env.get('DISPATCHER_MODEL_PROVIDER') || 'deepseek';
const DISPATCHER_MODEL = Deno.env.get('DISPATCHER_MODEL_NAME') || (DISPATCHER_PROVIDER === 'meta' ? 'muse-spark-1.2' : 'deepseek-v4-flash');

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const META_API_KEY = Deno.env.get('META_API_KEY') || '';

// Tunables for audit fix: single-drain -> batch drain + reaper.
const MAX_BATCH = 10; // max tasks per invocation to stay within Edge timeout (LLM 2-4s each)
const STALE_PROCESSING_MINUTES = 10;

// Blocklist: 民国及之后人物一律拦截，兜底 prompt 约束
const MODERN_BLOCKLIST = new Set([
  '孙中山','蒋介石','汪精卫','毛泽东','周恩来','刘少奇','朱德','邓小平','陈独秀','李大钊',
  '胡适','鲁迅','郭沫若','巴金','老舍','钱学森','钱钟书','袁隆平','雷锋','焦裕禄',
  '蒋经国','宋庆龄','宋美龄','张学良','张作霖','袁世凯','溥仪','康有为','梁启超','蔡元培',
  '闻一多','徐志摩','丁玲','冰心','茅盾','丰子恺','李宗仁','冯玉祥','阎锡山','陈毅','彭德怀',
]);

function isModernFigure(name: string, era?: string, birthYear?: number, deathYear?: number): boolean {
  if (MODERN_BLOCKLIST.has(name)) return true;
  if (birthYear != null && birthYear >= 1912) return true;
  if (deathYear != null && deathYear > 1912 && birthYear != null && birthYear >= 1880) return true;
  if (era && /民国|现代|当代|共和国|新中国|抗战|建国后/.test(era)) return true;
  return false;
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const adjSystem = systemPrompt + '\n\n直接输出纯 JSON，不要输出思考过程或任何额外文字。';

  let baseUrl: string;
  let apiKey: string;
  if (DISPATCHER_PROVIDER === 'meta') {
    baseUrl = 'https://api.meta.ai/v1/chat/completions';
    apiKey = META_API_KEY;
  } else if (DISPATCHER_PROVIDER === 'deepseek') {
    baseUrl = 'https://api.deepseek.com/v1/chat/completions';
    apiKey = DEEPSEEK_KEY;
  } else {
    baseUrl = 'https://api.openai.com/v1/chat/completions';
    apiKey = OPENAI_KEY;
  }

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DISPATCHER_MODEL,
      messages: [
        { role: 'system', content: adjSystem },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: DISPATCHER_PROVIDER === 'meta' ? 16384 : 4000,
      temperature: 0,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`API ${resp.status}: ${text.slice(0, 100)}`);
  const json = JSON.parse(text);
  const message = json.choices?.[0]?.message;
  const content = message?.content;
  if (!content) {
    console.error('[DISPATCHER] content is null or missing. Message:', JSON.stringify(message));
    throw new Error(`Dispatcher content is empty or refused. message: ${JSON.stringify(message)}`);
  }
  return content;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  // Drain potential body to avoid Deno request errors on early return.
  try { if (req.body) await req.json().catch(() => {}); } catch { /* ignore */ }

  console.log('[DISPATCHER] started');

  // Reaper for stuck 'processing' rows — burst or crash may leave them.
  try {
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60000).toISOString();
    const { data: reaped, error: reapErr } = await supabase
      .from('ai_task_queue')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('execute_after', staleCutoff) // tasks that have been processing since before cutoff
      .select('id');
    if (reapErr) {
      console.warn('[DISPATCHER] reaper error:', reapErr.message);
    } else if (reaped && reaped.length > 0) {
      console.log('[DISPATCHER] reaped', reaped.length, 'stale processing tasks:', reaped.map((r: { id: string }) => r.id).join(','));
    }
  } catch (reapEx) {
    console.warn('[DISPATCHER] reaper exception:', reapEx);
  }

  const results: Array<{ ok: boolean; character?: string; reason?: string; id?: string; error?: string }> = [];
  // Track outstanding responder calls so we can await them before exit.
  const responderPromises: Promise<void>[] = [];

  let round = 0;
  while (round < MAX_BATCH) {
    round++;
    try {
      const now = new Date().toISOString();
      const { data: tasks, error: taskErr } = await supabase
        .from('ai_task_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('execute_after', now)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true }) // oldest first for fairness during burst
        .limit(1);

      if (taskErr) {
        console.error('[DISPATCHER] task fetch error:', taskErr.message);
        results.push({ ok: false, error: taskErr.message });
        break;
      }
      if (!tasks || tasks.length === 0) {
        console.log('[DISPATCHER] no more pending tasks, total processed:', results.length);
        break;
      }
      const task = tasks[0];
      const { data: lockedRows, error: lockErr } = await supabase
        .from('ai_task_queue')
        .update({ status: 'processing' })
        .eq('id', task.id)
        .eq('status', 'pending')
        .select('id');

      if (lockErr) {
        console.warn('[DISPATCHER] lock failed for', task.id, lockErr.message);
        continue;
      }
      if (!lockedRows || lockedRows.length === 0) {
        console.log('[DISPATCHER] lost race for task', task.id, 'skipping');
        continue;
      }

      // Context
      let triggerContent = '';
      let triggerAuthor = '游客';
      let parentPostId: string | null = null;

      interface ThreadContext {
        title: string;
        content: string;
        profiles: { username: string } | null;
      }

      const { data: thread } = await supabase
        .from('threads')
        .select('title, content, profiles(username)')
        .eq('id', task.thread_id)
        .single();
      const threadContext = thread as unknown as ThreadContext | null;

      if (task.trigger_post_id) {
        const { data: triggerPost } = await supabase
          .from('posts')
          .select('*, profiles(username)')
          .eq('id', task.trigger_post_id)
          .single();
        if (triggerPost) {
          triggerContent = triggerPost.content;
          triggerAuthor = triggerPost.profiles?.username || '游客';
          parentPostId = triggerPost.parent_post_id;
        }
      } else {
        triggerContent = threadContext?.content || '';
        triggerAuthor = threadContext?.profiles?.username || '游客';
      }

      if (!thread) {
        await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
        results.push({ ok: false, id: task.id, error: 'missing thread context' });
        continue;
      }

      let chainText = '';
      if (parentPostId) {
        const chain: string[] = [];
        let pid: string | null = parentPostId;
        while (pid && chain.length < 5) {
          const { data: parent } = await supabase
            .from('posts')
            .select('*, profiles(username)')
            .eq('id', pid)
            .single();
          if (!parent) break;
          chain.unshift(`[${parent.profiles?.username || '游客'}]：${parent.content}`);
          pid = parent.parent_post_id;
        }
        if (chain.length > 0) {
          chainText = '回复链（从早到晚）：\n' + chain.join('\n\n') + '\n\n';
        }
      }

      const dispatchSystem = `你是一个历史论坛「回音堂」的 AI 调度 system。
用户刚刚发了一条帖子，你需要选择一位中国历史上的名人来回复，以产生最强的戏剧性和娱乐效果。

可选范围：仅限清朝及之前（1912年之前）的中国历史人物，严禁选择民国及之后（1912年及以后）的人物。民国、抗战、新中国、当代等时期人物一律不可选，例如孙中山、蒋介石、汪精卫、毛泽东、周恩来、邓小平、鲁迅、胡适、郭沫若、钱学森等。若人物主要活动/去世时间在1912年之后则不可选；清朝人物如康熙、雍正、乾隆、和珅等均在可选范围内。

选择标准：
1. 寻找与帖子观点水火不容的历史人物，制造激烈辩论
2. 优先选择与当前讨论内容高度相关的历史人物
3. 优先选择知名度高的历史人物
4. 如果是回帖，重点根据最新回复的内容选人，而非主贴

回复 JSON 格式：
{"name": "推荐的历史人物姓名", "reason": "选择原因（中文，50字内）"}

人名必须是最广为人知的叫法。比如先秦诸子使用尊称：孔子、墨子；明末和清朝皇帝使用年号：崇祯、康熙、雍正；其他人使用姓氏+名字：李世民、朱元璋。`;

      const mainPoster = threadContext?.profiles?.username || '游客';
      const isReply = !!chainText;
      const dispatchUser = isReply
        ? `以下是论坛中的一段讨论，请根据最新回复选择一位历史人物来回帖。

主贴（背景）：
标题：${threadContext?.title || ''}
发帖人：${mainPoster}
内容：${(threadContext?.content || '').slice(0, 300)}

${chainText}★ 最新回复 ★（请主要根据这条内容选择人物）：
发帖人：${triggerAuthor}
内容：${triggerContent.slice(0, 800)}`
        : `主贴：
标题：${threadContext?.title || ''}
发帖人：${mainPoster}
内容：${(threadContext?.content || '').slice(0, 800)}`;

      let decision: { name: string; reason: string };
      try {
        const resp = await callLLM(dispatchSystem, dispatchUser);
        const m = resp.match(/\{[\s\S]*\}/);
        decision = m ? JSON.parse(m[0]) : { name: '', reason: 'parse error' };
      } catch (e) {
        console.error('[DISPATCHER] LLM error:', e);
        // Fail open: mark task failed and move on, don't hang whole batch
        await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
        results.push({ ok: false, id: task.id, error: String(e).slice(0, 200) });
        continue;
      }

      if (!decision.name) {
        await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
        results.push({ ok: false, id: task.id, error: 'no figure chosen' });
        continue;
      }

      if (isModernFigure(decision.name)) {
        console.log('[DISPATCHER] rejected modern figure:', decision.name);
        await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
        results.push({ ok: false, id: task.id, error: `modern figure rejected: ${decision.name}` });
        continue;
      }

      let characterId: string;
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, is_ai_character')
        .eq('username', decision.name)
        .maybeSingle();

      if (existingProfile && existingProfile.is_ai_character) {
        characterId = existingProfile.id;
        console.log('[DISPATCHER] character:', decision.name, '(existing)');
      } else {
        console.log('[DISPATCHER] character:', decision.name, '(new)');
        const charSystem = `请提供关于中国历史名人「${decision.name}」的详细资料，用于创建 AI 角色。

返回 JSON 格式：
{
  "era": "所属时代",
  "tags": ["标签1", "标签2", "标签3"],
  "birth_year": 生年数字,
  "death_year": 卒年数字,
  "personality_prompt": "人格与性格描述（中文，200字内）",
  "comedy_notes": "喜剧方向描述（中文，200字内）",
  "writing_style": "语言风格描述（中文，100字内）"
}`;
        const charResp = await callLLM(charSystem, '请提供资料');
        let charInfo: Record<string, string | number | string[]>;
        try {
          const m = charResp.match(/\{[\s\S]*\}/);
          charInfo = m ? JSON.parse(m[0]) : {};
        } catch { charInfo = {}; }

        // 二次校验：若 LLM 返回的 era/birth 属于民国后，拦截建档
        if (isModernFigure(decision.name, String(charInfo.era || ''), charInfo.birth_year as number | undefined, charInfo.death_year as number | undefined)) {
          console.log('[DISPATCHER] rejected modern era/birth for:', decision.name, charInfo.era, charInfo.birth_year);
          await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
          results.push({ ok: false, id: task.id, error: `modern era rejected: ${decision.name} ${charInfo.era}` });
          continue;
        }

        const { data: newChar, error: createErr } = await supabase
          .from('profiles')
          .insert({
            username: decision.name,
            bio: String(charInfo.personality_prompt || '').slice(0, 300),
            is_ai_character: true,
            is_admin: false,
          })
          .select('id')
          .single();

        if (createErr || !newChar) {
          console.error('[DISPATCHER] failed to create profile for', decision.name, createErr?.message);
          await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
          results.push({ ok: false, id: task.id, error: 'create profile failed' });
          continue;
        }

        await supabase.from('ai_characters').insert({
          id: newChar.id,
          era: charInfo.era || '未知',
          tags: charInfo.tags || [],
          birth_year: charInfo.birth_year || null,
          death_year: charInfo.death_year || null,
          personality_prompt: charInfo.personality_prompt || '',
          comedy_notes: charInfo.comedy_notes || '',
          writing_style: charInfo.writing_style || '',
          is_active: true,
        });

        characterId = newChar.id;
      }

      const { data: responseTask, error: insertErr } = await supabase
        .from('ai_response_queue')
        .insert({
          character_id: characterId,
          thread_id: task.thread_id,
          trigger_post_id: task.trigger_post_id,
          task_id: task.id,
          status: 'pending',
          execute_after: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertErr || !responseTask) {
        console.error('[DISPATCHER] insert ai_response_queue failed:', insertErr?.message);
        await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
        results.push({ ok: false, id: task.id, error: insertErr?.message || 'insert failed' });
        continue;
      }

      await supabase.from('ai_task_queue').update({ status: 'dispatched', dispatched_at: new Date().toISOString() }).eq('id', task.id);

      const crUrl = `${FUNCTIONS_BASE}/character-responder`;
      console.log('[DISPATCHER] triggering character-responder for', decision.name);
      responderPromises.push(
        fetch(crUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ response_task_id: responseTask.id }),
        })
          .then(async (r) => {
            const t = await r.text().catch(() => '');
            if (!r.ok) {
              console.error('[DISPATCHER] character-responder non-2xx:', r.status, t.slice(0, 200));
            } else {
              console.log('[DISPATCHER] character-responder ok for', decision.name);
            }
          })
          .catch((e) => console.error('[DISPATCHER] character-responder fetch error:', e)),
      );

      results.push({ ok: true, character: decision.name, reason: decision.reason, id: task.id });
    } catch (e) {
      console.error('[DISPATCHER] round error:', e);
      const taskId = (e as any)?.taskId as string | undefined;
      if (taskId) {
        await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', taskId).catch(() => {});
      }
      results.push({ ok: false, error: String(e).slice(0, 200) });
    }
  }

  if (responderPromises.length > 0) {
    console.log('[DISPATCHER] awaiting', responderPromises.length, 'responder calls');
    const timeout = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
    await Promise.race([Promise.allSettled(responderPromises), timeout(10000)]);
  }

  // If we hit MAX_BATCH, there may be more pending tasks — re-invoke self to continue draining.
  if (results.length >= MAX_BATCH) {
    const url = `${FUNCTIONS_BASE}/dispatcher`;
    console.log('[DISPATCHER] batch full, re-invoking self');
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({}),
    }).catch((e) => console.error('[DISPATCHER] self-reinvoke error:', e));
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log('[DISPATCHER] done. ok:', okCount, 'total:', results.length);

  return new Response(
    JSON.stringify({
      ok: okCount > 0 || results.length === 0 ? true : false,
      count: results.length,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
