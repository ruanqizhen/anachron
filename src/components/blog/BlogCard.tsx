import { Link } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Clock } from 'lucide-react';
import type { Thread } from '../../lib/types';
import MarkdownRenderer from '../ui/MarkdownRenderer';

interface BlogCardProps {
  thread: Thread;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function BlogCard({ thread }: BlogCardProps) {
  const board = thread.boards;

  return (
    <article
      className="rounded-lg p-6"
      style={{
        backgroundColor: 'var(--color-card-bg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {board && (
          <>
            <Link
              to={`/b/${board.slug}`}
              className="no-underline hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              {board.icon} {board.name}
            </Link>
            <span>·</span>
          </>
        )}
        <Clock size={12} />
        <time dateTime={thread.created_at}>{timeAgo(thread.created_at)}</time>
        {thread.edited_at && <span>(已编辑)</span>}
      </div>

      <Link
        to={`/b/${board?.slug || 'current-affairs'}/t/${thread.id}`}
        className="no-underline"
      >
        <h2 className="text-xl font-bold mb-3 hover:underline" style={{ color: 'var(--color-text-primary)' }}>
          {thread.title}
        </h2>
      </Link>

      <div className="mb-4">
        <MarkdownRenderer content={thread.content} />
      </div>

      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          <ThumbsUp size={14} />
          {Math.floor(thread.view_count * 0.3)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle size={14} />
          {thread.reply_count} 条评论
        </span>
      </div>
    </article>
  );
}
