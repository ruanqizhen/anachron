class MetaInjector {
  constructor(meta) {
    this.meta = meta;
  }
  element(element) {
    if (this.meta.title) {
      element.append(`<meta property="og:title" content="${this.meta.title} - Anachron">`, { html: true });
    }
    if (this.meta.description) {
      const desc = this.meta.description.replace(/"/g, '&quot;').slice(0, 150);
      element.append(`<meta property="og:description" content="${desc}">`, { html: true });
      element.append(`<meta name="description" content="${desc}">`, { html: true });
    }
    if (this.meta.image) {
      element.append(`<meta property="og:image" content="${this.meta.image}">`, { html: true });
    }
    element.append(`<meta property="og:type" content="website">`, { html: true });
    element.append(`<meta name="twitter:card" content="summary">`, { html: true });
  }
}

class TitleReplacer {
  constructor(title) {
    this.title = title;
  }
  element(element) {
    element.setInnerContent(`${this.title} - Anachron`);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const response = await context.next();
  const headers = new Headers(response.headers);

  // Remove all restrictive CSP variants and set a permissive CSP to allow Turnstile and Supabase connections
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');
  headers.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';");

  let newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  // Only inject if it's an HTML response
  const contentType = headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return newResponse;
  }

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return newResponse;
  }

  let metaData = null;

  try {
    // Match /b/:boardSlug/t/:threadId
    const threadMatch = url.pathname.match(/^\/b\/[^/]+\/t\/([^/]+)$/);
    if (threadMatch) {
      const threadId = threadMatch[1];
      const res = await fetch(`${supabaseUrl}/rest/v1/threads?id=eq.${threadId}&select=title,content,profiles(username,avatar_url)&limit=1`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const thread = data[0];
        metaData = {
          title: thread.title,
          description: thread.content,
          image: thread.profiles?.avatar_url || ''
        };
      }
    } else {
      // Match /u/:username
      const userMatch = url.pathname.match(/^\/u\/([^/]+)$/);
      if (userMatch) {
        const username = decodeURIComponent(userMatch[1]);
        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=username,avatar_url,bio&limit=1`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const profile = data[0];
          metaData = {
            title: profile.username,
            description: profile.bio || `查看 ${profile.username} 的个人主页`,
            image: profile.avatar_url || ''
          };
        }
      }
    }
  } catch (err) {
    console.error('Error fetching metadata for OG injection:', err);
  }

  if (metaData) {
    // @ts-ignore (HTMLRewriter is globally available in Workers)
    return new HTMLRewriter()
      .on('title', new TitleReplacer(metaData.title))
      .on('head', new MetaInjector(metaData))
      .transform(newResponse);
  }

  return newResponse;
}
