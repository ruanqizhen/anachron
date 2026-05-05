import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Share2, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../lib/admin';
import type { Thread, Board } from '../../lib/types';
import { getDisplayName } from '../../lib/types';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import CommentSection from './CommentSection';
import EditDialog from './EditDialog';
import AdminEditDialog from './AdminEditDialog';
import { updateThread, softDeleteThread, adminUpdateThread, adminSoftDeleteThread, getBoards } from '../../lib/api';

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

export default function PostCard({ thread: initialThread }: PostCardProps) {
  const { user } = useAuth();
  const admin = isAdmin(user?.id);
  const [thread, setThread] = useState(initialThread);
  useEffect(() => { setTimeout(() => setThread(initialThread), 0); }, [initialThread]);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [liked, setLiked] = useState(false);

  const author = thread.profiles;
  const board = thread.boards;
  const isOwn = user && author && user.id === author.id && !author.is_ai_character;
  const canEdit = isOwn || admin;
  const isLong = thread.content.length > MAX_PREVIEW_LENGTH;
  const displayContent = isLong && !expanded
    ? thread.content.slice(0, MAX_PREVIEW_LENGTH) + '...'
    : thread.content;

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
      {canEdit && (
        <div className="absolute top-3 right-3 z-10">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-full hover:bg-[var(--color-page-bg)] cursor-pointer border-none bg-transparent">
            <MoreHorizontal size={18} style={{ color: 'var(--color-text-muted)' }} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-28 rounded-lg z-20 overflow-hidden"
                style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid var(--color-border)' }}>
                <button onClick={() => { setShowMenu(false); if (admin && !isOwn) { getBoards().then(setBoards); setShowAdminEdit(true); } else setShowEdit(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-text-primary)' }}>
                  <Pencil size={14} /> 编辑
                </button>
                <button onClick={async () => { setShowMenu(false);
                  if (admin && !isOwn) { await adminSoftDeleteThread(thread.id); setThread({...thread, deleted_at: new Date().toISOString()}); }
                  else { await softDeleteThread(thread.id); setThread({...thread, deleted_at: new Date().toISOString()}); }
                }} className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)]" style={{ color: 'var(--color-danger)' }}>
                  <Trash2 size={14} /> 删除
                </button>
              </div>
            </>
          )}
        </div>
      )}
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
          <span>点赞</span>
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

      {showEdit && (
        <EditDialog title={thread.title} content={thread.content} isThread
          onSave={async (title, content) => {
            await updateThread(thread.id, { title, content });
            setThread({...thread, title: title || thread.title, content, edited_at: new Date().toISOString()});
          }}
          onClose={() => setShowEdit(false)} />
      )}
      {showAdminEdit && (
        <AdminEditDialog title={thread.title} content={thread.content} createdAt={thread.created_at} boardId={thread.board_id} boards={boards} isThread
          onSave={async (data) => {
            await adminUpdateThread(thread.id, { title: data.title || thread.title, content: data.content, boardId: data.boardId || thread.board_id, createdAt: data.createdAt || thread.created_at });
            setThread({...thread, title: data.title || thread.title, content: data.content, edited_at: new Date().toISOString()});
          }}
          onClose={() => setShowAdminEdit(false)} />
      )}
    </article>
  );
}

