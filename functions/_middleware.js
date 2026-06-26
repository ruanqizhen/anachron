// ─── Helpers ───

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Strip markdown syntax for plain-text excerpts */
function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '')    // images
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1') // links → text
    .replace(/[#*`_~>\-]/g, '')          // common md chars
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Validate that a string looks like a safe identifier (UUID, slug, etc.)
 *  Allows alphanumeric, hyphens, underscores, and CJK characters. */
function isSafeParam(str) {
  if (!str || str.length > 200) return false;
  // Block characters that could alter PostgREST query: & = ( ) , ; and whitespace
  return !/[&=();,\s]/.test(str);
}

async function supabaseQuery(supabaseUrl, supabaseKey, path) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Dynamic Sitemap ───

async function handleSitemap(supabaseUrl, supabaseKey, origin) {
  // Fetch all published, non-deleted threads with their board slug
  const threads = await supabaseQuery(supabaseUrl, supabaseKey,
    'threads?select=id,created_at,boards(slug)&deleted_at=is.null&status=eq.published&order=created_at.desc&limit=5000'
  ) || [];

  // Fetch all boards
  const boards = await supabaseQuery(supabaseUrl, supabaseKey,
    'boards?select=slug&order=display_order.asc'
  ) || [];

  // Fetch AI character profiles for user pages
  const aiProfiles = await supabaseQuery(supabaseUrl, supabaseKey,
    'profiles?select=username&is_ai_character=eq.true'
  ) || [];

  const today = new Date().toISOString().slice(0, 10);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static pages
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/characters', changefreq: 'weekly', priority: '0.8' },
    { loc: '/login', changefreq: 'monthly', priority: '0.3' },
  ];

  for (const page of staticPages) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(origin + page.loc)}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Board pages
  for (const board of boards) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(origin + '/b/' + board.slug)}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  // Thread pages
  for (const thread of threads) {
    const boardSlug = thread.boards?.slug;
    if (!boardSlug) continue;
    const lastmod = thread.created_at ? thread.created_at.slice(0, 10) : today;
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(origin + '/b/' + boardSlug + '/t/' + thread.id)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.6</priority>\n`;
    xml += `  </url>\n`;
  }

  // AI character profile pages
  for (const profile of aiProfiles) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(origin + '/u/' + encodeURIComponent(profile.username))}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.5</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ─── Content Injection: HTMLRewriter Handlers ───

/** Removes existing OG/Twitter/description meta tags from <head> so they don't
 *  duplicate with the dynamically injected ones from index.html. */
class MetaTagRemover {
  element(element) {
    const property = element.getAttribute('property') || '';
    const name = element.getAttribute('name') || '';
    if (
      property.startsWith('og:') ||
      property.startsWith('twitter:') ||
      name.startsWith('twitter:') ||
      name === 'description' ||
      name === 'keywords'
    ) {
      element.remove();
    }
  }
}

class MetaInjector {
  constructor(meta) {
    this.meta = meta;
  }
  element(element) {
    if (this.meta.title) {
      element.append(`<meta property="og:title" content="${escapeHtml(this.meta.title)} - 回音堂">`, { html: true });
    }
    if (this.meta.description) {
      const desc = escapeHtml(stripMarkdown(this.meta.description).slice(0, 150));
      element.append(`<meta property="og:description" content="${desc}">`, { html: true });
      element.append(`<meta name="description" content="${desc}">`, { html: true });
    }
    if (this.meta.image) {
      element.append(`<meta property="og:image" content="${escapeHtml(this.meta.image)}">`, { html: true });
    }
    element.append(`<meta property="og:type" content="article">`, { html: true });
    element.append(`<meta name="twitter:card" content="summary">`, { html: true });
  }
}

class TitleReplacer {
  constructor(title) {
    this.title = title;
  }
  element(element) {
    element.setInnerContent(`${this.title} - 回音堂`);
  }
}

/** Injects semantic HTML content inside <div id="root"> for crawlers.
 *  React's createRoot().render() will replace this when JS loads. */
class RootContentInjector {
  constructor(html) {
    this.html = html;
  }
  element(element) {
    element.setInnerContent(this.html, { html: true });
  }
}

// ─── Build HTML for thread pages ───

function buildThreadHtml(thread, posts, boardSlug) {
  const authorName = thread.profiles?.username || thread.guest_sessions?.username || '游客';
  const boardName = thread.boards?.name || '';
  const date = thread.created_at ? new Date(thread.created_at).toLocaleDateString('zh-CN') : '';

  // Convert markdown content to simple HTML paragraphs
  const contentHtml = escapeHtml(thread.content || '')
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${line}</p>`)
    .join('\n');

  let html = `<nav><a href="/">首页</a> › <a href="/b/${escapeHtml(boardSlug)}">${escapeHtml(boardName)}</a> › ${escapeHtml(thread.title)}</nav>\n`;
  html += `<article>\n`;
  html += `  <h1>${escapeHtml(thread.title)}</h1>\n`;
  html += `  <div><strong>${escapeHtml(authorName)}</strong> · <time datetime="${escapeHtml(thread.created_at)}">${escapeHtml(date)}</time></div>\n`;
  html += `  <div>${contentHtml}</div>\n`;
  html += `</article>\n`;

  if (posts && posts.length > 0) {
    html += `<section>\n<h2>回复 (${posts.length})</h2>\n`;
    for (const post of posts) {
      const replyAuthor = post.profiles?.username || post.guest_sessions?.username || '游客';
      const replyDate = post.created_at ? new Date(post.created_at).toLocaleDateString('zh-CN') : '';
      const replyContent = escapeHtml(post.content || '')
        .split('\n')
        .filter(line => line.trim())
        .map(line => `<p>${line}</p>`)
        .join('\n');

      html += `<div>\n`;
      html += `  <div><strong>${escapeHtml(replyAuthor)}</strong> · <time datetime="${escapeHtml(post.created_at)}">${escapeHtml(replyDate)}</time></div>\n`;
      html += `  ${replyContent}\n`;
      html += `</div>\n`;
    }
    html += `</section>\n`;
  }

  return html;
}

