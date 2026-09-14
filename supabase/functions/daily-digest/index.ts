// Edge Function: daily-digest
// Runs daily at noon. Picks a random thread, selects a historical figure
// who hasn't replied yet, and generates an AI reply.
// Then picks another thread (same picking logic) and posts a second reply
// impersonating a randomly-generated modern netizen.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface Thread {
  id: string;
  title: string | null;
  content: string | null;
  board_id: string;
  author_id: string | null;
  profiles: { username: string } | null;
}

interface Post {
  id: string;
  thread_id: string;
  content: string;
  author_id: string | null;
  parent_post_id: string | null;
  profiles: { username: string } | null;
  guest_sessions: { username: string } | null;
}

interface RepliedPost {
  author_id: string | null;
  profiles: { username: string } | null;
}

interface Profile {
  id: string;
  username: string;
  bio?: string | null;
  is_ai_character?: boolean;
  is_admin?: boolean;
}

interface CharacterInfo {
  era?: string;
  tags?: string[];
  birth_year?: number;
  death_year?: number;
}

interface ModernPersona {
  nickname: string;
  personality: string;
  speaking_style: string;
  attitude: string;
}

interface ModernReplyResult {
  ok: boolean;
  nickname?: string;
  thread?: string | null;
  post_id?: string;
  error?: string;
}

const DAILY_PROVIDER = Deno.env.get('DAILY_MODEL_PROVIDER') || 'meta';
const DAILY_MODEL = Deno.env.get('DAILY_MODEL_NAME') || (DAILY_PROVIDER === 'meta' ? 'muse-spark-1.2-contributor' : '');

const MODERN_BLOCKLIST = new Set([
  '孙中山', '蒋介石', '汪精卫', '毛泽东', '周恩来', '刘少奇', '朱德', '邓小平', '陈独秀', '李大钊',
  '胡适', '鲁迅', '郭沫若', '巴金', '老舍', '钱学森', '钱钟书', '袁隆平', '雷锋', '焦裕禄',
  '蒋经国', '宋庆龄', '宋美龄', '张学良', '张作霖', '袁世凯', '溥仪', '康有为', '梁启超', '蔡元培',
  '闻一多', '徐志摩', '丁玲', '冰心', '茅盾', '丰子恺', '李宗仁', '冯玉祥', '阎锡山', '陈毅', '彭德怀',
]);

function isModernFigure(name: string, era?: string, birthYear?: number): boolean {
  if (MODERN_BLOCKLIST.has(name)) return true;
  if (birthYear != null && birthYear >= 1912) return true;
  if (era && /民国|现代|当代|共和国|新中国|抗战|建国后/.test(era)) return true;
  return false;
}

const DEEPSEEK_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const META_API_KEY = Deno.env.get('META_API_KEY') || '';

