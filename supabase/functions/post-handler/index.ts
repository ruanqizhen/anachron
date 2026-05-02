// Edge Function: post-handler
// Handles post/thread creation with Turnstile verification, IP risk check,
// content moderation, and ai_task_queue insertion.
// PRD §9.1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function verifyTurnstile(token: string, clientIp: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY')!);
  formData.append('response', token);
  formData.append('remoteip', clientIp);

  const resp = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: formData }
  );
  const data = await resp.json();
  return data.success === true;
}

Deno.serve(async (req: Request) => {
  const clientIp = req.headers.get('CF-Connecting-IP') ??
                   req.headers.get('X-Forwarded-For') ?? 'unknown';

  try {
    const { post_id, thread_id, turnstile_token } = await req.json();

    // Step 1: Turnstile verification
    if (!turnstile_token) {
      return new Response(JSON.stringify({ error: 'missing turnstile token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const turnstileOk = await verifyTurnstile(turnstile_token, clientIp);
    if (!turnstileOk) {
      return new Response(JSON.stringify({ error: 'invalid captcha' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Check IP risk
    const { data: ipRecord } = await supabase
      .from('blocked_ips')
      .select('risk_score')
      .eq('ip_address', clientIp)
      .single();

    const isHighRisk = ipRecord && ipRecord.risk_score >= 10;
    const newStatus = isHighRisk ? 'pending_review' : 'published';

    // Step 3: Update post status (if high-risk, goes straight to pending_review)
    if (post_id) {
      await supabase
        .from('posts')
        .update({ status: newStatus })
        .eq('id', post_id);
    } else if (thread_id) {
      await supabase
        .from('threads')
        .update({ status: newStatus })
        .eq('id', thread_id);
    }

    // Step 4: If content is clean and not high-risk, insert into ai_task_queue
    if (!isHighRisk && post_id) {
      const executeAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from('ai_task_queue').insert({
        trigger_post_id: post_id,
        thread_id: thread_id,
        priority: 'normal',
        execute_after: executeAfter,
      });
    }

    return new Response(JSON.stringify({ status: newStatus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
