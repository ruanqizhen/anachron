// Edge Function: character-responder
// Triggered by dispatcher after selecting a character.
// Generates the AI character's reply and posts it to the thread.
// PRD §7.2 (Phase 3), §7.4

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const CHAT_PROVIDER = Deno.env.get('CHAT_MODEL_PROVIDER') || 'deepseek';
const CHAT_MODEL = Deno.env.get('CHAT_MODEL_NAME') || (CHAT_PROVIDER === 'meta' ? 'muse-spark-1.2' : 'deepseek-v4-pro');

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const META_API_KEY = Deno.env.get('META_API_KEY') || '';

async function callLLM(
  provider: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  // 供应商故障切换链：主供应商 → 备选 → OpenAI（若配置了 key）。
  const primary = provider;
  const chain: Array<{ provider: string; model: string; key: string; baseUrl: string; maxTokens: number }> = [
    primary === 'meta'
      ? { provider: 'meta', model, key: META_API_KEY, baseUrl: 'https://api.meta.ai/v1/chat/completions', maxTokens: 16384 }
      : { provider: 'deepseek', model, key: DEEPSEEK_KEY, baseUrl: 'https://api.deepseek.com/v1/chat/completions', maxTokens: 8000 },
    primary === 'meta'
      ? { provider: 'deepseek', model: 'deepseek-v4-pro', key: DEEPSEEK_KEY, baseUrl: 'https://api.deepseek.com/v1/chat/completions', maxTokens: 8000 }
      : { provider: 'meta', model: 'muse-spark-1.2', key: META_API_KEY, baseUrl: 'https://api.meta.ai/v1/chat/completions', maxTokens: 16384 },
  ];
  if (OPENAI_KEY) {
    chain.push({ provider: 'openai', model: model || 'gpt-4o-mini', key: OPENAI_KEY, baseUrl: 'https://api.openai.com/v1/chat/completions', maxTokens: 8000 });
  }

  let lastErr = '';
  for (const { provider: p, model: m, key, baseUrl, maxTokens } of chain) {
    if (!key) { lastErr = `${p} API key missing`; continue; }
    try {
      const resp = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.9,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(`${p} API ${resp.status}: ${text.slice(0, 160)}`);
      }
      const json = JSON.parse(text);
      const message = json.choices?.[0]?.message;
      const content = message?.content;
      if (!content) {
        throw new Error(`${p} content is empty or refused. message: ${JSON.stringify(message).slice(0, 120)}`);
      }
      if (p !== primary) console.log('[RESPONDER] used fallback provider:', p);
      return content;
    } catch (e) {
      lastErr = String(e).slice(0, 200);
      console.warn(`[RESPONDER] ${p} failed:`, lastErr);
    }
  }
  throw new Error('all providers failed: ' + lastErr);
}

