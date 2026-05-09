// Edge Function: post-handler
// Handles Turnstile verification, IP risk check, AI content moderation,
// and DB insertion. PRD §6.2.3, §6.3, §9.1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const MODERATION_PROVIDER = Deno.env.get('MODERATION_MODEL_PROVIDER') || 'deepseek';
const MODERATION_MODEL = Deno.env.get('MODERATION_MODEL_NAME') || 'deepseek-v4-flash';
const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Parse @mentions from content
function parseMentions(text: string): string[] {
  const matches = text.match(/@([一-鿿\w]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: CORS_HEADERS });
}

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS_HEADERS });
}

// ─── Turnstile ───
async function verifyTurnstile(token: string, clientIp: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) { console.warn('TURNSTILE_SECRET_KEY not set, skip'); return true; }
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', clientIp);
  const resp = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: formData }
  );
  const { success } = await resp.json();
  return success === true;
}

// ─── IP Risk ───
async function isHighRiskIp(ip: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocked_ips')
    .select('risk_score')
    .eq('ip_address', ip)
    .single();
  return data ? data.risk_score >= 10 : false;
}

async function markIpHighRisk(ip: string, reason: string) {
  await supabase.from('blocked_ips').upsert({
    ip_address: ip,
    risk_score: 10,
    reason,
    created_at: new Date().toISOString(),
  }, { onConflict: 'ip_address' });
}

// ─── Rate Limiting ───
async function checkRateLimit(
  ip: string, isGuest: boolean, isThread: boolean, authorId?: string, guestId?: string
): Promise<boolean> {
  const secondsAgo = isThread
    ? (isGuest ? 5 * 60 : 60)  // thread: guest 5min, user 1min
    : (isGuest ? 60 : 10);      // reply: guest 1min, user 10s
  const since = new Date(Date.now() - secondsAgo * 1000).toISOString();
  const table = isThread ? 'threads' : 'posts';

  let query = supabase.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since);

  // Filter by user or guest to avoid cross-user interference
  if (!isGuest && authorId) {
    query = query.eq('author_id', authorId);
  } else if (guestId) {
    query = query.eq('guest_id', guestId);
  }

  const { count } = await query;
  return (count || 0) === 0;
}

// ─── User Risk ───
async function isHighRiskUser(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', userId)
    .eq('status', 'pending_review')
    .gte('created_at', since);
  return (count || 0) >= 3;
}

async function markUserHighRisk(userId: string, reason: string) {
  await supabase.from('blocked_ips').insert({
    ip_address: `user:${userId}`,
    risk_score: 10,
    reason,
  }).catch(() => {});
}

// ─── Content Moderation ───
async function moderateContent(text: string): Promise<{ safe: boolean; score?: number; reason?: string }> {
  const systemPrompt = `你是内容安全审核系统。评估用户内容的违规风险程度，给出 1-10 的评分。

1-3 分：完全安全，正常的讨论内容
4-6 分：轻微不当，可能有些激烈但尚可接受
7-8 分：明显违规，需要人工复核
9-10 分：严重违规，必须拦截

违规类型参考：广告/垃圾信息、色情内容、暴力威胁、仇恨言论、严重人身攻击。

只回复 JSON：{"score": <1-10的整数>, "reason": "评分原因（中文，20字内）"}`;

  try {
    const provider = MODERATION_PROVIDER;
    const model = MODERATION_MODEL;

    // OpenAI-compatible providers (OpenAI, DeepSeek, etc.)
    if (provider === 'openai' || provider === 'deepseek') {
      const apiKey = Deno.env.get(provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENAI_API_KEY');
      if (!apiKey) return { safe: true };
      const baseUrl = provider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const resp = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text.slice(0, 2000) },
          ],
          max_tokens: 200,
          temperature: 0,
        }),
      });
      const json = await resp.json();
      const result = JSON.parse(json.choices[0].message.content);
      console.log('[MODERATION] score:', result.score, 'reason:', result.reason);
      return result;
    }

    if (provider === 'anthropic') {
      const key = Deno.env.get('ANTHROPIC_API_KEY');
      if (!key) return { safe: true };
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: text.slice(0, 2000) }],
        }),
      });
      const json = await resp.json();
      const result = JSON.parse(json.content[0].text);
      return result;
    }

    // Unknown provider → skip moderation
    return { safe: true, score: 1 };
  } catch {
    // Moderation API failure → pending_review (safe default)
    return { safe: false, score: 10, reason: '审核服务暂时不可用' };
  }
}

