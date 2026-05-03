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

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: CORS_HEADERS });
}

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS_HEADERS });
}

// ─── Turnstile ───
async function verifyTurnstile(token: string, clientIp: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY')!);
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

// ─── Content Moderation ───
async function moderateContent(text: string): Promise<{ safe: boolean; reason?: string }> {
  const systemPrompt = `你是内容安全审核系统。检查以下用户内容是否包含违规内容。
违规类型包括：广告/垃圾信息、儿童色情、种族歧视、暴力仇恨、严重人身攻击、色情内容。
只回复 JSON：{"safe": true} 或 {"safe": false, "reason": "违规原因（中文，20字以内）"}`;

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
          max_tokens: 100,
          temperature: 0,
        }),
      });
      const json = await resp.json();
      const result = JSON.parse(json.choices[0].message.content);
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
          max_tokens: 100,
          system: systemPrompt,
          messages: [{ role: 'user', content: text.slice(0, 2000) }],
        }),
      });
      const json = await resp.json();
      const result = JSON.parse(json.content[0].text);
      return result;
    }

    // Unknown provider → skip moderation
    return { safe: true };
  } catch {
    // Moderation API failure → degrade to pending_review (safe default)
    return { safe: false, reason: '审核服务暂时不可用' };
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
      parent_post_id?: string;
      turnstile_token: string;
    } = await req.json();

    // Step 1: Turnstile
    if (!payload.turnstile_token) return err('缺少人机验证 token', 400);
    const turnstileOk = await verifyTurnstile(payload.turnstile_token, clientIp);
    if (!turnstileOk) return err('人机验证失败', 403);

    // Step 2: IP risk check. High-risk IPs skip moderation → straight to pending_review.
    const highRisk = await isHighRiskIp(clientIp);

    // Step 3: AI content moderation (only for clean IPs)
    let status = 'published';
    const textToCheck = [payload.title, payload.content].filter(Boolean).join(' ');
    if (!highRisk) {
      const result = await moderateContent(textToCheck);
      if (!result.safe) {
        status = 'pending_review';
        await markIpHighRisk(clientIp, result.reason || 'content flagged');
      }
    } else {
      status = 'pending_review';
    }

    // Step 4: Insert into DB
    if (payload.action === 'create_thread') {
      const { data, error } = await supabase
        .from('threads')
        .insert({
          board_id: payload.board_id,
          title: payload.title,
          content: payload.content,
          author_id: payload.author_id || null,
          status,
        })
        .select('*').single();
      if (error) throw new Error(error.message);
      return ok({ ok: true, thread: data, status });
    }

    if (payload.action === 'create_post') {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          thread_id: payload.thread_id,
          content: payload.content,
          author_id: payload.author_id || null,
          parent_post_id: payload.parent_post_id || null,
          status,
        })
        .select('*').single();
      if (error) throw new Error(error.message);

      if (!highRisk && status === 'published') {
        const executeAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from('ai_task_queue').insert({
          trigger_post_id: data.id,
          thread_id: payload.thread_id,
          priority: 'normal',
          execute_after: executeAfter,
        }).catch(() => {});
      }

      return ok({ ok: true, post: data, status });
    }

    return err('unknown action', 400);
  } catch (e) {
    return err(String(e), 500);
  }
});
