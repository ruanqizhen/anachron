import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MoreHorizontal, Pencil, Trash2, Link as LinkIcon } from 'lucide-react';
import type { Post } from '../../lib/types';
import { getDisplayName } from '../../lib/types';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../lib/admin';
import { timeAgo } from '../../lib/utils';
import { formatFullDate } from '../../lib/dateUtils';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import KarmaBadge from '../ui/KarmaBadge';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import EditDialog from './EditDialog';
import AdminEditDialog from './AdminEditDialog';
import PostEditor from './PostEditor';
import GuestNameDialog from './GuestNameDialog';
import {
  updatePost, softDeletePost, adminUpdatePost, adminSoftDeletePost,
  createPost, toggleLike,
} from '../../lib/api';
import { toast } from '../../lib/toast';

interface ReplyItemProps {
  post: Post;
  likedIds: Set<string>;
  showEditDelete?: boolean;
  onPostUpdated: () => void;
}

export default function ReplyItem({ post, likedIds, showEditDelete = true, onPostUpdated }: ReplyItemProps) {
  const { user, profile, guest: authGuest, startGuestSession } = useAuth();
  const admin = isAdmin(profile);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [liked, setLiked] = useState(likedIds.has(post.id));
  const [likes, setLikes] = useState(post.likes);
  const [showMenu, setShowMenu] = useState(false);
  const [prevLikedIds, setPrevLikedIds] = useState(likedIds);
  if (likedIds !== prevLikedIds) {
    setPrevLikedIds(likedIds);
    setLiked(likedIds.has(post.id));
  }
  const [showEdit, setShowEdit] = useState(false);
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replying, setReplying] = useState(false);

  const [guestId, setGuestId] = useState<string | null>(null);
  const author = post.profiles;
  const authorUsername = getDisplayName(post);
  const isOwn = user && post.profiles && user.id === post.profiles.id && !post.profiles.is_ai_character;
  const canEdit = showEditDelete && (isOwn || admin);

  if (post.deleted_at) {
    return (
      <div className="py-3 text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
        [ 此内容已被删除 · 删除于 {new Date(post.deleted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) } ]
      </div>
    );
  }

  if (post.status === 'pending_review') {
    return (
      <article className="flex gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Avatar name={authorUsername} url={author?.avatar_url} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{authorUsername}</span>
            {post.profiles?.is_ai_character && <Badge type="verified" />}
            <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }} title={formatFullDate(post.created_at)}>· {timeAgo(post.created_at)}</span>
          </div>
          <div className="text-sm italic px-3 py-2 rounded-lg" style={{ color: 'var(--color-text-muted)', backgroundColor: '#FFF8E1' }}>
            [ 审核中 · 内容将在审核通过后显示 ]
          </div>
        </div>
      </article>
    );
  }

  const avatarUrl = author?.avatar_url;
  const linkPath = post.profiles?.username ? `/u/${post.profiles.username}` : '#';

  async function handleReplySubmit(content: string, createdAt?: string, authorId?: string) {
    if (!content.trim() || replying) return;
    setReplying(true);
    try {
      let gid: string | undefined;
      if (!user && authGuest) {
        gid = guestId || authGuest.id;
      }
      await createPost({
        threadId: post.thread_id,
        content: content.trim(),
        authorId: authorId || user?.id,
        guestId: gid,
        parentPostId: post.id,
        createdAt: createdAt || undefined,
      });
      setShowReply(false);
      onPostUpdated();
    } catch { toast.error('回复失败，请稍后再试'); }
    setReplying(false);
  }

  function copyLink() {
    const url = new URL(window.location.href);
    url.hash = `post-${post.id}`;
    navigator.clipboard.writeText(url.toString());
    toast.success('链接已复制，去分享吧！');
    window.history.replaceState(null, '', url.toString());
  }

  return (
    <>
      <article id={`post-${post.id}`} className="flex gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Link to={linkPath} className="shrink-0">
          <Avatar name={authorUsername} url={avatarUrl} size={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1">
              <Link to={linkPath} className="font-semibold text-sm no-underline hover:underline" style={{ color: 'var(--color-text-primary)' }}>
                {authorUsername}
              </Link>
              {post.profiles?.is_ai_character && <Badge type="verified" />}
              {!post.profiles?.is_ai_character && post.profiles && <KarmaBadge karma={(post.profiles as any).karma} />}
              <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }} title={formatFullDate(post.created_at)}>
                · {timeAgo(post.created_at)}
              </span>
              {post.edited_at && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>· 已编辑</span>
              )}
              <button onClick={copyLink} className="p-1 rounded hover:bg-[var(--color-page-bg)] cursor-pointer border-none bg-transparent ml-1 flex items-center justify-center" title="复制链接">
                <LinkIcon size={12} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
            {canEdit && (
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-full hover:bg-[var(--color-page-bg)] cursor-pointer border-none bg-transparent">
                  <MoreHorizontal size={14} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-28 rounded-lg z-20 overflow-hidden"
                      style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid var(--color-border)' }}>
                      <button onClick={() => { setShowMenu(false); if (admin && !isOwn) setShowAdminEdit(true); else setShowEdit(true); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-primary)' }}>
                        <Pencil size={12} /> 编辑
                      </button>
                      <button onClick={async () => { setShowMenu(false); if (isDeleting) return; setIsDeleting(true);
                        try { if (admin && !isOwn) await adminSoftDeletePost(post.id); else await softDeletePost(post.id); onPostUpdated(); } catch { toast.error('删除失败'); }
                        setIsDeleting(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-danger)' }}>
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
            <button onClick={async () => { setLiked(!liked); setLikes(l => l + (liked ? -1 : 1));
              try { const result = await toggleLike(post.id, user?.id || null); setLiked(result); setLikes(post.likes + (result ? 1 : 0)); } catch { toast.error('操作失败'); } }}
              className="flex items-center gap-1 text-xs font-medium cursor-pointer bg-transparent border-none"
              style={{ color: liked ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} /> {likes}
            </button>
            <button onClick={() => setShowReply(!showReply)} className="text-xs font-medium cursor-pointer bg-transparent border-none"
              style={{ color: 'var(--color-text-muted)' }}>回复</button>
          </div>
        </div>
      </article>
      {showReply && (
        <div className="py-4 pl-9 pr-4 animate-in slide-in-from-top-2 duration-200">
          <PostEditor
            mode="reply"
            onFocusInterceptor={(e) => {
              if (!user && !authGuest) {
                e.currentTarget.blur();
                setShowGuestDialog(true);
              }
            }}
            onSave={async (data) => {
              await handleReplySubmit(data.content, data.createdAt, data.authorId);
            }}
            onCancel={() => setShowReply(false)}
            placeholder={`回复 ${authorUsername} (10-10,000字)，支持 Markdown，Ctrl+Enter 发布...`}
            minHeight={80}
            autoFocus={true}
            draftKey={`draft_reply_post_${post.id}`}
          />
        </div>
      )}
      {showEdit && <EditDialog content={post.content} onSave={async (_title: string | undefined, c: string) => { await updatePost(post.id, c); onPostUpdated(); }} onClose={() => setShowEdit(false)} />}
      {showAdminEdit && <AdminEditDialog content={post.content} createdAt={post.created_at}
        onSave={async (d: { content: string; createdAt?: string }) => { await adminUpdatePost(post.id, d.content, d.createdAt!); onPostUpdated(); }} onClose={() => setShowAdminEdit(false)} />}
      
      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            const session = await startGuestSession(name);
            setGuestId(session.id);
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </>
  );
}