// ─── Main ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const clientIp = req.headers.get('CF-Connecting-IP') ??
                   req.headers.get('X-Forwarded-For') ?? 'unknown';

  try {
    const payload: {
      action: 'create_thread' | 'create_post';
      board_id?: string;
      title?: string;
      thread_id?: string;
      content: string;
      author_id?: string;
      guest_id?: string;
      parent_post_id?: string;
      created_at?: string;
      turnstile_token: string;
    } = await req.json();

    // AI character posts skip all checks — just insert directly
    if (payload.author_id) {
      const { data: authorProfile } = await supabase
        .from('profiles').select('is_ai_character').eq('id', payload.author_id).single();
      if (authorProfile?.is_ai_character) {
        if (payload.action === 'create_thread') {
          const { data, error } = await supabase.from('threads').insert({
            board_id: payload.board_id, title: payload.title,
            content: payload.content, author_id: payload.author_id,
            status: 'published', created_at: payload.created_at || undefined,
          }).select('*').single();
          if (error) throw new Error(error.message);
          return ok({ ok: true, thread: data, status: 'published' });
        }
        if (payload.action === 'create_post') {
          const { data, error } = await supabase.from('posts').insert({
            thread_id: payload.thread_id, content: payload.content,
            author_id: payload.author_id, guest_id: payload.guest_id || null,
            parent_post_id: payload.parent_post_id || null,
            status: 'published', is_ai_post: true,
            created_at: payload.created_at || undefined,
          }).select('*').single();
          if (error) throw new Error(error.message);
          return ok({ ok: true, post: data, status: 'published' });
        }
      }
    }

    // Step 1: Turnstile (required for new threads only; replies skip)
    const isThread = payload.action === 'create_thread';
    if (isThread && !payload.turnstile_token) return err('缺少人机验证 token', 400);
    if (payload.turnstile_token) {
      const turnstileOk = await verifyTurnstile(payload.turnstile_token, clientIp);
      if (!turnstileOk) return err('人机验证失败', 403);
    }

    // Step 2: Rate limiting (per user/IP, no cross-interference)
    const isGuest = !payload.author_id;
    const userId = payload.author_id;
    const allowed = await checkRateLimit(clientIp, isGuest, isThread, userId, payload.guest_id);
    if (!allowed) return err('发言过于频繁，请稍后再试', 429);

    // Step 3: Risk check — by IP for guests, by user for logged-in
    const highRiskGuest = isGuest ? await isHighRiskIp(clientIp) : false;
    const highRiskUser = !isGuest && userId ? await isHighRiskUser(userId) : false;
    const highRisk = highRiskGuest || highRiskUser;

    // Step 4: AI content moderation (logged-in users get 1-point leniency)
    let status = 'published';
    const threshold = isGuest ? 8 : 9;
    const textToCheck = [payload.title, payload.content].filter(Boolean).join(' ');
    if (!highRisk) {
      const result = await moderateContent(textToCheck);
      const score = result.score || (result.safe ? 1 : 10);
      if (score >= threshold) {
        status = 'pending_review';
        const riskReason = result.reason || `风险评分 ${score}`;
        if (isGuest) {
          await markIpHighRisk(clientIp, riskReason);
        } else if (userId) {
          await markUserHighRisk(userId, riskReason);
        }
      }
    } else {
      status = 'pending_review';
    }

    // Step 5: Insert into DB
    if (payload.action === 'create_thread') {
      const { data, error } = await supabase
        .from('threads')
        .insert({
          board_id: payload.board_id,
          title: payload.title,
          content: payload.content,
          author_id: payload.author_id || null,
          guest_id: payload.guest_id || null,
          status,
          created_at: payload.created_at || undefined,
        })
        .select('*').single();
      if (error) throw new Error(error.message);

      // Trigger AI dispatcher for the new thread.
      // trigger_post_id is NULL for thread-level tasks (migration 023 made the column nullable).
      if (!highRisk && status === 'published') {
        try {
          const { data: taskData, error: taskInsertErr } = await supabase.from('ai_task_queue').insert({
            thread_id: data.id,
            trigger_post_id: null,  // Intentionally null: this is a thread-level task, not a reply
            priority: 'normal',
            execute_after: new Date().toISOString(),
          }).select('id').single();

          if (taskInsertErr) console.error('[POST-HANDLER] ai_task_queue insert error:', taskInsertErr.message);
          if (taskData) {
            const dUrl = `${FUNCTIONS_BASE}/dispatcher`;
            console.log('[POST-HANDLER] triggering dispatcher for thread:', data.id);
            fetch(dUrl, {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({}),
            }).then(r => console.log('[POST-HANDLER] dispatcher status:', r.status))
              .catch(e => console.error('[POST-HANDLER] dispatcher error:', e));
          }
        } catch (e) { console.error('[POST-HANDLER] ai_task_queue error:', e); }
      }

      return ok({ ok: true, thread: data, status });
    }

    if (payload.action === 'create_post') {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          thread_id: payload.thread_id,
          content: payload.content,
          author_id: payload.author_id || null,
          guest_id: payload.guest_id || null,
          parent_post_id: payload.parent_post_id || null,
          status,
          created_at: payload.created_at || undefined,
        })
        .select('*').single();
      if (error) throw new Error(error.message);

      if (!highRisk && status === 'published') {
        // Parse @mentions for priority and mentioned characters
        const mentions = parseMentions(payload.content);
        const hasMentions = mentions.length > 0;

        const executeAfter = new Date().toISOString();
        try {
          const { data: taskData } = await supabase.from('ai_task_queue').insert({
            trigger_post_id: data.id,
            thread_id: payload.thread_id,
            priority: hasMentions ? 'high' : 'normal',
            mentioned_character_ids: hasMentions ? mentions : [],
            execute_after: executeAfter,
          }).select('id').single();

          // Trigger dispatcher asynchronously
          if (taskData) {
            const dUrl = `${FUNCTIONS_BASE}/dispatcher`;
            console.log('[POST-HANDLER] triggering dispatcher:', dUrl);
            fetch(dUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`,
              },
              body: JSON.stringify({}),
            }).then(r => console.log('[POST-HANDLER] dispatcher status:', r.status))
              .catch(e => console.error('[POST-HANDLER] dispatcher error:', e));
          }
        } catch { /* ai_task_queue insert failed, non-critical */ }
      }

      return ok({ ok: true, post: data, status });
    }

    return err('unknown action', 400);
  } catch (e) {
    console.error('post-handler error:', e);
    return err(String(e), 500);
  }
});