async function callLLM(systemPrompt: string, userPrompt: string, model = 'muse-spark-1.2-contributor', temp = 0, jsonMode = false): Promise<string> {
  const adjSystem = jsonMode ? systemPrompt + '\n\n直接输出纯 JSON，不要输出思考过程或任何额外文字。' : systemPrompt;

  // 供应商故障切换链：主供应商 → 备选 → OpenAI（若配置了 key）。
  const primary = DAILY_PROVIDER;
  const chain: Array<{ provider: string; model: string; key: string; baseUrl: string; maxTokens: number }> = [];
  if (primary === 'meta') {
    chain.push({ provider: 'meta', model: DAILY_MODEL || 'muse-spark-1.2-contributor', key: META_API_KEY, baseUrl: 'https://api.meta.ai/v1/chat/completions', maxTokens: 16384 });
    chain.push({ provider: 'deepseek', model, key: DEEPSEEK_KEY, baseUrl: 'https://api.deepseek.com/v1/chat/completions', maxTokens: model.includes('flash') ? 2000 : 8000 });
  } else if (primary === 'deepseek') {
    chain.push({ provider: 'deepseek', model, key: DEEPSEEK_KEY, baseUrl: 'https://api.deepseek.com/v1/chat/completions', maxTokens: model.includes('flash') ? 2000 : 8000 });
    chain.push({ provider: 'meta', model: 'muse-spark-1.2-contributor', key: META_API_KEY, baseUrl: 'https://api.meta.ai/v1/chat/completions', maxTokens: 16384 });
  } else {
    chain.push({ provider: 'openai', model, key: OPENAI_KEY, baseUrl: 'https://api.openai.com/v1/chat/completions', maxTokens: model.includes('flash') ? 2000 : 8000 });
  }
  if (OPENAI_KEY && primary !== 'openai') {
    chain.push({ provider: 'openai', model: model || 'gpt-4o-mini', key: OPENAI_KEY, baseUrl: 'https://api.openai.com/v1/chat/completions', maxTokens: model.includes('flash') ? 2000 : 8000 });
  }

  let lastErr = '';
  for (const { provider, model: resolvedModel, key, baseUrl, maxTokens } of chain) {
    if (!key) { lastErr = `${provider} API key missing`; continue; }
    try {
      const resp = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            { role: 'system', content: adjSystem },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: temp,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`${provider} API ${resp.status}: ${text.slice(0, 160)}`);
      const json = JSON.parse(text);
      const message = json.choices?.[0]?.message;
      const content = message?.content;
      if (!content) {
        throw new Error(`${provider} content is empty or refused. message: ${JSON.stringify(message).slice(0, 120)}`);
      }
      if (provider !== primary) console.log('[DAILY] used fallback provider:', provider);
      return content;
    } catch (e) {
      lastErr = String(e).slice(0, 200);
      console.warn('[DAILY] provider', provider, 'failed:', lastErr);
    }
  }
  throw new Error('all providers failed: ' + lastErr);
}

// ─── Shared thread/trigger picking (used by both ancient & modern replies) ───

async function pickRandomThread(excludeId?: string | null): Promise<Thread | null> {
  const baseCount = supabase
    .from('threads')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'published');
  const { count, error } = await (excludeId ? baseCount.neq('id', excludeId) : baseCount);
  if (error || !count) return null;

  const offset = Math.floor(Math.random() * count);
  const baseData = supabase
    .from('threads')
    .select('id, title, content, board_id, author_id, profiles!threads_author_id_fkey(username)')
    .is('deleted_at', null)
    .eq('status', 'published');
  const { data } = await (excludeId ? baseData.neq('id', excludeId) : baseData)
    .order('id', { ascending: true })
    .range(offset, offset)
    .limit(1);
  if (!data || data.length === 0) return null;
  return data[0] as unknown as Thread;
}

async function getThreadPosts(threadId: string): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(username), guest_sessions(username)')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('created_at', { ascending: true });
  return (data as unknown as Post[] | null) || [];
}

function pickTrigger(thread: Thread, typedPosts: Post[]) {
  // 30% chance to reply to thread itself if there are replies
  const useThread = typedPosts.length === 0 || Math.random() < 0.3;
  const triggerPost = useThread ? null : typedPosts[Math.floor(Math.random() * typedPosts.length)];
  const triggerContent = triggerPost ? triggerPost.content : thread.content;
  const triggerAuthor = triggerPost
    ? (triggerPost.profiles?.username || triggerPost.guest_sessions?.username || '游客')
    : (thread.profiles?.username || '游客');
  return { triggerPost, triggerContent: triggerContent || '', triggerAuthor };
}

async function buildChainText(triggerPost: Post | null): Promise<string> {
  if (!triggerPost) return '';
  const chain: string[] = [];
  let pid: string | null = triggerPost.parent_post_id;
  while (pid && chain.length < 5) {
    const { data: parent } = await supabase
      .from('posts').select('*, profiles(username), guest_sessions(username)')
      .eq('id', pid).single();
    if (!parent) break;
    const p = parent as unknown as Post;
    const name = p.profiles?.username || p.guest_sessions?.username || '游客';
    chain.unshift(`[${name}]：${p.content}`);
    pid = p.parent_post_id;
  }
  return chain.length > 0 ? '回复链（从早到晚）：\n' + chain.join('\n\n') + '\n\n' : '';
}

