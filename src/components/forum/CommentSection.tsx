import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Send, MoreHorizontal, Pencil, Trash2, ImagePlus, AlertTriangle } from 'lucide-react';
import type { Post } from '../../lib/types';
import { getDisplayName, getAuthorLink } from '../../lib/types';
import { getPostsByThread, createPost, updatePost, softDeletePost, getProfileByUsername, createNotification, createGuestSession, toggleLike, getUserLikes, canCreateReply } from '../../lib/api';
import GuestNameDialog from './GuestNameDialog';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../lib/admin';
import { parseMentions } from '../../lib/mentions';
import AdminEditDialog from './AdminEditDialog';
import { adminUpdatePost, adminSoftDeletePost } from '../../lib/api';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import KarmaBadge from '../ui/KarmaBadge';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import EditDialog from './EditDialog';
import ReportDialog from '../ui/ReportDialog';
import { useMentions } from '../../hooks/useMentions';
import { useImageUpload } from '../../lib/useImageUpload';


function CommentInput({ 
  value, onChange, onSubmit, placeholder, disabled, isSubmitting, className = ''
}: { 
  value: string; onChange: (val: string) => void; onSubmit: () => void; 
  placeholder: string; disabled?: boolean; isSubmitting?: boolean; className?: string;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    mentionQuery, setMentionQuery, mentionPosition, mentionOptions, mentionIndex, setMentionIndex,
    textareaRef, handleMentionChange, insertMention
  } = useMentions();

  const { handlePaste: rawHandlePaste, handleFileChange } = useImageUpload({
    userId: user?.id,
    onInsert: (md) => {
      onChange(value.includes('![Uploading image...]()')
        ? value.replace('![Uploading image...]()', md)
        : value + md);
    },
    onPlaceholder: () => '\n![Uploading image...]()\n',
  });

  function handlePaste(e: React.ClipboardEvent) { rawHandlePaste(e as unknown as ClipboardEvent); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionOptions.length) % mentionOptions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(mentionOptions[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isSubmitting && value.trim()) {
        onSubmit();
      }
    }
  }

  function handleMentionSelect(profile: import('../../lib/types').Profile) {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const result = insertMention(profile, value, pos);
    if (result) {
      onChange(result.newText);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(result.newCursorPos, result.newCursorPos);
        }
      }, 0);
    }
  }

  return (
    <div className={`relative flex-1 flex flex-col rounded-xl border focus-within:border-[var(--color-primary)] transition-colors bg-[var(--color-page-bg)] ${className}`} style={{ borderColor: 'var(--color-border)' }}>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          handleMentionChange(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="w-full flex-1 min-h-[60px] p-2.5 outline-none text-sm resize-none bg-transparent"
        style={{ color: 'var(--color-text-primary)' }}
        disabled={disabled}
      />
      
      <div className="px-2 py-1.5 flex items-center justify-between border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded-full hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors cursor-pointer border-none bg-transparent"
            title="上传图片"
            disabled={disabled}
          >
            <ImagePlus size={16} />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim() || isSubmitting}
          className="p-1.5 rounded-full cursor-pointer bg-transparent border-none disabled:opacity-30"
          style={{ color: 'var(--color-primary)' }}
        >
          {isSubmitting ? <span className="text-xs">发送中</span> : <Send size={16} />}
        </button>
      </div>

      {mentionQuery !== null && mentionOptions.length > 0 && (
        <div 
          className="absolute z-50 bg-[var(--color-card-bg)] border rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto w-full"
          style={{ top: mentionPosition.top + 'px', left: mentionPosition.left + 'px', borderColor: 'var(--color-border)' }}
        >
          {mentionOptions.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleMentionSelect(opt)}
              className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 border-none cursor-pointer"
              style={{ backgroundColor: i === mentionIndex ? 'var(--color-hover)' : 'transparent', color: 'var(--color-text-primary)' }}
              onMouseEnter={() => setMentionIndex(i)}
            >
              <span>{opt.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const { user, impersonating } = useAuth();
  const [liked, setLiked] = useState(likedIds.has(post.id));
  const [likes, setLikes] = useState(post.likes);
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => { 
    if (likedIds.has(post.id) !== liked) {
      setTimeout(() => setLiked(likedIds.has(post.id)), 0);
    }
  }, [likedIds, post.id, liked]);
  const [showEdit, setShowEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(() => localStorage.getItem(`draft_reply_${post.id}`) || '');
  const [replying, setReplying] = useState(false);
  const [replyTime, setReplyTime] = useState('');

  useEffect(() => {
    localStorage.setItem(`draft_reply_${post.id}`, replyText);
  }, [replyText, post.id]);
  const author = post.profiles;
  const isOwn = user && author && user.id === author.id && !author.is_ai_character;
  const admin = isAdmin(user?.id);
  const canEdit = isOwn || admin;
  const [showAdminEdit, setShowAdminEdit] = useState(false);

  if (post.status === 'pending_review') {
    return (
      <div className={`flex gap-2.5 px-4 py-3 ${isNested ? 'ml-12' : ''}`}>
        <div className="shrink-0">
          <Avatar name={getDisplayName(post)} url={author?.avatar_url} size={32} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--color-page-bg)' }}>
            <div className="flex items-center flex-wrap gap-1 mb-1">
              <span className="font-semibold text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{getDisplayName(post)}</span>
              {author?.is_ai_character && <Badge type="verified" />}
              {author && !author.is_ai_character && <KarmaBadge karma={author.karma} />}
            </div>
            <div className="text-sm italic px-2 py-1 rounded" style={{ color: 'var(--color-text-muted)', backgroundColor: '#FFF8E1' }}>
              [ 审核中 · 内容将在审核通过后显示 ]
            </div>
          </div>
          <div className="text-xs mt-1 px-1" style={{ color: 'var(--color-text-muted)' }}>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          </div>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center flex-wrap gap-1">
                <Link
                  to={getAuthorLink(post)}
                  className="font-semibold text-[13px] no-underline hover:underline"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {getDisplayName(post)}
                </Link>
                {author?.is_ai_character && <Badge type="verified" />}
                {author && !author.is_ai_character && <KarmaBadge karma={author.karma} />}
              </div>
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
                      {canEdit && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            if (admin && !isOwn) setShowAdminEdit(true);
                            else setShowEdit(true);
                          }}
                          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Pencil size={11} /> 编辑
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={async () => {
                            setShowMenu(false);
                            if (isDeleting) return;
                            setIsDeleting(true);
                            try {
                              if (admin && !isOwn) await adminSoftDeletePost(post.id);
                              else await softDeletePost(post.id);
                              onPostUpdated();
                            } catch { /* ignore */ }
                            setIsDeleting(false);
                          }}
                          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={11} /> {isDeleting ? '...' : '删除'}
                        </button>
                      )}
                      {!isOwn && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowReport(true);
                          }}
                          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <AlertTriangle size={11} /> 举报
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
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
            <button
              onClick={() => setShowReply(!showReply)}
              className="font-medium cursor-pointer bg-transparent border-none"
              style={{ color: 'var(--color-text-muted)', fontSize: 12 }}
            >
              回复
            </button>
            <span>·</span>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
            {post.edited_at && <span>(已编辑)</span>}
          </div>
        </div>
      </div>

      {showReply && (
        <div className="flex items-start gap-2 mt-2 mb-1" style={{ paddingLeft: isNested ? 0 : 0 }}>
          {impersonating && (
            <input type="datetime-local" value={replyTime} onChange={e => setReplyTime(e.target.value)}
              className="px-2 py-1 rounded border outline-none text-xs bg-transparent w-48 mb-1"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
          )}
          <CommentInput
            value={replyText}
            onChange={setReplyText}
            placeholder={`回复 ${getDisplayName(post)}，至少 2 个字...`}
            isSubmitting={replying}
            onSubmit={async () => {
              if (!replyText.trim() || replying) return;
              setReplying(true);
              try {
                // Handle guest posting for reply-to-reply
                let gid: string | undefined;
                if (!user && guest) {
                  gid = guestId || await createGuestSession(guest.username);
                  if (!guestId) setGuestId(gid);
                }
                await createPost({
                  threadId: post.thread_id,
                  content: replyText.trim(),
                  authorId: impersonating?.profileId || user?.id,
                  guestId: gid,
                  parentPostId: post.id,
                  createdAt: impersonating ? replyTime || undefined : undefined,
                });
                setReplyText('');
                localStorage.removeItem(`draft_reply_${post.id}`);
                setShowReply(false);
                onPostUpdated();
              } catch (e: unknown) { console.warn(e); }
              setReplying(false);
            }}
          />
        </div>
      )}

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
      {showReport && user && (
        <ReportDialog
          targetType="post"
          targetId={post.id}
          reporterId={user.id}
          onClose={() => setShowReport(false)}
        />
      )}
      {showAdminEdit && (
        <AdminEditDialog
          content={post.content}
          createdAt={post.created_at}
          onSave={async (data) => {
            await adminUpdatePost(post.id, data.content, data.createdAt!);
            onPostUpdated();
          }}
          onClose={() => setShowAdminEdit(false)}
        />
      )}
    </>
  );
}

