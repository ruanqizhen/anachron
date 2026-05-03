// Cloudflare Pages middleware: overrides restrictive CSP headers that
// conflict with Cloudflare Turnstile's closure-compiled scripts.
// The Turnstile widget internally creates a 'goog#html' Trusted Types
// policy, and uses TrustedHTML/TrustedScript/TrustedScriptURL assignments
// inside its srcdoc iframe — all of which get blocked by Cloudflare's
// automatic and Supabase's runtime-injected CSP headers.
export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);

  // Remove all CSP variants
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');

  // Set minimal CSP that allows Turnstile to function
  headers.set(
    'Content-Security-Policy',
    "trusted-types goog#html ymiGc5 default"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
