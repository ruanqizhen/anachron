import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Thread } from '../../lib/types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import CommentSection from './CommentSection';

interface PostCardProps {
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

const MAX_PREVIEW_LENGTH = 200;

export default function PostCard({ thread }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(false);

  const author = thread.profiles;
  const board = thread.boards;
  const isLong = thread.content.length > MAX_PREVIEW_LENGTH;
  const displayContent = isLong && !expanded
    ? thread.content.slice(0, MAX_PREVIEW_LENGTH) + '...'
    : thread.content;

  return (
    <article
      className="rounded-lg transition-shadow"
      style={{
        backgroundColor: 'var(--color-card-bg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <Link to={author ? `/u/${author.username}` : '#'}>
          <Avatar
            name={author?.display_name || '游客'}
            url={author?.avatar_url}
            size={40}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-x-1">
            <Link
              to={author ? `/u/${author.username}` : '#'}
              className="font-semibold text-sm no-underline hover:underline"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {author?.display_name || '游客'}
            </Link>
            {author?.is_ai_character && <Badge type="verified" />}
            {author && !author.is_ai_character && <Badge type="registered" />}
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
            <time dateTime={thread.created_at}>{timeAgo(thread.created_at)}</time>
          </div>
        </div>
      </div>

      {/* Title + Content */}
      <div className="px-4 pt-3 pb-2">
        <Link
          to={board ? `/b/${board.slug}/t/${thread.id}` : `#`}
          className="no-underline"
        >
          <h2
            className="text-base font-bold mb-2 hover:underline"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {thread.title}
          </h2>
        </Link>
        <MarkdownRenderer content={displayContent} />
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 text-sm font-medium cursor-pointer bg-transparent border-none"
            style={{ color: 'var(--color-primary)' }}
          >
            {expanded ? (
              <>收起 <ChevronUp size={14} /></>
            ) : (
              <>展开全文 <ChevronDown size={14} /></>
            )}
          </button>
        )}
      </div>

      {/* Action bar */}
      <div
        className="flex items-center border-t mx-4 py-1"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={() => setLiked(!liked)}
          className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded-md text-sm font-medium cursor-pointer bg-transparent border-none transition-colors hover:bg-[var(--color-page-bg)]`}
          style={{ color: liked ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
        >
          <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>点赞{thread.view_count > 0 ? ` (${Math.floor(thread.view_count * 0.3)})` : ''}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-md text-sm font-medium cursor-pointer bg-transparent border-none transition-colors hover:bg-[var(--color-page-bg)]"
          style={{ color: showComments ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
        >
          <MessageCircle size={16} />
          <span>{thread.reply_count} 条评论</span>
        </button>
        <button
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-md text-sm font-medium cursor-pointer bg-transparent border-none transition-colors hover:bg-[var(--color-page-bg)]"
          style={{ color: 'var(--color-text-secondary)' }}
          onClick={() => navigator.clipboard?.writeText(window.location.origin + (board ? `/b/${board.slug}/t/${thread.id}` : ''))}
        >
          <Share2 size={16} />
          <span>分享</span>
        </button>
      </div>

      {/* Inline comments */}
      {showComments && (
        <CommentSection threadId={thread.id} />
      )}
    </article>
  );
}