export default function CommentSection({ threadId }: CommentSectionProps) {
  const { user, guest, impersonating, startGuestSession } = useAuth();
  const [replyText, setReplyText] = useState(() => localStorage.getItem(`draft_reply_thread_${threadId}`) || '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [replyTime, setReplyTime] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(`draft_reply_thread_${threadId}`, replyText);
  }, [replyText, threadId]);

  const loadPosts = useCallback(async () => {
    const fetchedPosts = await getPostsByThread(threadId);
    setPosts(fetchedPosts);
    if (user && fetchedPosts.length > 0) {
      getUserLikes(user.id, fetchedPosts.map(p => p.id)).then(setLikedIds);
    }
  }, [threadId, user]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await loadPosts();
      setIsLoading(false);
    }
    loadData();
  }, [threadId, loadPosts]);

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
      createdAt: impersonating ? replyTime || undefined : undefined,
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
        }).catch((e: unknown) => console.warn(e));
      }
    }

    // Enrich new post with local guest info for immediate display
    if (!user && guest) (newPost as any).guest_sessions = { username: guest.username };
    setPosts(prev => [...prev, newPost as Post]);
    localStorage.removeItem(`draft_reply_thread_${threadId}`);
  }

  async function handleReply() {
    if (!replyText.trim() || isSubmitting) return;
    const rateCheck = canCreateReply(!user);
    if (!rateCheck.ok) {
      setError(`发言过于频繁，请等 ${rateCheck.wait} 秒后再试`);
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
    } catch (err: unknown) {
      setError((err as Error).message || '发送失败');
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

  // Recursively render a post and all descendants
function renderChildren(p: Post, depth: number): ReactNode {
  const descendants = childPosts.filter(cp => cp.parent_post_id === p.id);
  return (
    <div key={p.id}>
      <CommentItem post={p} likedIds={likedIds} onPostUpdated={loadPosts} isNested={depth > 0} />
      {descendants.map(d => renderChildren(d, depth + 1))}
    </div>
  );
}

return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      {topLevelPosts.map(post => renderChildren(post, 0))}

      {posts.length === 0 && (
        <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无评论，来说点什么吧
        </div>
      )}

      {impersonating && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>回复时间</span>
          <input type="datetime-local" value={replyTime} onChange={e => setReplyTime(e.target.value)}
            className="px-2 py-1 rounded border outline-none text-xs bg-transparent"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
      )}
      <div className="flex items-start gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Avatar name={user ? '你' : '游客'} size={32} />
        <div className="flex-1 flex flex-col">
          {error && (
            <p className="text-xs m-0 mb-1 px-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}
          <CommentInput
            value={replyText}
            onChange={setReplyText}
            placeholder="写回复... 至少 2 个字"
            onSubmit={handleReply}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            startGuestSession(name);
            const gid = await createGuestSession(name);
            setGuestId(gid);
            // Auto-submit after guest session created
            setIsSubmitting(true);
            try { await doSubmitReply(); } catch (err: unknown) { setError((err as Error).message || '发送失败'); }
            setIsSubmitting(false);
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </div>
  );
}
