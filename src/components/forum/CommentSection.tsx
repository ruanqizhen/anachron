import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Send } from 'lucide-react';
import type { Post } from '../../lib/types';
import { getPostsByThread } from '../../lib/mockData';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import MarkdownRenderer from '../ui/MarkdownRenderer';

interface CommentSectionProps {
  threadId: string;
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

function CommentItem({ post, isNested = false }: { post: Post; isNested?: boolean }) {
  const [liked, setLiked] = useState(false);
  const author = post.profiles;

  if (post.deleted_at) {
    return (
      <div
        className={`px-4 py-3 text-sm italic ${isNested ? 'ml-12' : ''}`}
        style={{ color: 'var(--color-text-muted)' }}
      >
        [ 此内容已被删除 · 删除于 {new Date(post.deleted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} ]
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 px-4 py-3 ${isNested ? 'ml-12' : ''}`}>
      <Link to={author ? `/u/${author.username}` : '#'} className="shrink-0">
        <Avatar
          name={author?.display_name || '游客'}
          url={author?.avatar_url}
          size={32}
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div
          className="rounded-xl px-3 py-2"
          style={{ backgroundColor: 'var(--color-page-bg)' }}
        >
          <div className="flex items-center gap-1">
            <Link
              to={author ? `/u/${author.username}` : '#'}
              className="font-semibold text-[13px] no-underline hover:underline"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {author?.display_name || '游客'}
            </Link>
            {author?.is_ai_character && <Badge type="verified" />}
            {author?.is_ai_character && (
              <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                东汉末年
              </span>
            )}
          </div>
          <MarkdownRenderer content={post.content} className="text-sm" />
        </div>
        <div className="flex items-center gap-3 mt-1 px-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <button
            onClick={() => setLiked(!liked)}
            className="flex items-center gap-1 font-medium cursor-pointer bg-transparent border-none"
            style={{ color: liked ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: 12 }}
          >
            <ThumbsUp size={12} fill={liked ? 'currentColor' : 'none'} />
            {post.likes > 0 && post.likes}
          </button>
          <span>·</span>
          <button className="font-medium cursor-pointer bg-transparent border-none" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            回复
          </button>
          <span>·</span>
          <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          {post.edited_at && <span>(已编辑)</span>}
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({ threadId }: CommentSectionProps) {
  const [replyText, setReplyText] = useState('');
  const posts = getPostsByThread(threadId);

  const topLevelPosts = posts.filter(p => !p.parent_post_id);
  const childPosts = posts.filter(p => p.parent_post_id);

  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      {/* Comments list */}
      {topLevelPosts.map((post) => (
        <div key={post.id}>
          <CommentItem post={post} />
          {childPosts
            .filter(cp => cp.parent_post_id === post.id)
            .map(cp => (
              <CommentItem key={cp.id} post={cp} isNested />
            ))
          }
        </div>
      ))}

      {posts.length === 0 && (
        <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无评论，来说点什么吧 👋
        </div>
      )}

      {/* Reply input */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Avatar name="你" size={32} />
        <div className="flex-1 flex items-center rounded-full px-3" style={{ backgroundColor: 'var(--color-page-bg)' }}>
          <input
            type="text"
            placeholder="写评论..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-1 py-2 text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <button
            className="p-1 cursor-pointer bg-transparent border-none disabled:opacity-30"
            disabled={!replyText.trim()}
            style={{ color: 'var(--color-primary)' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