Deno.serve(async (req: Request) => {
  console.log('[RESPONDER] started');
  try {
    const { response_task_id } = await req.json();
    console.log('[RESPONDER] processing task:', response_task_id);

    // 1. Fetch task with character config
    const { data: task, error: taskErr } = await supabase
      .from('ai_response_queue')
      .select('*')
      .eq('id', response_task_id)
      .eq('status', 'pending')
      .single();

    if (taskErr || !task) {
      return new Response(JSON.stringify({ ok: true, reason: 'task not found or already processed' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mark as processing
    await supabase.from('ai_response_queue')
      .update({ status: 'processing' })
      .eq('id', task.id);

    // 2. Get character config
    const { data: character } = await supabase
      .from('ai_characters')
      .select('*, profiles(*)')
      .eq('id', task.character_id)
      .single();

    if (!character) throw new Error('character not found');

    // 4. Get thread context
    const { data: contextPosts } = await supabase
      .from('posts')
      .select('*, profiles(username), guest_sessions(username)')
      .eq('thread_id', task.thread_id)
      .is('deleted_at', null)
      .eq('status', 'published')
      .order('created_at', { ascending: true })
      .limit(10);

    const { data: triggerPost } = await supabase
      .from('posts')
      .select('*, profiles(username), guest_sessions(username)')
      .eq('id', task.trigger_post_id)
      .single();

    const { data: thread } = await supabase
      .from('threads')
      .select('title, content, boards(name)')
      .eq('id', task.thread_id)
      .single();

    // 5. Build prompts
    const profile = character.profiles;

    const sysEra = character.era || '未知时代';
    const sysBirth = character.birth_year != null ? character.birth_year : '?';
    const sysDeath = character.death_year != null ? character.death_year : '?';

    const systemPrompt = `# 角色设定
你正在扮演 ${profile?.username || '未知'}（${sysBirth} — ${sysDeath}），${sysEra}。

# 行为准则

- 始终以第一人称、以你的真实历史性格发言，不要试图理解现代观点
- 观点和语言都要符合你的时代和身份背景
- 要使用历史上的真实案例来论证自己的观点，不要只表达态度和情绪
- 直接输出你要说的文字，不要加入旁白、表情、动作描写（如"捻须""悲伤"等），只写回复内容本身
- 不要输出括号
- 使用白话文回答，可以参杂少量的当时时期的语言习惯，让现代人可以轻松读懂
- 回复长度：100 ～ 400 字之间
- 禁止使用现代网络用语或表情符号
- 回复末尾无需署名`;

    const contextText = (contextPosts || [])
      .map((p: Record<string, unknown>) => {
        const name = (p.profiles as { username?: string })?.username
          || (p.guest_sessions as { username?: string })?.username || '游客';
        return `[${name}]：${p.content || ''}`;
      })
      .join('\n\n');

    interface ThreadDetails {
      title: string;
      boards: { name: string } | null;
      profiles?: { username: string } | null;
    }
    const threadDetails = thread as unknown as ThreadDetails | null;

    // Determine the trigger: can be a reply (triggerPost) or the thread itself
    const triggerAuthor = triggerPost?.profiles?.username
      || (triggerPost?.guest_sessions as { username?: string })?.username
      || threadDetails?.profiles?.username || '游客';
    const triggerContent = triggerPost?.content || (thread as { content?: string } | null)?.content || '';
    const triggerLabel = triggerPost ? '最新一条需要你回应的帖子' : '主贴（请对整篇帖子发表看法）';

    const userPrompt = `以下是论坛中关于「${threadDetails?.title || '讨论'}」的讨论，发生在「${threadDetails?.boards?.name || '未知'}」版块。

对话记录（从早到晚，最多 10 条）：
${contextText}

${triggerLabel}：
[${triggerAuthor}]：${triggerContent}

请以你的真实性格和认知局限，对上述帖子给出回应。
`;

    // 6. Call LLM
    let reply: string;
    try {
      reply = await callLLM(
        CHAT_PROVIDER, CHAT_MODEL, systemPrompt, userPrompt,
      );
      console.log('[RESPONDER] generated reply for:', profile?.username);
      reply = reply.trim();
      if (!reply) throw new Error('Empty response');
    } catch (llmErr) {
      console.error('[RESPONDER] LLM error:', llmErr);
      // Retry logic
      const newRetry = (task.retry_count || 0) + 1;
      if (newRetry < 2) {
        await supabase.from('ai_response_queue')
          .update({ status: 'pending', retry_count: newRetry, error_message: String(llmErr) })
          .eq('id', task.id);
        // Re-trigger after delay
        setTimeout(() => {
          fetch(`${FUNCTIONS_BASE}/character-responder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ response_task_id: task.id }),
          }).catch(() => { });
        }, 30000);
        return new Response(JSON.stringify({ ok: true, reason: 'retrying' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('ai_response_queue')
        .update({ status: 'failed', retry_count: newRetry, error_message: String(llmErr), processed_at: new Date().toISOString() })
        .eq('id', task.id);
      throw llmErr;
    }

    // 7. Insert AI reply as a post — nest under the trigger post
    const { data: newPost, error: postErr } = await supabase
      .from('posts')
      .insert({
        thread_id: task.thread_id,
        author_id: profile?.id,
        content: reply,
        is_ai_post: true,
        status: 'published',
        parent_post_id: task.trigger_post_id || null,
      })
      .select()
      .single();

    if (postErr) throw new Error(postErr.message);
    console.log('[RESPONDER] reply posted:', newPost.id, 'by:', profile?.username);

    // 8. Update stats (use RPC to avoid upsert reset bug)
    const today = new Date().toISOString().slice(0, 10);
    try {
      await supabase.rpc('increment_daily_stats', {
        p_character_id: character.id,
        p_date: today,
      });
    } catch { /* non-critical */ }

    // 9. Mark response task done
    await supabase.from('ai_response_queue')
      .update({ status: 'done', result_post_id: newPost.id, processed_at: new Date().toISOString() })
      .eq('id', task.id);

    return new Response(JSON.stringify({
      ok: true,
      post_id: newPost.id,
      character: profile?.username,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
