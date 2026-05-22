import { useParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getThreadById } from '../lib/api';
import { getDisplayName } from '../lib/types';
import { supabase } from '../lib/supabase';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import { formatFullDate, formatDisplayDate } from '../lib/dateUtils';
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import AIResponseIndicator from '../components/forum/AIResponseIndicator';
import CommentSection from '../components/forum/CommentSection';
import ThreadMenu from '../components/forum/ThreadMenu';
import type { Thread } from '../lib/types';
import RightPanel from '../components/layout/RightPanel';
import SEO from '../components/layout/SEO';

export default function ThreadPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!threadId) return;
      setIsLoading(true);
      const fetchedThread = await getThreadById(threadId);
      setThread(fetchedThread);
      setIsLoading(false);
      if (supabase) {
        (supabase.rpc('increment_view_count', { p_thread_id: threadId }) as unknown as Promise<void>).then(() => {}).catch((e: unknown) => console.warn('view count:', e));
      }
    }
    loadData();
  }, [threadId]);

  // handleReply is now handled by CommentSection

  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center py-20">
        <h1 className="text-2xl font-bold mb-2">帖子不存在</h1>
        <Link to="/" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
      </div>
    );
  }

  const author = thread.profiles;
  const board = thread.boards;

  if (thread.deleted_at) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
        <div className="text-center py-20">
          <div className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
            [ 此内容已被删除 · 删除于 {new Date(thread.deleted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) } ]
          </div>
          <Link to="/" className="mt-4 inline-block" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
        </div>
      </div>
    );
  }

  const cleanContentPreview = thread.content
    ? thread.content.replace(/[#*`_[\]()]/g, '').substring(0, 150)
    : '';

  const threadSchema = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    'headline': thread.title,
    'description': cleanContentPreview,
    'datePublished': thread.created_at,
    'dateModified': thread.edited_at || thread.created_at,
    'author': {
      '@type': 'Person',
      'name': getDisplayName(thread),
      'url': author ? `${window.location.origin}/u/${author.username}` : undefined
    },
    'publisher': {
      '@type': 'Organization',
      'name': '回音堂',
      'logo': {
        '@type': 'ImageObject',
        'url': `${window.location.origin}/favicon.svg`
      }
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-[72px] pb-8">
      <SEO
        title={thread.title}
        description={cleanContentPreview}
        keywords={['回音堂', thread.title, board?.name || '', getDisplayName(thread)]}
        ogType="article"
        ogImage={author?.avatar_url || undefined}
        canonicalPath={`/b/${boardSlug}/t/${threadId}`}
        schema={threadSchema}
      />
      <div className="flex gap-6">
        <main className="flex-1 min-w-0">
          <nav className="flex items-center gap-1 text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            <Link to="/" className="no-underline hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
              首页
            </Link>
            <ChevronRight size={14} />
            {board && (
              <>
                <Link to={`/b/${boardSlug}`} className="no-underline hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
                  {board.icon} {board.name}
                </Link>
                <ChevronRight size={14} />
              </>
            )}
            <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>
              {thread.title}
            </span>
          </nav>

          <article
            className="rounded-lg px-6 py-5 mb-4"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <Link to={author ? `/u/${author.username}` : '#'}>
                  <Avatar name={getDisplayName(thread)} url={author?.avatar_url} size={44} />
                </Link>
                <div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={author ? `/u/${author.username}` : '#'}
                      className="font-semibold no-underline hover:underline"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {getDisplayName(thread)}
                    </Link>
                    {author?.is_ai_character && <Badge type="verified" />}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {board && <>{board.icon} {board.name} · </>}
                    <time dateTime={thread.created_at} title={formatFullDate(thread.created_at)}>{formatDisplayDate(thread.created_at)}</time>
                    {thread.edited_at && <span> · 已编辑</span>}
                  </div>
                </div>
              </div>

              {thread && (
                <ThreadMenu thread={thread} onUpdate={(t) => setThread(t)} />
              )}
            </div>

            <h1 className="text-xl font-bold mb-3">{thread.title}</h1>
            <MarkdownRenderer content={thread.content} />
          </article>

          <AIResponseIndicator threadId={thread.id} />

          {thread.is_locked && (
            <div className="rounded-lg px-4 py-3 mb-3 text-center text-sm" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>
              🔒 此帖已被锁定，无法回复
            </div>
          )}

          <div
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <CommentSection 
              threadId={thread.id} 
              isLocked={thread.is_locked} 
              realtime={true} 
            />
          </div>
        </main>

        <RightPanel />
      </div>

      {/* Guest dialog is now handled by CommentSection */}
    </div>
  );
}
