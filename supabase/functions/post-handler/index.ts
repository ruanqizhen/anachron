// Edge Function: post-handler
// Single entry point for all post/thread creation.
// Handles Turnstile verification, IP risk check, and DB insertion.
// PRD §6.2.3, §9.1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface CreateThreadPayload {
  action: 'create_thread';
  board_id: string;
  title: string;
  content: string;
  author_id?: string;
  turnstile_token: string;
}

interface CreatePostPayload {
  action: 'create_post';
  thread_id: string;
  content: string;
  author_id?: string;
  parent_post_id?: string;
  turnstile_token: string;
}

type Payload = CreateThreadPayload | CreatePostPayload;

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

async function isHighRiskIp(ip: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocked_ips')
    .select('risk_score')
    .eq('ip_address', ip)
    .single();
  return data ? data.risk_score >= 10 : false;
}

Deno.serve(async (req: Request) => {
  const clientIp = req.headers.get('CF-Connecting-IP') ??
                   req.headers.get('X-Forwarded-For') ?? 'unknown';

  try {
    const payload: Payload = await req.json();

    // Step 1: Turnstile verification
    if (!payload.turnstile_token) {
      return new Response(JSON.stringify({ error: '缺少人机验证 token' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const turnstileOk = await verifyTurnstile(payload.turnstile_token, clientIp);
    if (!turnstileOk) {
      return new Response(JSON.stringify({ error: '人机验证失败' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: IP risk check
    const highRisk = await isHighRiskIp(clientIp);
    const status = highRisk ? 'pending_review' : 'published';

    // Step 3: Insert into DB (using Service Role, bypassing RLS)
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
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ ok: true, thread: data }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
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
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      // Insert into ai_task_queue for AI response scheduling (M4)
      if (!highRisk) {
        const executeAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from('ai_task_queue').insert({
          trigger_post_id: data.id,
          thread_id: payload.thread_id,
          priority: 'normal',
          execute_after: executeAfter,
        }).catch(() => { /* non-critical, don't fail the request */ });
      }

      return new Response(JSON.stringify({ ok: true, post: data }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
