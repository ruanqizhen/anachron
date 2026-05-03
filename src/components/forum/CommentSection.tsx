import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Send, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Post } from '../../lib/types';
import { getDisplayName, getAuthorLink } from '../../lib/types';
import { getPostsByThread, createPost, updatePost, softDeletePost, getProfileByUsername, createNotification, createGuestSession, toggleLike, getUserLikes, canCreateReply } from '../../lib/api';
import GuestNameDialog from './GuestNameDialog';
import { useAuth } from '../../lib/auth';
import { parseMentions } from '../../lib/mentions';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import EditDialog from './EditDialog';

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

function CommentItem({ post, isNested = false, likedIds, onPostUpdated }: { post: Post; isNested?: boolean; likedIds: Set<string>; onPostUpdated: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(likedIds.has(post.id));
  const [likes, setLikes] = useState(post.likes);
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => { setLiked(likedIds.has(post.id)); }, [likedIds, post.id]);
  const [showEdit, setShowEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const author = post.profiles;
  const isOwn = user && author && user.id === author.id && !author.is_ai_character;

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
    <>
      <div className={`flex gap-2.5 px-4 py-3 ${isNested ? 'ml-12' : ''}`}>
        <Link to={getAuthorLink(post)} className="shrink-0">
          <Avatar
            name={getDisplayName(post)}
            url={author?.avatar_url}
            size={32}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl px-3 py-2"
            style={{ backgroundColor: 'var(--color-page-bg)' }}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <Link
                  to={getAuthorLink(post)}
                  className="font-semibold text-[13px] no-underline hover:underline"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {getDisplayName(post)}
                </Link>
                {author?.is_ai_character && <Badge type="verified" />}
                {author?.is_ai_character && (
                  <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                    东汉末年
                  </span>
                )}
              </div>
              {isOwn && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-0.5 rounded-full hover:bg-white/50 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <MoreHorizontal size={12} style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                      <div
                        className="absolute right-0 top-full mt-1 w-24 rounded-lg z-20 overflow-hidden"
                        style={{
                          backgroundColor: 'var(--color-card-bg)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <button
                          onClick={() => { setShowMenu(false); setShowEdit(true); }}
                          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Pencil size={11} /> 编辑
                        </button>
                        <button
                          onClick={async () => {
                            setShowMenu(false);
                            if (isDeleting) return;
                            setIsDeleting(true);
                            try {
                              await softDeletePost(post.id);
                              onPostUpdated();
                            } catch { /* ignore */ }
                            setIsDeleting(false);
                          }}
                          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={11} /> {isDeleting ? '...' : '删除'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <MarkdownRenderer content={post.content} className="text-sm" />
          </div>
          <div className="flex items-center gap-3 mt-1 px-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <button
              onClick={async () => {
                if (!user) return;
                setLiked(!liked);
                setLikes(l => l + (liked ? -1 : 1));
                const result = await toggleLike(post.id, user.id);
                setLiked(result);
                setLikes(post.likes + (result ? 1 : 0));
              }}
              className="flex items-center gap-1 font-medium cursor-pointer bg-transparent border-none"
              style={{ color: liked ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: 12 }}
            >
              <ThumbsUp size={12} fill={liked ? 'currentColor' : 'none'} />
              {likes > 0 && likes}
            </button>
            <span>·</span>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
            {post.edited_at && <span>(已编辑)</span>}
          </div>
        </div>
      </div>

      {showEdit && (
        <EditDialog
          content={post.content}
          onSave={async (_title, content) => {
            await updatePost(post.id, content);
            onPostUpdated();
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

export default function CommentSection({ threadId }: CommentSectionProps) {
  const { user, guest, impersonating } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  async function loadPosts() {
    const fetchedPosts = await getPostsByThread(threadId);
    setPosts(fetchedPosts);
    if (user && fetchedPosts.length > 0) {
      getUserLikes(user.id, fetchedPosts.map(p => p.id)).then(setLikedIds);
    }
  }

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await loadPosts();
      setIsLoading(false);
    }
    loadData();
  }, [threadId]);

  async function doSubmitReply() {
    setError('');
    let gid: string | undefined = guestId || undefined;
    if (!user && !gid && guest) {
      gid = await createGuestSession(guest.username);
      setGuestId(gid);
    }

    const newPost = await createPost({
      threadId,
      content: replyText.trim(),
      authorId: impersonating?.profileId || user?.id,
      guestId: gid,
    });
    setReplyText('');

    const mentionedUsernames = parseMentions(replyText.trim());
    for (const mentionedName of mentionedUsernames) {
      const mentionedProfile = await getProfileByUsername(mentionedName);
      if (mentionedProfile && mentionedProfile.id !== user?.id) {
        await createNotification({
          recipientId: mentionedProfile.id,
          type: 'mention',
          actorId: user?.id,
          threadId,
          postId: newPost.id,
        }).catch((e: any) => console.warn(e));
      }
    }

    setPosts(prev => [...prev, newPost as Post]);
  }

  async function handleReply() {
    if (!replyText.trim() || isSubmitting) return;
    if (!canCreateReply(!user)) {
      setError('发言过于频繁，请稍后再试');
      return;
    }

    // If guest and no guest session yet, prompt
    if (!user && !guest && !guestId) {
      setShowGuestDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await doSubmitReply();
    } catch (err: any) {
      setError(err.message || '发送失败');
    }
    setIsSubmitting(false);
  }

  const topLevelPosts = posts.filter(p => !p.parent_post_id);
  const childPosts = posts.filter(p => p.parent_post_id);

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      {topLevelPosts.map((post) => (
        <div key={post.id}>
          <CommentItem post={post} likedIds={likedIds} onPostUpdated={loadPosts} />
          {childPosts
            .filter(cp => cp.parent_post_id === post.id)
            .map(cp => (
              <CommentItem key={cp.id} post={cp} isNested likedIds={likedIds} onPostUpdated={loadPosts} />
            ))
          }
        </div>
      ))}

      {posts.length === 0 && (
        <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无评论，来说点什么吧
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Avatar name={user ? '你' : '游客'} size={32} />
        <div className="flex-1">
          {error && (
            <p className="text-xs m-0 mb-1 px-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}
          <div className="flex items-center rounded-full px-3" style={{ backgroundColor: 'var(--color-page-bg)' }}>
            <input
            type="text"
            placeholder="写评论..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
            className="flex-1 py-2 text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <button
            onClick={handleReply}
            disabled={!replyText.trim() || isSubmitting}
            className="p-1 cursor-pointer bg-transparent border-none disabled:opacity-30"
            style={{ color: 'var(--color-primary)' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      </div>

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            const gid = await createGuestSession(name);
            setGuestId(gid);
            // Auto-submit after guest session created
            setIsSubmitting(true);
            try { await doSubmitReply(); } catch (err: any) { setError(err.message || '发送失败'); }
            setIsSubmitting(false);
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </div>
  );
}
