// Edge Function: daily-digest
// Runs daily at noon. Picks a random thread, selects a historical figure
// who hasn't replied yet, and generates an AI reply.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const DAILY_PROVIDER = Deno.env.get('DAILY_MODEL_PROVIDER') || 'deepseek';
const DAILY_MODEL = Deno.env.get('DAILY_MODEL_NAME') || (DAILY_PROVIDER === 'meta' ? 'muse-spark-1.1' : '');

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const META_API_KEY = Deno.env.get('META_API_KEY') || '';

async function callLLM(systemPrompt: string, userPrompt: string, model = 'deepseek-v4-flash', temp = 0, jsonMode = false): Promise<string> {
  const adjSystem = jsonMode ? systemPrompt + '\n\n直接输出纯 JSON，不要输出思考过程或任何额外文字。' : systemPrompt;
  
  let baseUrl: string;
  let apiKey: string;
  let resolvedModel: string;

  if (DAILY_PROVIDER === 'meta') {
    baseUrl = 'https://api.meta.ai/v1/chat/completions';
    apiKey = META_API_KEY;
    resolvedModel = DAILY_MODEL || 'muse-spark-1.1';
  } else if (DAILY_PROVIDER === 'deepseek') {
    baseUrl = 'https://api.deepseek.com/v1/chat/completions';
    apiKey = DEEPSEEK_KEY;
    resolvedModel = model;
  } else {
    baseUrl = 'https://api.openai.com/v1/chat/completions';
    apiKey = OPENAI_KEY;
    resolvedModel = model;
  }

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        { role: 'system', content: adjSystem },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: resolvedModel.includes('flash') ? 2000 : 8000,
      temperature: temp,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`API ${resp.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return json.choices[0].message.content;
}

Deno.serve(async () => {
  console.log('[DAILY] started');
  try {
    // 1. Pick a random published thread
    const { count: threadCount, error: countErr } = await supabase
      .from('threads')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', 'published');

    if (countErr || !threadCount) {
      console.log('[DAILY] no threads found, countErr:', countErr?.message);
      return new Response(JSON.stringify({ ok: true, reason: 'no threads' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pick random offset
    const randomOffset = Math.floor(Math.random() * threadCount);
    const { data: threads } = await supabase
      .from('threads')
      .select('id, title, content, board_id, author_id, profiles!threads_author_id_fkey(username)')
      .is('deleted_at', null)
      .eq('status', 'published')
      .range(randomOffset, randomOffset)
      .limit(1);

    if (!threads || threads.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: 'no thread at offset' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    const thread = threads[0] as any;
    console.log('[DAILY] selected thread:', thread.title?.slice(0, 50));

    // 2. Get all posts in this thread
    const { data: posts } = await supabase
      .from('posts')
      .select('*, profiles(username), guest_sessions(username)')
      .eq('thread_id', thread.id)
      .is('deleted_at', null)
      .eq('status', 'published')
      .order('created_at', { ascending: true });

    if (!posts || posts.length === 0) {
      // No replies — use the thread itself as trigger
      console.log('[DAILY] no replies, using thread as trigger');
    }

    // Pick a random post to reply to (or the thread itself)
    const allTargets = posts && posts.length > 0 ? [...posts] : [];
    // 30% chance to reply to thread itself if there are replies
    const useThread = allTargets.length === 0 || Math.random() < 0.3;
    const triggerPost = useThread ? null : allTargets[Math.floor(Math.random() * allTargets.length)];
    const triggerContent = triggerPost ? triggerPost.content : thread.content;
    const triggerAuthor = triggerPost
      ? (triggerPost.profiles?.username || (triggerPost as any).guest_sessions?.username || '游客')
      : (thread.profiles?.username || '游客');
    console.log('[DAILY] trigger:', triggerPost ? 'reply' : 'thread', 'by:', triggerAuthor);

    // 3. Find already-replied characters in this thread
    const { data: repliedPosts } = await supabase
      .from('posts')
      .select('author_id, profiles(username)')
      .eq('thread_id', thread.id)
      .eq('is_ai_post', true)
      .is('deleted_at', null);

    const repliedNames = new Set<string>();
    const repliedIds = new Set<string>();
    if (repliedPosts) {
      for (const p of repliedPosts as any[]) {
        if (p.profiles?.username) repliedNames.add(p.profiles.username);
        if (p.author_id) repliedIds.add(p.author_id);
      }
    }
    // Also exclude the thread author and trigger post author
    if (thread.author_id) repliedIds.add(thread.author_id);
    if (triggerPost?.author_id) repliedIds.add(triggerPost.author_id);
    if (thread.profiles?.username) repliedNames.add(thread.profiles.username);
    if (triggerPost?.profiles?.username) repliedNames.add(triggerPost.profiles.username);

    console.log('[DAILY] already replied:', [...repliedNames].join(', ') || 'none');

    // 4. Build reply chain context
    let chainText = '';
    if (triggerPost) {
      const chain: string[] = [];
      let pid: string | null = triggerPost.parent_post_id;
      while (pid && chain.length < 5) {
        const { data: parent } = await supabase
          .from('posts').select('*, profiles(username), guest_sessions(username)')
          .eq('id', pid).single();
        if (!parent) break;
        const name = (parent as any).profiles?.username || (parent as any).guest_sessions?.username || '游客';
        chain.unshift(`[${name}]：${parent.content}`);
        pid = parent.parent_post_id;
      }
      if (chain.length > 0) chainText = '回复链（从早到晚）：\n' + chain.join('\n\n') + '\n\n';
    }

    // 5. Get recent posts for context
    const recentPosts = (posts || []).slice(-8);
    const contextText = recentPosts
      .map((p: any) => {
        const name = p.profiles?.username || p.guest_sessions?.username || '游客';
        return `[${name}]：${p.content || ''}`;
      })
      .join('\n\n');

    // 6. Select character
    const excludeHint = repliedNames.size > 0
      ? `\n注意：以下人物已经在此帖中出现过，请勿选择：${[...repliedNames].join('、')}。`
      : '';

    const dispatchSystem = `你是一个历史论坛「回音堂」的 AI 调度系统。需要选择一位中国历史上的名人来回复一条帖子。
可以自由选择中国任何朝代的历史人物，不限于任何范围。

选择标准：
1. 寻找与帖子观点高度相关或水火不容的历史人物，制造有趣对话
2. 优先选择知名度高的历史人物
3. 重点根据最新内容选人，而非主贴
${excludeHint}

回复 JSON 格式：
{"name": "推荐的历史人物姓名", "reason": "选择原因（中文，50字内）"}

人名必须是最广为人知的叫法。比如先秦诸子使用尊称：孔子、墨子；明末和清朝皇帝使用年号：崇祯、康熙；其他人使用姓氏+名字：李世民、朱元璋。`;

    const dispatchUser = `主贴标题：${thread.title || ''}
主贴发帖人：${thread.profiles?.username || '游客'}
主贴内容：${(thread.content || '').slice(0, 300)}

最近的讨论：
${contextText.slice(-800)}

★ 需要回应的内容 ★：
发帖人：${triggerAuthor}
内容：${triggerContent.slice(0, 800)}`;

    let decision: { name: string; reason: string };
    try {
      const resp = await callLLM(dispatchSystem, dispatchUser, 'deepseek-v4-flash', 0, true);
      const m = resp.match(/\{[\s\S]*\}/);
      decision = m ? JSON.parse(m[0]) : { name: '', reason: 'parse error' };
    } catch (e) {
      console.error('[DAILY] LLM error:', String(e).slice(0, 100));
      return new Response(JSON.stringify({ ok: false, error: 'LLM error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!decision.name || repliedNames.has(decision.name)) {
      console.log('[DAILY] no suitable character or already replied:', decision.name);
      return new Response(JSON.stringify({ ok: true, reason: 'no suitable character' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log('[DAILY] chosen character:', decision.name, decision.reason);

    // 7. Find or create the character
    let characterId: string;
    let characterProfile: any;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', decision.name)
      .eq('is_ai_character', true)
      .maybeSingle();

    if (existingProfile) {
      characterId = existingProfile.id;
      characterProfile = existingProfile;
      console.log('[DAILY] character exists:', decision.name);
    } else {
      // Auto-create the character
      console.log('[DAILY] creating new character:', decision.name);
      const charSystem = `请提供关于中国历史名人「${decision.name}」的详细资料，用于创建 AI 角色。
返回 JSON 格式：
{"era":"所属时代","tags":["标签1","标签2","标签3"],"birth_year":生年数字,"death_year":卒年数字,"personality_prompt":"人格与性格描述（中文，200字内）","comedy_notes":"喜剧方向描述（中文，200字内）","writing_style":"语言风格描述（中文，100字内）"}`;
      const charResp = await callLLM(charSystem, '请提供资料', 'deepseek-v4-flash', 0, true);
      let charInfo: Record<string, any> = {};
      try { const m = charResp.match(/\{[\s\S]*\}/); charInfo = m ? JSON.parse(m[0]) : {}; } catch { charInfo = {}; }

      const { data: newChar, error: createErr } = await supabase.from('profiles').insert({
        username: decision.name,
        bio: String(charInfo.personality_prompt || '').slice(0, 300),
        is_ai_character: true, is_admin: false,
      }).select('*').single();
      if (createErr || !newChar) throw new Error('failed to create profile: ' + (createErr?.message || ''));

      await supabase.from('ai_characters').insert({
        id: newChar.id, era: charInfo.era || '未知', tags: charInfo.tags || [],
        birth_year: charInfo.birth_year || null, death_year: charInfo.death_year || null,
        personality_prompt: charInfo.personality_prompt || '', comedy_notes: charInfo.comedy_notes || '',
        writing_style: charInfo.writing_style || '', is_active: true,
      });
      characterId = newChar.id;
      characterProfile = newChar;
    }

    // 8. Get full character config
    const { data: fullChar } = await supabase.from('ai_characters').select('*').eq('id', characterId).single();
    if (!fullChar) throw new Error('character config not found');

    // 9. Build reply prompt
    const systemPrompt = `# 角色设定
你正在扮演 ${characterProfile.username}（${fullChar.birth_year || '?'} — ${fullChar.death_year || '?'}），${fullChar.era || '未知'}。

# 人格与性格
${fullChar.personality_prompt || '暂无详细设定'}

# 喜剧方向
${fullChar.comedy_notes || '用古代视角误解现代事物产生幽默'}

# 语言风格
${fullChar.writing_style || '用白话文直率表达'}

# 行为准则
- 始终以第一人称、以你的真实历史性格发言
- 遇到不理解的现代概念时，用你所处时代的已知事物做类比
- 要使用历史上的真实案例来论证自己的观点，不要只表达态度和情绪
- 直接输出你要说的文字，不要加入旁白、表情、动作描写
- 不要输出括号
- 使用白话文回答，可以参杂少量的当时时期的语言习惯
- 回复长度：100～400字之间
- 禁止使用现代网络用语或表情符号
- 回复末尾无需署名`;

    const replyLabel = triggerPost ? '最新一条需要你回应的帖子' : '主贴（请对整篇帖子发表看法）';
    const userPrompt = `以下是论坛中关于「${thread?.title || '讨论'}」的讨论。

对话记录：
${contextText}

${replyLabel}：
[${triggerAuthor}]：${triggerContent}

请以你的真实性格和认知局限，对上述帖子给出回应。`;

    // 10. Generate reply
    console.log('[DAILY] generating reply as:', characterProfile.username);
    let reply: string;
    try {
      reply = await callLLM(systemPrompt, userPrompt, 'deepseek-v4-pro', 0.9);
      reply = reply.trim();
      if (!reply) throw new Error('Empty response');
    } catch (llmErr) {
      console.error('[DAILY] reply generation error:', String(llmErr).slice(0, 200));
      throw llmErr;
    }

    // Insert reply
    const { data: replyData, error: replyErr } = await supabase
      .from('posts')
      .insert({
        thread_id: thread.id,
        author_id: characterId,
        content: reply,
        is_ai_post: true,
        status: 'published',
        parent_post_id: triggerPost?.id || null,
      })
      .select()
      .single();

    if (replyErr) throw new Error(replyErr.message);
    console.log('[DAILY] reply posted:', replyData.id, 'by:', characterProfile.username);

    return new Response(JSON.stringify({
      ok: true, character: decision.name, reason: decision.reason,
      thread: thread.title, post_id: replyData.id,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[DAILY] error:', String(e).slice(0, 300));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
