import { useParams, Link } from 'react-router-dom';
import { Send, ChevronRight, ThumbsUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getThreadById, getPostsByThread, updateThread, softDeleteThread, createPost, updatePost, softDeletePost, getProfileByUsername, createNotification, createGuestSession } from '../lib/api';
import { getDisplayName } from '../lib/types';
import { parseMentions } from '../lib/mentions';
import { useAuth } from '../lib/auth';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import EditDialog from '../components/forum/EditDialog';
import AIResponseIndicator from '../components/forum/AIResponseIndicator';
import GuestNameDialog from '../components/forum/GuestNameDialog';
import type { Post, Thread } from '../lib/types';

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

function ReplyItem({ post, onPostUpdated }: { post: Post; onPostUpdated: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const author = post.profiles;
  const isOwn = user && author && user.id === author.id;

  if (post.deleted_at) {
    return (
      <div className="flex gap-3 py-4">
        <div className="text-sm italic px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
          [ 此内容已被删除 · 删除于 {new Date(post.deleted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} ]
        </div>
      </div>
    );
  }

  return (
    <>
      <article className="flex gap-3 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Link to={author ? `/u/${author.username}` : '#'} className="shrink-0">
          <Avatar name={getDisplayName(post)} url={author?.avatar_url} size={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1">
              <Link
                to={author ? `/u/${author.username}` : '#'}
                className="font-semibold text-sm no-underline hover:underline"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {getDisplayName(post)}
              </Link>
              {author?.is_ai_character && <Badge type="verified" />}
              {author && !author.is_ai_character && <Badge type="registered" />}
              <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                · {timeAgo(post.created_at)}
              </span>
              {post.edited_at && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  · 已编辑
                </span>
              )}
            </div>

            {isOwn && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
                >
                  <MoreHorizontal size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div
                      className="absolute right-0 top-full mt-1 w-28 rounded-lg z-20 overflow-hidden"
                      style={{
                        backgroundColor: 'var(--color-card-bg)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <button
                        onClick={() => { setShowMenu(false); setShowEdit(true); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <Pencil size={12} /> 编辑
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
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={12} /> {isDeleting ? '删除中...' : '删除'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
          </div>
        </div>
      </article>

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

export default function ThreadPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>();
  const { user, profile, guest } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showThreadEdit, setShowThreadEdit] = useState(false);
  const [showThreadMenu, setShowThreadMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  async function loadThread() {
    if (!threadId) return;
    const fetchedThread = await getThreadById(threadId);
    setThread(fetchedThread);
  }

  async function loadPosts() {
    if (!threadId) return;
    const fetchedPosts = await getPostsByThread(threadId);
    setPosts(fetchedPosts);
  }

  useEffect(() => {
    async function loadData() {
      if (!threadId) return;
      setIsLoading(true);
      await Promise.all([loadThread(), loadPosts()]);
      setIsLoading(false);
    }
    loadData();
  }, [threadId]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!replyText.trim() || !threadId || isSubmitting) return;
    if (replyText.trim().length < 5) {
      setError('评论至少 5 个字符');
      return;
    }

    // If guest and no guest session yet, prompt for name
    if (!user && !guest && !guestId) {
      setShowGuestDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // Create guest session if needed
      let gid: string | undefined = guestId || undefined;
      if (!user && !gid && guest) {
        gid = await createGuestSession(guest.username);
        setGuestId(gid);
      }

      const newPost = await createPost({
        threadId,
        content: replyText.trim(),
        authorId: user?.id,
        guestId: gid,
      });
      setReplyText('');

      // Notify @mentioned users
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
          }).catch(() => { /* ignore */ });
        }
      }

      await loadPosts();
      await loadThread();
    } catch (err: any) {
      setError(err.message || '发送失败');
    } finally {
      setIsSubmitting(false);
    }
  }

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
  const isThreadAuthor = user && author && user.id === author.id && !author.is_ai_character;

  if (thread.deleted_at) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
        <div className="text-center py-20">
          <div className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
            [ 此内容已被删除 · 删除于 {new Date(thread.deleted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} ]
          </div>
          <Link to="/" className="mt-4 inline-block" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
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
                {author && !author.is_ai_character && <Badge type="registered" />}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {board && <>{board.icon} {board.name} · </>}
                <time dateTime={thread.created_at}>{timeAgo(thread.created_at)}</time>
                {thread.edited_at && <span> · 已编辑</span>}
              </div>
            </div>
          </div>

          {isThreadAuthor && (
            <div className="relative">
              <button
                onClick={() => setShowThreadMenu(!showThreadMenu)}
                className="p-1.5 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
              >
                <MoreHorizontal size={18} style={{ color: 'var(--color-text-muted)' }} />
              </button>
              {showThreadMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowThreadMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1 w-28 rounded-lg z-20 overflow-hidden"
                    style={{
                      backgroundColor: 'var(--color-card-bg)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <button
                      onClick={() => { setShowThreadMenu(false); setShowThreadEdit(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <Pencil size={14} /> 编辑
                    </button>
                    <button
                      onClick={async () => {
                        setShowThreadMenu(false);
                        await softDeleteThread(thread.id);
                        setThread({ ...thread, deleted_at: new Date().toISOString() });
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <h1 className="text-xl font-bold mb-3">{thread.title}</h1>
        <MarkdownRenderer content={thread.content} />
      </article>

      <AIResponseIndicator threadId={thread.id} />

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
            暂无评论，来说点什么吧
          </div>
        ) : (
          posts.map(post => (
            <ReplyItem key={post.id} post={post} onPostUpdated={loadPosts} />
          ))
        )}

        <form onSubmit={handleReply} className="flex items-start gap-3 py-4">
          <Avatar name={profile?.username || guest?.username || '你'} size={36} />
          <div className="flex-1">
            <textarea
              ref={replyInputRef}
              placeholder="写评论... 支持 Markdown 格式"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none transition-colors"
              style={{
                borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-page-bg)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)'}
            />
            {error && (
              <p className="text-xs mt-1 m-0" style={{ color: 'var(--color-danger)' }}>{error}</p>
            )}
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!replyText.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Send size={14} />
                {isSubmitting ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showThreadEdit && (
        <EditDialog
          title={thread.title}
          content={thread.content}
          isThread
          onSave={async (title, content) => {
            await updateThread(thread.id, { title, content });
            setThread({ ...thread, title: title || thread.title, content, edited_at: new Date().toISOString() });
          }}
          onClose={() => setShowThreadEdit(false)}
        />
      )}

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            const gid = await createGuestSession(name);
            setGuestId(gid);
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </div>
  );
}
