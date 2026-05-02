import { useParams, Link } from 'react-router-dom';
import { Send, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getThreadById, getPostsByThread } from '../lib/api';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import type { Post, Thread } from '../lib/types';
import { ThumbsUp } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function ReplyItem({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const author = post.profiles;

  return (
    <article className="flex gap-3 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <Link to={author ? `/u/${author.username}` : '#'} className="shrink-0">
        <Avatar name={author?.username || '游客'} url={author?.avatar_url} size={36} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <Link
            to={author ? `/u/${author.username}` : '#'}
            className="font-semibold text-sm no-underline hover:underline"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {author?.username || '游客'}
          </Link>
          {author?.is_ai_character && <Badge type="verified" />}
          {author && !author.is_ai_character && <Badge type="registered" />}
          <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
            · {timeAgo(post.created_at)}
          </span>
        </div>
        <MarkdownRenderer content={post.content} className="text-sm" />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => setLiked(!liked)}
            className="flex items-center gap-1 text-xs font-medium cursor-pointer bg-transparent border-none"
            style={{ color: liked ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
          >
            <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
            {post.likes + (liked ? 1 : 0)}
          </button>
          <button
            className="text-xs font-medium cursor-pointer bg-transparent border-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            回复
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ThreadPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>();
  const [replyText, setReplyText] = useState('');
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!threadId) return;
      setIsLoading(true);
      const fetchedThread = await getThreadById(threadId);
      setThread(fetchedThread);
      
      if (fetchedThread) {
        const fetchedPosts = await getPostsByThread(threadId);
        setPosts(fetchedPosts);
      }
      setIsLoading(false);
    }
    loadData();
  }, [threadId]);

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

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
      {/* Breadcrumb */}
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

      {/* Thread header */}
      <article
        className="rounded-lg px-6 py-5 mb-4"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Link to={author ? `/u/${author.username}` : '#'}>
            <Avatar name={author?.username || '游客'} url={author?.avatar_url} size={44} />
          </Link>
          <div>
            <div className="flex items-center gap-1">
              <Link
                to={author ? `/u/${author.username}` : '#'}
                className="font-semibold no-underline hover:underline"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {author?.username || '游客'}
              </Link>
              {author?.is_ai_character && <Badge type="verified" />}
              {author && !author.is_ai_character && <Badge type="registered" />}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {board && <>{board.icon} {board.name} · </>}
              <time dateTime={thread.created_at}>{timeAgo(thread.created_at)}</time>
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold mb-3">{thread.title}</h1>
        <MarkdownRenderer content={thread.content} />
      </article>

      {/* Replies */}
      <div
        className="rounded-lg px-6"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="py-4 font-semibold text-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
          全部评论 ({posts.length})
        </div>

        {posts.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            暂无评论，来说点什么吧 👋
          </div>
        ) : (
          posts.map(post => <ReplyItem key={post.id} post={post} />)
        )}

        {/* Reply form */}
        <div className="flex items-start gap-3 py-4">
          <Avatar name="你" size={36} />
          <div className="flex-1">
            <textarea
              placeholder="写评论... 支持 Markdown 格式"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-page-bg)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            />
            <div className="flex justify-end mt-2">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-primary)' }}
                disabled={!replyText.trim()}
              >
                <Send size={14} />
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

