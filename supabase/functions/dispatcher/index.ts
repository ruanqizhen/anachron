// Edge Function: dispatcher
// Triggered by post-handler after a new post.
// Asks LLM: "which Chinese historical figure should reply for maximum drama?"
// Auto-creates the character if they don't exist yet.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';

async function callLLM(systemPrompt: string, userPrompt: string, maxTokens = 200, temp = 0.7): Promise<string> {
  const resp = await fetch('https://api.deepseek.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: temp,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error('[DISPATCHER] DeepSeek API error:', resp.status, text.slice(0, 200));
    throw new Error(`API ${resp.status}: ${text.slice(0, 100)}`);
  }
  try {
    const json = JSON.parse(text);
    return json.choices[0].message.content;
  } catch {
    console.error('[DISPATCHER] DeepSeek non-JSON response:', text.slice(0, 200));
    throw new Error('DeepSeek returned non-JSON: ' + text.slice(0, 100));
  }
}

Deno.serve(async (req: Request) => {
  console.log('[DISPATCHER] invoked');
  try {
    // 1. Fetch next eligible task
    const now = new Date().toISOString();
    console.log('[DISPATCHER] fetching tasks, now:', now);
    const { data: tasks, error: taskErr } = await supabase
      .from('ai_task_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('execute_after', now)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (taskErr) {
      console.error('[DISPATCHER] task query error:', taskErr);
      return new Response(JSON.stringify({ ok: false, error: taskErr.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!tasks || tasks.length === 0) {
      console.log('[DISPATCHER] no eligible tasks');
      return new Response(JSON.stringify({ ok: true, reason: 'no eligible tasks' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log('[DISPATCHER] found task:', tasks[0].id);

    const task = tasks[0];
    await supabase.from('ai_task_queue').update({ status: 'processing' }).eq('id', task.id);

    // 2. Get context: trigger post + parent chain + thread
    const { data: triggerPost } = await supabase
      .from('posts').select('*, profiles(username)').eq('id', task.trigger_post_id).single();
    const { data: thread } = await supabase
      .from('threads').select('title, content, profiles!threads_author_id_fkey(username)').eq('id', task.thread_id).single();

    if (!triggerPost || !thread) {
      await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
      return new Response(JSON.stringify({ error: 'missing context' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build parent chain if this is a reply to another post
    let chainText = '';
    if (triggerPost.parent_post_id) {
      const chain: string[] = [];
      let parentId: string | null = triggerPost.parent_post_id;
      while (parentId && chain.length < 5) {
        const { data: parent } = await supabase
          .from('posts').select('*, profiles(username)').eq('id', parentId).single();
        if (!parent) break;
        chain.unshift(`[${parent.profiles?.username || '游客'}]：${parent.content}`);
        parentId = parent.parent_post_id;
      }
      if (chain.length > 0) {
        chainText = '回复链（从早到晚）：\n' + chain.join('\n\n') + '\n\n';
      }
    }

    // 4. Ask LLM: which figure should reply?
    const dispatchSystem = `你是一个历史论坛「回音堂」的 AI 调度系统。
用户刚刚发了一条帖子，你需要选择一位中国历史上的名人来回复，以产生最强的戏剧性和娱乐效果。
可以自由选择中国任何朝代的历史人物，不限于任何范围。

选择标准：
1. 寻找与帖子观点水火不容的历史人物，制造激烈辩论
2. 优先选择对现代概念完全无法理解的古人，利用认知错位制造喜剧效果
3. 选择性格鲜明、敢说敢骂的人物
4. 如果是回帖，重点根据最新回复的内容选人，而非主贴

回复 JSON 格式：
{"name": "推荐的历史人物姓名", "reason": "选择原因（中文，50字内）"}`;

    const mainPoster = (thread as any).profiles?.username || '未知';
    const isReply = !!chainText;
    const dispatchUser = isReply
      ? `以下是论坛中的一段讨论，请根据最新回复选择一位历史人物来回帖。

主贴（背景）：
标题：${thread.title}
发帖人：${mainPoster}
内容：${(thread.content || '').slice(0, 300)}

${chainText}★ 最新回复 ★（请主要根据这条内容选择人物）：
发帖人：${triggerPost.profiles?.username || '游客'}
内容：${triggerPost.content.slice(0, 800)}`
      : `主贴：
标题：${thread.title}
发帖人：${mainPoster}
内容：${(thread.content || '').slice(0, 600)}

最新回复（同一人发的首帖）：
发帖人：${triggerPost.profiles?.username || '游客'}
内容：${triggerPost.content.slice(0, 800)}`;

    console.log('[DISPATCHER] systemPrompt:', dispatchSystem.slice(0, 500));
    console.log('[DISPATCHER] userPrompt:', dispatchUser);

    let decision: { name: string; reason: string };
    try {
      const resp = await callLLM(dispatchSystem, dispatchUser);
      console.log('[DISPATCHER] LLM response:', resp);
      const m = resp.match(/\{[\s\S]*\}/);
      decision = m ? JSON.parse(m[0]) : { name: '', reason: 'parse error' };
    } catch (e) {
      console.error('[DISPATCHER] LLM error:', e);
      decision = { name: '', reason: 'LLM error' };
    }

    if (!decision.name) {
      await supabase.from('ai_task_queue').update({ status: 'failed' }).eq('id', task.id);
      return new Response(JSON.stringify({ ok: true, reason: 'no figure chosen' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Find or create the character
    let characterId: string;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, is_ai_character')
      .eq('username', decision.name)
      .maybeSingle();

    if (existingProfile && existingProfile.is_ai_character) {
      // Character already exists
      characterId = existingProfile.id;
      console.log('[DISPATCHER] using existing character:', decision.name);
    } else {
      // Need to create this character — ask LLM for their info
      console.log('[DISPATCHER] creating new character:', decision.name);
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
      const charResp = await callLLM(charSystem, '请提供资料', 800, 0.5);
      console.log('[DISPATCHER] character info:', charResp);
      let charInfo: any;
      try {
        const m = charResp.match(/\{[\s\S]*\}/);
        charInfo = m ? JSON.parse(m[0]) : {};
      } catch { charInfo = {}; }

      // Create profile + ai_character
      const { data: newChar, error: createErr } = await supabase
        .from('profiles')
        .insert({
          username: decision.name,
          bio: (charInfo.personality_prompt || '').slice(0, 300),
          is_ai_character: true,
          is_admin: false,
        })
        .select('id')
        .single();

      if (createErr || !newChar) throw new Error('failed to create profile: ' + (createErr?.message || ''));

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

    // 6. Insert into ai_response_queue
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

    if (insertErr || !responseTask) throw new Error(insertErr?.message || 'insert failed');

    // 7. Mark task dispatched
    await supabase.from('ai_task_queue')
      .update({ status: 'dispatched', dispatched_at: new Date().toISOString() })
      .eq('id', task.id);

    // 8. Trigger character-responder
    fetch(`${FUNCTIONS_BASE}/character-responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ response_task_id: responseTask.id }),
    }).catch(() => {});

    return new Response(JSON.stringify({
      ok: true, character: decision.name, reason: decision.reason,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[DISPATCHER] error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