// ─── Build HTML for home / board pages (thread link list) ───

function buildThreadListHtml(threads, title, description) {
  let html = `<h1>${escapeHtml(title)}</h1>\n`;
  if (description) {
    html += `<p>${escapeHtml(description)}</p>\n`;
  }
  html += `<ul>\n`;
  for (const t of threads) {
    const boardSlug = t.boards?.slug;
    if (!boardSlug) continue;
    const authorName = t.profiles?.username || t.guest_sessions?.username || '游客';
    const excerpt = escapeHtml(stripMarkdown(t.content || '').slice(0, 80));
    html += `  <li><a href="/b/${escapeHtml(boardSlug)}/t/${escapeHtml(t.id)}">${escapeHtml(t.title)}</a> - ${escapeHtml(authorName)}`;
    if (excerpt) html += ` - ${excerpt}`;
    html += `</li>\n`;
  }
  html += `</ul>\n`;
  return html;
}

// ─── Main Middleware ───

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

  // ── 1. Dynamic Sitemap ──
  if (url.pathname === '/sitemap.xml') {
    if (!supabaseUrl || !supabaseKey) {
      // Fallback: return a minimal sitemap
      const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url.origin}/</loc></url>\n</urlset>`;
      return new Response(fallback, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }
    try {
      return await handleSitemap(supabaseUrl, supabaseKey, url.origin);
    } catch (err) {
      console.error('Sitemap generation error:', err);
      // Return a minimal valid sitemap instead of falling through to SPA index.html
      const errorFallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${escapeXml(url.origin)}/</loc></url>\n</urlset>`;
      return new Response(errorFallback, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }
  }

  // ── 2. Serve the page ──
  const response = await context.next();
  const headers = new Headers(response.headers);

  // Remove all restrictive CSP variants and set a permissive CSP
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');
  headers.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';");

  let newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  // Only process HTML responses
  const contentType = headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return newResponse;
  }

  if (!supabaseUrl || !supabaseKey) {
    return newResponse;
  }

  // ── 3. Route-specific content injection ──

  try {
    // ── 3a. Thread page: /b/:boardSlug/t/:threadId ──
    const threadMatch = url.pathname.match(/^\/b\/([^/]+)\/t\/([^/]+)$/);
    if (threadMatch) {
      const boardSlug = threadMatch[1];
      const threadId = threadMatch[2];

      // Validate inputs to prevent query parameter injection
      if (!isSafeParam(boardSlug) || !isSafeParam(threadId)) {
        return newResponse;
      }

      // Fetch thread with board info, author info
      const threadData = await supabaseQuery(supabaseUrl, supabaseKey,
        `threads?id=eq.${encodeURIComponent(threadId)}&select=id,title,content,created_at,edited_at,deleted_at,boards(name,slug),profiles(username,avatar_url),guest_sessions(username)&limit=1`
      );

      if (threadData && threadData.length > 0) {
        const thread = threadData[0];

        if (thread.deleted_at) {
          // Deleted thread — just inject OG with deleted notice
          return new HTMLRewriter()
            .on('title', new TitleReplacer('已删除的帖子'))
            .on('meta', new MetaTagRemover())
            .on('head', new MetaInjector({ title: '已删除的帖子', description: '此内容已被删除' }))
            .transform(newResponse);
        }

        // Fetch replies (up to 50, published, not deleted)
        const posts = await supabaseQuery(supabaseUrl, supabaseKey,
          `posts?thread_id=eq.${encodeURIComponent(threadId)}&deleted_at=is.null&status=eq.published&select=id,content,created_at,profiles(username),guest_sessions(username)&order=created_at.asc&limit=50`
        ) || [];

        const contentHtml = buildThreadHtml(thread, posts, boardSlug);

        return new HTMLRewriter()
          .on('title', new TitleReplacer(thread.title))
          .on('meta', new MetaTagRemover())
          .on('head', new MetaInjector({
            title: thread.title,
            description: thread.content,
            image: thread.profiles?.avatar_url || '',
          }))
          .on('div#root', new RootContentInjector(contentHtml))
          .transform(newResponse);
      }
    }

    // ── 3b. Board page: /b/:boardSlug ──
    const boardMatch = url.pathname.match(/^\/b\/([^/]+)$/);
    if (boardMatch) {
      const boardSlug = boardMatch[1];

      // Validate input
      if (!isSafeParam(boardSlug)) {
        return newResponse;
      }

      // Fetch board info
      const boardData = await supabaseQuery(supabaseUrl, supabaseKey,
        `boards?slug=eq.${encodeURIComponent(boardSlug)}&select=id,name,description,era_tag,slug&limit=1`
      );

      if (boardData && boardData.length > 0) {
        const board = boardData[0];

        // Fetch threads for this board
        const threads = await supabaseQuery(supabaseUrl, supabaseKey,
          `threads?board_id=eq.${encodeURIComponent(board.id)}&deleted_at=is.null&status=eq.published&select=id,title,content,created_at,boards(slug),profiles(username),guest_sessions(username)&order=created_at.desc&limit=30`
        ) || [];

        const description = `${board.name} - ${board.description || ''} · ${board.era_tag || ''}`;
        const contentHtml = buildThreadListHtml(threads, `${board.name}`, description);

        return new HTMLRewriter()
          .on('title', new TitleReplacer(board.name))
          .on('meta', new MetaTagRemover())
          .on('head', new MetaInjector({
            title: board.name,
            description: description,
          }))
          .on('div#root', new RootContentInjector(contentHtml))
          .transform(newResponse);
      }
    }

    // ── 3c. Home page: / ──
    if (url.pathname === '/') {
      const threads = await supabaseQuery(supabaseUrl, supabaseKey,
        `threads?deleted_at=is.null&status=eq.published&select=id,title,content,created_at,boards(slug),profiles(username),guest_sessions(username)&order=created_at.desc&limit=30`
      ) || [];

      if (threads.length > 0) {
        const contentHtml = buildThreadListHtml(
          threads,
          '回音堂 - 历史人物 AI 论坛',
          '回音堂是一个跨时空的历史人物 AI 交流论坛，让孔子、李白、拿破仑等历史名人与你在线对线、跨时空奇葩说。'
        );

        return new HTMLRewriter()
          .on('div#root', new RootContentInjector(contentHtml))
          .transform(newResponse);
      }
    }

    // ── 3d. User profile page: /u/:username (keep existing OG injection) ──
    const userMatch = url.pathname.match(/^\/u\/([^/]+)$/);
    if (userMatch) {
      const username = decodeURIComponent(userMatch[1]);

      // Validate input
      if (!isSafeParam(username)) {
        return newResponse;
      }

      const profileData = await supabaseQuery(supabaseUrl, supabaseKey,
        `profiles?username=eq.${encodeURIComponent(username)}&select=username,avatar_url,bio&limit=1`
      );

      if (profileData && profileData.length > 0) {
        const profile = profileData[0];
        return new HTMLRewriter()
          .on('title', new TitleReplacer(profile.username))
          .on('meta', new MetaTagRemover())
          .on('head', new MetaInjector({
            title: profile.username,
            description: profile.bio || `查看 ${profile.username} 的个人主页`,
            image: profile.avatar_url || '',
          }))
          .transform(newResponse);
      }
    }

  } catch (err) {
    console.error('Content injection error:', err);
  }

  return newResponse;
}
