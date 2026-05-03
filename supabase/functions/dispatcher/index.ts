// Edge Function: dispatcher
// Triggered by post-handler after a new post is inserted.
// Decides which AI character should respond for maximum dramatic effect.
// PRD §7.2 (Phase 2), §7.3

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const DISPATCHER_PROVIDER = Deno.env.get('DISPATCHER_MODEL_PROVIDER') || 'deepseek';
const DISPATCHER_MODEL = Deno.env.get('DISPATCHER_MODEL_NAME') || 'deepseek-v4-flash';
const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = DISPATCHER_PROVIDER;
  const model = DISPATCHER_MODEL;
  const isDeepSeek = provider === 'deepseek';

  const baseUrl = isDeepSeek
    ? 'https://api.deepseek.com/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const apiKey = isDeepSeek ? DEEPSEEK_KEY : OPENAI_KEY;

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });
  const json = await resp.json();
  return json.choices[0].message.content;
}

function getCooldownUntil(): string {
  return new Date(Date.now() - 10 * 60 * 1000).toISOString();
}

type Decision = { character_id: string | null; reason: string };

Deno.serve(async (req: Request) => {
  try {
    // 1. Fetch next eligible task
    const now = new Date().toISOString();
    const { data: tasks, error: taskErr } = await supabase
      .from('ai_task_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('execute_after', now)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (taskErr || !tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: 'no eligible tasks' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const task = tasks[0];

    // Mark as processing
    await supabase.from('ai_task_queue')
      .update({ status: 'processing' })
      .eq('id', task.id);

    // 2. Cooldown check: has an AI posted in this thread in the last 10 minutes?
    const { data: lastAiPost } = await supabase
      .from('posts')
      .select('created_at')
      .eq('thread_id', task.thread_id)
      .eq('is_ai_post', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastAiPost) {
      const secondsSince = (Date.now() - new Date(lastAiPost.created_at).getTime()) / 1000;
      if (secondsSince < 600) {
        // Re-queue with updated execute_after
        const newExecuteAfter = new Date(new Date(lastAiPost.created_at).getTime() + 600 * 1000).toISOString();
        await supabase.from('ai_task_queue')
          .update({ status: 'pending', execute_after: newExecuteAfter })
          .eq('id', task.id);
        return new Response(JSON.stringify({ ok: true, reason: 'cooldown active, requeued' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Get context
    const [{ data: triggerPost }, { data: thread }, { data: recentPosts }] = await Promise.all([
      supabase.from('posts').select('*, profiles(*)').eq('id', task.trigger_post_id).single(),
      supabase.from('threads').select('*, boards(*)').eq('id', task.thread_id).single(),
      supabase.from('posts').select('*, profiles(*)')
        .eq('thread_id', task.thread_id)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('created_at', { ascending: true })
        .limit(10),
    ]);

    if (!triggerPost || !thread) {
      await supabase.from('ai_task_queue')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', task.id);
      return new Response(JSON.stringify({ error: 'missing post or thread' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Get active AI characters
    const { data: characters } = await supabase
      .from('ai_characters')
      .select('*, profiles(*)')
      .eq('is_active', true);

    if (!characters || characters.length === 0) {
      await supabase.from('ai_task_queue')
        .update({ status: 'dispatched_null', processed_at: new Date().toISOString() })
        .eq('id', task.id);
      return new Response(JSON.stringify({ ok: true, reason: 'no active characters' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Existing AI characters in this thread
    const existingAiIds = new Set(
      (recentPosts || [])
        .filter((p: any) => p.is_ai_post)
        .map((p: any) => p.author_id)
    );

    // 5. Build dispatcher prompt
    const charactersJson = JSON.stringify(
      characters.map((c: any) => ({
        id: c.id,
        name: c.profiles?.username,
        era: c.era,
        tags: c.tags,
        preferred_topics: c.preferred_topics,
        rival_character_ids: c.rival_character_ids,
        already_posted: existingAiIds.has(c.id),
      }))
    );

    const systemPrompt = `你是一个历史论坛「回音堂」的 AI 调度系统。
你的任务是根据用户帖子，从可用历史人物中选择一位参与回应。

选择标准（按优先级）：
1. 若帖子通过 @提及指定了某位历史人物，优先选择该人物。
2. 【最高优先级：寻找宿敌】若帖子观点与某位历史人物的立场水火不容，优先选择该人物。目的是制造激烈辩论。
3. 【现代话题优先派古人】若帖子涉及现代概念（民主、互联网、股票、进化论、女权、AI等），优先选择对这些概念绝对无法理解的古代人物，利用认知错位制造喜剧效果。
4. 若某角色的宿敌已在本Thread中发过言，可优先选择该角色，制造角色间的直接冲突。
5. 若帖子是纯粹闲聊或无意内容，可返回 null。

可用历史人物：
${charactersJson}

当前版块：${thread.boards?.name || '未知'}
已在本Thread发言的AI角色ID：${[...existingAiIds].join(', ') || '无'}

返回JSON：{"character_id": "uuid或null", "reason": "选择原因（中文，50字以内）"}`;

    const userPrompt = `最新帖子 [${triggerPost.profiles?.username || '游客'}]：${triggerPost.content.slice(0, 500)}`;

    // 6. Call dispatcher LLM
    let decision: Decision;
    try {
      const response = await callLLM(systemPrompt, userPrompt);
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      decision = jsonMatch ? JSON.parse(jsonMatch[0]) : { character_id: null, reason: 'parse error' };
    } catch {
      decision = { character_id: null, reason: 'dispatcher LLM error' };
    }

    // Log the decision
    await supabase.from('ai_dispatch_log').insert({
      task_id: task.id,
      trigger_post_id: task.trigger_post_id,
      thread_id: task.thread_id,
      dispatched: !!decision.character_id,
      character_id: decision.character_id || undefined,
      reason: decision.reason,
      cooldown_blocked: false,
    });

    // 7. No character chosen
    if (!decision.character_id) {
      await supabase.from('ai_task_queue')
        .update({ status: 'dispatched_null', processed_at: new Date().toISOString() })
        .eq('id', task.id);
      return new Response(JSON.stringify({ ok: true, reason: 'dispatched null' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 8. Check daily limit
    const { count } = await supabase
      .from('character_daily_stats')
      .select('*', { count: 'exact', head: true })
      .eq('character_id', decision.character_id)
      .eq('date', new Date().toISOString().slice(0, 10));

    const charConfig = characters.find((c: any) => c.id === decision.character_id);
    if (charConfig && count && count >= (charConfig.daily_reply_limit || 20)) {
      await supabase.from('ai_task_queue')
        .update({ status: 'skipped', processed_at: new Date().toISOString() })
        .eq('id', task.id);
      return new Response(JSON.stringify({ ok: true, reason: 'daily limit reached' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 9. Insert into ai_response_queue
    const { data: responseTask, error: insertErr } = await supabase
      .from('ai_response_queue')
      .insert({
        character_id: decision.character_id,
        trigger_post_id: task.trigger_post_id,
        thread_id: task.thread_id,
        task_id: task.id,
        dispatch_reason: decision.reason,
        status: 'pending',
        execute_after: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr || !responseTask) throw new Error(insertErr?.message || 'insert failed');

    // Mark task as dispatched
    await supabase.from('ai_task_queue')
      .update({ status: 'dispatched', processed_at: new Date().toISOString() })
      .eq('id', task.id);

    // 10. Trigger character-responder asynchronously (fire and forget)
    fetch(`${FUNCTIONS_BASE}/character-responder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ response_task_id: responseTask.id }),
    }).catch(() => { /* fire and forget */ });

    return new Response(JSON.stringify({
      ok: true,
      character_id: decision.character_id,
      reason: decision.reason,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
