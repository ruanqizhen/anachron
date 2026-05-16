import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import type { Thread } from '../../lib/types';
import { getDisplayName } from '../../lib/types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import KarmaBadge from '../ui/KarmaBadge';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import CommentSection from './CommentSection';
import ThreadMenu from './ThreadMenu';
import { formatDisplayDate, formatFullDate } from '../../lib/dateUtils';
import { toggleThreadLike, getThreadLikes } from '../../lib/api';

interface PostCardProps {
  thread: Thread;
}

// timeAgo logic is now in formatDisplayDate


const MAX_PREVIEW_LENGTH = 200;

export default function PostCard({ thread: initialThread }: PostCardProps) {
  const { user } = useAuth();
  const [thread, setThread] = useState(initialThread);
  useEffect(() => { setTimeout(() => setThread(initialThread), 0); }, [initialThread]);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [likeCount, setLikeCount] = useState((thread.thread_like_count || 0) + (thread.like_count || 0));
  const [isLiking, setIsLiking] = useState(false);

  // Load initial like status for this thread
  useEffect(() => {
    getThreadLikes(user?.id || null, [thread.id]).then(likedIds => {
      setLiked(likedIds.has(thread.id));
    });
  }, [user, thread.id]);

  const author = thread.profiles;
  const board = thread.boards;
  const isLong = thread.content.length > MAX_PREVIEW_LENGTH;
  const displayContent = thread.content;
  const navigate = useNavigate();
  const threadUrl = board ? `/b/${board.slug}/t/${thread.id}` : '#';

  if (thread.deleted_at) {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
      >
        <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>
          帖子已被删除 · {new Date(thread.deleted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    );
  }

  return (
    <article
      className="rounded-lg transition-shadow relative"
      style={{
        backgroundColor: 'var(--color-card-bg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Menu button */}
      <div className="absolute top-3 right-3 z-10">
        <ThreadMenu thread={thread} onUpdate={(t) => setThread(t)} />
      </div>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <Link to={author ? `/u/${author.username}` : '#'}>
          <Avatar
            name={getDisplayName(thread)}
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
              {getDisplayName(thread)}
            </Link>
            {author?.is_ai_character && <Badge type="verified" />}
                        {author && !author.is_ai_character && <KarmaBadge karma={author.karma} className="ml-1" />}
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
            <time dateTime={thread.created_at} title={formatFullDate(thread.created_at)}>{formatDisplayDate(thread.created_at)}</time>
          </div>
        </div>
      </div>

      {/* Pin / Featured indicators */}
      {(thread.pin_level > 0 || thread.is_featured) && (
        <div className="px-4 pt-2 flex items-center gap-2">
          {thread.pin_level > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: thread.pin_level === 3 ? '#FDEDED' : thread.pin_level === 2 ? '#E3F0FD' : '#E8F5E9',
                color: thread.pin_level === 3 ? 'var(--color-danger)' : thread.pin_level === 2 ? 'var(--color-primary)' : 'var(--color-success)',
              }}>
              📌 {thread.pin_level === 3 ? '主页置顶' : thread.pin_level === 2 ? '版块置顶' : '博客置顶'}
            </span>
          )}
          {thread.is_featured && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: '#FFF7ED', color: '#D97706', border: '1px solid #FDE68A' }}>
              ⭐ 精华
            </span>
          )}
        </div>
      )}

      {/* Title + Content — clickable to navigate to thread */}
      <div
        className="px-4 pt-3 pb-2 cursor-pointer"
        onClick={(e) => {
          // Don't navigate if user clicked on a link, button, or selected text
          const target = e.target as HTMLElement;
          if (target.closest('a') || target.closest('button') || window.getSelection()?.toString()) return;
          if (threadUrl !== '#') navigate(threadUrl);
        }}
      >
        <h2
          className="text-xl font-bold mb-2 hover:underline"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {thread.title}
        </h2>
        <div 
          className="relative overflow-hidden transition-all duration-300"
          style={{ maxHeight: !expanded && isLong ? '300px' : 'none' }}
        >
          <MarkdownRenderer content={displayContent} />
          {!expanded && isLong && (
            <div 
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent, var(--color-card-bg))' }}
            />
          )}
        </div>
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
          onClick={async () => {
            if (isLiking) return;
            const wasLiked = liked;
            setLiked(!wasLiked);
            setLikeCount(c => c + (wasLiked ? -1 : 1));
            setIsLiking(true);
            try {
              const result = await toggleThreadLike(thread.id, user?.id || null);
              setLiked(result);
              setLikeCount(c => c + (result === wasLiked ? (wasLiked ? -1 : 1) : 0));
            } catch {
              setLiked(wasLiked);
              setLikeCount(c => c + (wasLiked ? 1 : -1));
            } finally {
              setIsLiking(false);
            }
          }}
          className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded-md text-sm font-medium cursor-pointer bg-transparent border-none transition-colors hover:bg-[var(--color-page-bg)]`}
          style={{ color: liked ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
        >
          <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>点赞{likeCount > 0 ? ` ${likeCount}` : ''}</span>
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
          style={{ color: shareToast ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
          onClick={() => {
            navigator.clipboard?.writeText(window.location.origin + (board ? `/b/${board.slug}/t/${thread.id}` : ''));
            setShareToast(true);
            setTimeout(() => setShareToast(false), 1500);
          }}
        >
          <Share2 size={16} />
          <span>{shareToast ? '✓ 已复制' : '分享'}</span>
        </button>
      </div>

      {/* Inline comments */}
      {showComments && (
        <CommentSection threadId={thread.id} />
      )}
    </article>
  );
}