function buildContextText(typedPosts: Post[], limit = 8): string {
  return typedPosts.slice(-limit)
    .map((p) => {
      const name = p.profiles?.username || p.guest_sessions?.username || '游客';
      return `[${name}]：${p.content || ''}`;
    })
    .join('\n\n');
}

// ─── Modern netizen reply ───

// 注意：人设生成不传入任何帖子内容，保证网名与回帖内容无关。
async function generateModernPersona(excludeNames: string[]): Promise<ModernPersona> {
  const excludeHint = excludeNames.length > 0
    ? `\n网名不得与以下用户名重复或近似：${excludeNames.join('、')}。`
    : '';
  const personaSystem = `你是中文论坛的用户身份生成器。现在创造一个普通的现代中国网友身份，注意：这个身份与任何具体讨论话题无关，不要引用任何历史、时事话题。
要求：
- 网名 2-12 个字符，看上去像真实网友（可混合中文、字母、数字、下划线，例如"夜跑的猫"、"CtrlSavior"、"卖红薯的UI"、"困困"）
- 网名不得使用历史人物姓名、年号，不得化用历史典故
- 性格特点、说话方式、思想态度要随机多样：年龄层、职业、地域、语气、打字习惯每次都要不一样${excludeHint}

回复 JSON 格式：
{"nickname": "网名", "personality": "性格特点（20字内）", "speaking_style": "说话方式（20字内）", "attitude": "思想态度（20字内）"}`;
  const resp = await callLLM(personaSystem, '请随机生成一个普通网友身份。', 'deepseek-v4-flash', 1, true);
  const m = resp.match(/\{[\s\S]*\}/);
  const info = m ? JSON.parse(m[0]) : {};
  const nickname = String(info.nickname || '').trim();
  if (!nickname || nickname.length > 20) throw new Error('invalid nickname generated');
  return {
    nickname,
    personality: String(info.personality || '随和').slice(0, 60),
    speaking_style: String(info.speaking_style || '口语化短句').slice(0, 60),
    attitude: String(info.attitude || '温和中立').slice(0, 60),
  };
}

async function ensureUniqueNickname(nickname: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = attempt === 0 ? nickname : `${nickname}_${Math.floor(100 + Math.random() * 900)}`;
    // 注册用户和游客共用一片用户名前台展示区，两边都要避开
    const [{ data: profile }, { data: guest }] = await Promise.all([
      supabase.from('profiles').select('id').eq('username', candidate).maybeSingle(),
      supabase.from('guest_sessions').select('id').eq('username', candidate).maybeSingle(),
    ]);
    if (!profile && !guest) return candidate;
  }
  return `${nickname}_${Date.now().toString(36)}`;
}

