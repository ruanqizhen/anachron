import { useParams, Link } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, Pencil, Trash2, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getThreadById, getPostsByThread, updateThread, softDeleteThread, createPost, getProfileByUsername, createNotification, createGuestSession, getUserLikes, canCreateReply } from '../lib/api';
import { getDisplayName } from '../lib/types';
import { parseMentions } from '../lib/mentions';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/admin';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import { formatFullDate } from '../components/ui/BCDateTimePicker';
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import EditDialog from '../components/forum/EditDialog';
import AdminEditDialog from '../components/forum/AdminEditDialog';
import AIResponseIndicator from '../components/forum/AIResponseIndicator';
import ReplyTree from '../components/forum/ReplyTree';
import ReplyItem from '../components/forum/ReplyItem';
import CommentSection from '../components/forum/CommentSection';
import GuestNameDialog from '../components/forum/GuestNameDialog';
import { adminUpdateThread, adminSoftDeleteThread, getBoards, toggleThreadLock } from '../lib/api';
import type { Post, Thread, Board } from '../lib/types';

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

export default function ThreadPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>();
  const { user, profile, guest, impersonating, startGuestSession } = useAuth();
  const admin = isAdmin(user?.id);
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showThreadEdit, setShowThreadEdit] = useState(false);
  const [showThreadAdminEdit, setShowThreadAdminEdit] = useState(false);
  const [showThreadMenu, setShowThreadMenu] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  async function loadThread() {
    if (!threadId) return;
    const fetchedThread = await getThreadById(threadId);
    setThread(fetchedThread);
  }

  const POST_PAGE = 20;
  const [postPage, setPostPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);

  async function loadPosts() {
    // Post loading is now handled by CommentSection
  }

  useEffect(() => {
    async function loadData() {
      if (!threadId) return;
      setIsLoading(true);
      await Promise.all([loadThread(), getBoards().then(setBoards)]);
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
  const isThreadAuthor = user && author && user.id === author.id && !author.is_ai_character;
  const canEditThread = isThreadAuthor || admin;

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
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {board && <>{board.icon} {board.name} · </>}
                <time dateTime={thread.created_at} title={formatFullDate(thread.created_at)}>{timeAgo(thread.created_at)}</time>
                {thread.edited_at && <span> · 已编辑</span>}
              </div>
            </div>
          </div>

          {canEditThread && (
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
                      onClick={() => {
                        setShowThreadMenu(false);
                        if (admin && !isThreadAuthor) setShowThreadAdminEdit(true);
                        else setShowThreadEdit(true);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <Pencil size={14} /> 编辑
                    </button>
                    {admin && (
                      <button
                        onClick={async () => {
                          setShowThreadMenu(false);
                          await toggleThreadLock(thread.id, !thread.is_locked);
                          setThread({ ...thread, is_locked: !thread.is_locked });
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <Lock size={14} /> {thread.is_locked ? '解锁' : '锁定'}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        setShowThreadMenu(false);
                        if (admin && !isThreadAuthor) await adminSoftDeleteThread(thread.id);
                        else await softDeleteThread(thread.id);
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

      {showThreadAdminEdit && (
        <AdminEditDialog
          title={thread.title}
          content={thread.content}
          createdAt={thread.created_at}
          boardId={thread.board_id}
          boards={boards}
          isThread
          onSave={async (data) => {
            await adminUpdateThread(thread.id, {
              title: data.title || thread.title,
              content: data.content,
              boardId: data.boardId || thread.board_id,
              createdAt: data.createdAt || thread.created_at,
            });
            setThread({ ...thread, title: data.title || thread.title, content: data.content, edited_at: new Date().toISOString() });
            setShowThreadAdminEdit(false);
          }}
          onClose={() => setShowThreadAdminEdit(false)}
        />
      )}

      {/* Guest dialog is now handled by CommentSection */}
    </div>
  );
}