// 第二条回复：用同样的随机选帖逻辑，但必须另选一个不同的帖子，
// 再以随机生成的现代网友身份回帖。返回结果对象，永不抛错。
async function runModernReply(excludeThreadId?: string | null): Promise<ModernReplyResult> {
  try {
    const thread = await pickRandomThread(excludeThreadId ?? null);
    if (!thread) return { ok: false, error: excludeThreadId ? 'no other threads' : 'no threads' };
    console.log('[DAILY-MODERN] selected thread:', thread.title?.slice(0, 50));

    const typedPosts = await getThreadPosts(thread.id);
    const { triggerPost, triggerContent, triggerAuthor } = pickTrigger(thread, typedPosts);
    console.log('[DAILY-MODERN] trigger:', triggerPost ? 'reply' : 'thread', 'by:', triggerAuthor);

    // 本帖已出现的用户名：网名需避开，避免混淆或冒充
    const nameSet = new Set<string>();
    if (thread.profiles?.username) nameSet.add(thread.profiles.username);
    for (const p of typedPosts) {
      const n = p.profiles?.username || p.guest_sessions?.username;
      if (n) nameSet.add(n);
    }

    let persona: ModernPersona;
    try {
      persona = await generateModernPersona([...nameSet].slice(0, 20));
    } catch (e) {
      console.warn('[DAILY-MODERN] persona generation failed, retry once:', e);
      persona = await generateModernPersona([...nameSet].slice(0, 20));
    }
    const nickname = await ensureUniqueNickname(persona.nickname);
    console.log('[DAILY-MODERN] persona:', nickname, persona.personality);

    // 创建为匿名游客身份：不注册账号，前台显示为普通游客，无任何徽标
    const { data: guest, error: guestErr } = await supabase.from('guest_sessions').insert({
      username: nickname,
      session_token: `daily-modern-${crypto.randomUUID()}`,
      ip_address: '0.0.0.0',
    }).select('*').single();
    if (guestErr || !guest) throw new Error('failed to create guest session: ' + (guestErr?.message || ''));

    const contextText = buildContextText(typedPosts);
    const chainText = await buildChainText(triggerPost);
    const replyLabel = triggerPost ? '最新一条需要你回应的帖子' : '主贴（请对整篇帖子发表看法）';
    const systemPrompt = `# 身份
你是一位普通的现代中国网友「${nickname}」。${persona.personality}。说话方式：${persona.speaking_style}。思想态度：${persona.attitude}。

# 行为准则
- 以第一人称、用自然的现代口语回帖，就像深夜刷论坛随手留的评论
- 针对帖子内容发表真实看法：可以赞同、抬杠、开玩笑、分享亲身经历，但不要复述别人的原话
- 篇幅 50～300 字，不要写小作文，不要分点论述
- 可以有个别语气词，最多用一个表情符号，也可以一个都不用
- 绝对不要透露你是 AI，不要提到"人设""指令""系统"这些词
- 直接输出回帖正文，不要署名，不要加括号旁白`;
    const userPrompt = `以下是论坛中关于「${thread.title || '讨论'}」的讨论。

对话记录：
${contextText}

${chainText}${replyLabel}：
[${triggerAuthor}]：${triggerContent.slice(0, 800)}

请按你的人设回帖。`;

    const reply = (await callLLM(systemPrompt, userPrompt, 'muse-spark-1.2-contributor', 0.9)).trim();
    if (!reply) throw new Error('Empty response');

    const { data: replyData, error: replyErr } = await supabase
      .from('posts')
      .insert({
        thread_id: thread.id,
        author_id: null,
        guest_id: guest.id,
        content: reply,
        is_ai_post: true,
        status: 'published',
        parent_post_id: triggerPost?.id || null,
      })
      .select()
      .single();

    if (replyErr) throw new Error(replyErr.message);
    console.log('[DAILY-MODERN] reply posted:', replyData.id, 'by:', nickname);
    return { ok: true, nickname, thread: thread.title, post_id: replyData.id };
  } catch (e) {
    console.error('[DAILY-MODERN] error:', e);
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

// 古人主流程提前结束的良性分支也补一条现代网友回复，保持"每次调用两条"的语义。
// 此时古人帖子已经选定，现代网友必须另选一个不同的帖子。
async function withModern(reason: string, excludeThreadId?: string | null) {
  const modern = await runModernReply(excludeThreadId ?? null).catch((e): ModernReplyResult => ({ ok: false, error: String(e).slice(0, 200) }));
  return new Response(JSON.stringify({ ok: true, reason, modern_netizen: modern }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async () => {
  console.log('[DAILY] started');
  try {
    // 1. Pick a random published thread
    // 带重试：PostgREST 偶发超时/空错误绝不能误判为"论坛没有帖子"。
    let threadCount: number | null = null;
    let countErr: { message?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { count, error } = await supabase
        .from('threads')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'published');
      threadCount = count;
      countErr = error;
      if (!error && count) break;
      console.warn('[DAILY] thread count attempt', attempt + 1, 'failed:',
        error ? JSON.stringify(error).slice(0, 300) : `count=${count}`);
      if (attempt < 2) await sleep(2000 * (attempt + 1));
    }

    if (countErr || !threadCount) {
      const detail = countErr ? JSON.stringify(countErr).slice(0, 300) : `count=${threadCount}`;
      console.error('[DAILY] thread count failed after retries:', detail);
      // 数据库持续报错 → 500，不要伪装成"没有帖子"让定时任务静默成功
      if (countErr) {
        return new Response(JSON.stringify({ ok: false, error: 'thread count failed', detail }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
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
      .order('id', { ascending: true })
      .range(randomOffset, randomOffset)
      .limit(1);

    if (!threads || threads.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: 'no thread at offset' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    const thread = threads[0] as unknown as Thread;
    console.log('[DAILY] selected thread:', thread.title?.slice(0, 50));

    // 2. Get all posts in this thread
    const { data: posts } = await supabase
      .from('posts')
      .select('*, profiles(username), guest_sessions(username)')
      .eq('thread_id', thread.id)
      .is('deleted_at', null)
      .eq('status', 'published')
      .order('created_at', { ascending: true });

    const typedPosts = posts as unknown as Post[] | null;

    if (!typedPosts || typedPosts.length === 0) {
      // No replies — use the thread itself as trigger
      console.log('[DAILY] no replies, using thread as trigger');
    }

    // Pick a random post to reply to (or the thread itself)
    const allTargets = typedPosts && typedPosts.length > 0 ? [...typedPosts] : [];
    // 30% chance to reply to thread itself if there are replies
    const useThread = allTargets.length === 0 || Math.random() < 0.3;
    const triggerPost = useThread ? null : allTargets[Math.floor(Math.random() * allTargets.length)];
    const triggerContent = triggerPost ? triggerPost.content : thread.content;
    const triggerAuthor = triggerPost
      ? (triggerPost.profiles?.username || triggerPost.guest_sessions?.username || '游客')
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
      for (const p of repliedPosts as unknown as RepliedPost[]) {
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
        const parentPost = parent as unknown as Post;
        const name = parentPost.profiles?.username || parentPost.guest_sessions?.username || '游客';
        chain.unshift(`[${name}]：${parentPost.content}`);
        pid = parentPost.parent_post_id;
      }
      if (chain.length > 0) chainText = '回复链（从早到晚）：\n' + chain.join('\n\n') + '\n\n';
    }

    // 5. Get recent posts for context
    const recentPosts = (typedPosts || []).slice(-8);
    const contextText = recentPosts
      .map((p) => {
        const name = p.profiles?.username || p.guest_sessions?.username || '游客';
        return `[${name}]：${p.content || ''}`;
      })
      .join('\n\n');

    // 6. Select character
    const excludeHint = repliedNames.size > 0
      ? `\n注意：以下人物已经在此帖中出现过，请勿选择：${[...repliedNames].join('、')}。`
      : '';

    const dispatchSystem = `你是一个历史论坛「回音堂」的 AI 调度系统。需要选择一位中国历史上的名人来回复一条帖子。

可选范围：仅限清朝及之前（1912年之前）的中国历史人物，严禁选择民国及之后（1912年及以后）的人物。民国、抗战、新中国、当代等时期人物一律不可选，例如孙中山、蒋介石、汪精卫、毛泽东、周恩来、邓小平、鲁迅、胡适、郭沫若、钱学森等。若人物主要活动/去世时间在1912年之后则不可选；清朝人物如康熙、雍正、乾隆、和珅等均在可选范围内。

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

${chainText}★ 需要回应的内容 ★：
发帖人：${triggerAuthor}
内容：${triggerContent.slice(0, 800)}`;

    let decision: { name: string; reason: string };
    try {
      const resp = await callLLM(dispatchSystem, dispatchUser, 'muse-spark-1.2-contributor', 0, true);
      const m = resp.match(/\{[\s\S]*\}/);
      decision = m ? JSON.parse(m[0]) : { name: '', reason: 'parse error' };
    } catch (e) {
      console.error('[DAILY] LLM error:', e);
      return new Response(JSON.stringify({ ok: false, error: 'LLM error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!decision.name || repliedNames.has(decision.name)) {
      console.log('[DAILY] no suitable character or already replied:', decision.name);
      return withModern('no suitable character', thread.id);
    }
    if (isModernFigure(decision.name)) {
      console.log('[DAILY] rejected modern figure:', decision.name);
      return withModern(`modern figure rejected: ${decision.name}`, thread.id);
    }
    console.log('[DAILY] chosen character:', decision.name, decision.reason);

    // 7. Find or create the character
    let characterId: string;
    let characterProfile: Profile;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', decision.name)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.is_ai_character) {
        characterId = existingProfile.id;
        characterProfile = existingProfile as unknown as Profile;
        console.log('[DAILY] character exists:', decision.name);
      } else {
        console.log('[DAILY] character name collision with human user:', decision.name);
        return withModern(`Name collision with human user: ${decision.name}`, thread.id);
      }
    } else {
      // Auto-create the character
      console.log('[DAILY] creating new character:', decision.name);
      const charSystem = `请提供关于中国历史名人「${decision.name}」的详细资料，用于创建 AI 角色。
返回 JSON 格式：
{"era":"所属时代","tags":["标签1","标签2","标签3"],"birth_year":生年数字,"death_year":卒年数字}`;
      const charResp = await callLLM(charSystem, '请提供资料', 'muse-spark-1.2-contributor', 0, true);
      let charInfo: CharacterInfo = {};
      try { const m = charResp.match(/\{[\s\S]*\}/); charInfo = m ? JSON.parse(m[0]) : {}; } catch { charInfo = {}; }

      if (isModernFigure(decision.name, charInfo.era, charInfo.birth_year)) {
        console.log('[DAILY] rejected modern era/birth for:', decision.name, charInfo.era, charInfo.birth_year);
        return withModern(`modern era rejected: ${decision.name} ${charInfo.era}`, thread.id);
      }

      const { data: newChar, error: createErr } = await supabase.from('profiles').insert({
        username: decision.name,
        bio: '',
        is_ai_character: true, is_admin: false,
      }).select('*').single();
      if (createErr || !newChar) throw new Error('failed to create profile: ' + (createErr?.message || ''));

      await supabase.from('ai_characters').insert({
        id: newChar.id, era: charInfo.era || '未知', tags: charInfo.tags || [],
        birth_year: charInfo.birth_year || null, death_year: charInfo.death_year || null,
        is_active: true,
      });
      characterId = newChar.id;
      characterProfile = newChar as unknown as Profile;
    }

    // 8. Get full character config
    const { data: fullChar } = await supabase.from('ai_characters').select('*').eq('id', characterId).single();
    if (!fullChar) throw new Error('character config not found');

    // 9. Build reply prompt
    const systemPrompt = `# 角色设定
你正在扮演 ${characterProfile.username}（${fullChar.birth_year || '?'} — ${fullChar.death_year || '?'}），${fullChar.era || '未知'}。

# 行为准则
- 始终以第一人称、以你的真实历史性格发言，不要试图理解现代观点
- 观点和语言都要符合你的时代和身份背景
- 要使用历史上的真实案例来论证自己的观点，不要只表达态度和情绪
- 直接输出你要说的文字，不要加入旁白、表情、动作描写（如"捻须""悲伤"等），只写回复内容本身
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
      reply = await callLLM(systemPrompt, userPrompt, 'muse-spark-1.2-contributor', 0.9);
      reply = reply.trim();
      if (!reply) throw new Error('Empty response');
    } catch (llmErr) {
      console.error('[DAILY] reply generation error:', llmErr);
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

    // 第二条回复：现代网友（与古人回复相互独立，失败不影响主流程）
    let modern: ModernReplyResult = { ok: false, error: 'skipped' };
    try {
      modern = await runModernReply(thread.id);
    } catch (e) {
      console.error('[DAILY-MODERN] unexpected error:', e);
      modern = { ok: false, error: String(e).slice(0, 200) };
    }

    return new Response(JSON.stringify({
      ok: true, character: decision.name, reason: decision.reason,
      thread: thread.title, post_id: replyData.id,
      modern_netizen: modern,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[DAILY] error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
