import { useState, useEffect } from 'react';
import { MoreHorizontal, Pencil, Trash2, Lock, Unlock, AlertTriangle, Bell, BellOff } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { isAdmin } from '../../lib/admin';
import type { Thread } from '../../lib/types';
import { 
  updateThread, 
  softDeleteThread, 
  adminUpdateThread, 
  adminSoftDeleteThread, 
  setPinLevel, 
  toggleFeatured,
  toggleThreadLock,
  toggleThreadFollow,
  isFollowingThread
} from '../../lib/api';
import EditDialog from './EditDialog';
import AdminEditDialog from './AdminEditDialog';
import ReportDialog from '../ui/ReportDialog';

interface ThreadMenuProps {
  thread: Thread;
  onUpdate: (updatedThread: Thread) => void;
}

export default function ThreadMenu({ thread, onUpdate }: ThreadMenuProps) {
  const { user } = useAuth();
  const admin = isAdmin(user?.id);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (user) {
      isFollowingThread(thread.id, user.id).then(setIsFollowing);
    }
  }, [user, thread.id]);

  const handleFollow = async () => {
    setShowMenu(false);
    try {
      const result = await toggleThreadFollow(thread.id);
      setIsFollowing(result);
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const author = thread.profiles;
  const isOwn = user && author && user.id === author.id && !author.is_ai_character;
  const canEdit = isOwn || admin;

  const handleUpdate = (updates: Partial<Thread>) => {
    onUpdate({ ...thread, ...updates });
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowMenu(!showMenu)} 
        className="p-1.5 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
        title="更多选项"
      >
        <MoreHorizontal size={18} style={{ color: 'var(--color-text-muted)' }} />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-32 rounded-lg z-20 overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-card-bg)', 
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', 
              border: '1px solid var(--color-border)' 
            }}>
            
            {/* Standard actions: Edit, Delete */}
            {canEdit && (
              <>
                <button 
                  onClick={() => { 
                    setShowMenu(false); 
                    if (admin && !isOwn) { setShowAdminEdit(true); } else setShowEdit(true); 
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Pencil size={14} /> 编辑
                </button>
                <button 
                  onClick={async () => { 
                    setShowMenu(false);
                    if (window.confirm('确定要删除吗？')) {
                      if (admin && !isOwn) { 
                        await adminSoftDeleteThread(thread.id); 
                      } else { 
                        await softDeleteThread(thread.id); 
                      }
                      handleUpdate({ deleted_at: new Date().toISOString() });
                    }
                  }} 
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} /> 删除
                </button>
              </>
            )}

            {/* Follow/Unfollow (Registered users) */}
            {user && (
              <button 
                onClick={handleFollow}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                style={{ color: 'var(--color-text-primary)' }}
              >
                {isFollowing ? <BellOff size={14} /> : <Bell size={14} />}
                {isFollowing ? '取消关注' : '关注帖子'}
              </button>
            )}

            {/* Lock/Unlock (Owner or Admin) */}
            {admin && (
              <button 
                onClick={async () => { 
                  setShowMenu(false);
                  const newLocked = !thread.is_locked;
                  await toggleThreadLock(thread.id, newLocked);
                  handleUpdate({ is_locked: newLocked });
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {thread.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
                {thread.is_locked ? '解锁帖子' : '锁定帖子'}
              </button>
            )}

            {/* Report (Non-owners) */}
            {user && !isOwn && (
              <button 
                onClick={() => { setShowMenu(false); setShowReport(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                style={{ color: 'var(--color-danger)' }}
              >
                <AlertTriangle size={14} /> 举报
              </button>
            )}

            {/* Pin controls (Owner or Admin) */}
            {(isOwn || admin) && (
              <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                {thread.pin_level !== 1 && (
                  <button onClick={async () => { setShowMenu(false); await setPinLevel(thread.id, 1); handleUpdate({ pin_level: 1 }); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                    style={{ color: 'var(--color-text-primary)' }}>
                    📌 博客置顶
                  </button>
                )}
                {thread.pin_level >= 1 && (
                  <button onClick={async () => { setShowMenu(false); await setPinLevel(thread.id, 0); handleUpdate({ pin_level: 0 }); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                    style={{ color: 'var(--color-text-muted)' }}>
                    取消置顶
                  </button>
                )}
                {admin && thread.pin_level < 2 && (
                  <button onClick={async () => { setShowMenu(false); await setPinLevel(thread.id, 2); handleUpdate({ pin_level: 2 }); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                    style={{ color: 'var(--color-primary)' }}>
                    📌 版块置顶
                  </button>
                )}
                {admin && thread.pin_level < 3 && (
                  <button onClick={async () => { setShowMenu(false); await setPinLevel(thread.id, 3); handleUpdate({ pin_level: 3 }); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors" 
                    style={{ color: 'var(--color-danger)' }}>
                    📌 主页置顶
                  </button>
                )}
              </div>
            )}

            {/* Featured toggle (Admin only) */}
            {admin && (
              <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button 
                  onClick={async () => { 
                    setShowMenu(false); 
                    const newFeatured = !thread.is_featured;
                    await toggleFeatured(thread.id, newFeatured); 
                    handleUpdate({ is_featured: newFeatured }); 
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm border-none cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
                  style={{ color: thread.is_featured ? 'var(--color-text-muted)' : '#D97706' }}
                >
                  {thread.is_featured ? '取消精华' : '⭐ 设为精华'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      {showEdit && (
        <EditDialog 
          title={thread.title} 
          content={thread.content} 
          boardId={thread.board_id} 
          isThread
          onSave={async (title, content, boardId) => {
            await updateThread(thread.id, { title, content, boardId });
            handleUpdate({ 
              title: title || thread.title, 
              content, 
              board_id: boardId || thread.board_id, 
              edited_at: new Date().toISOString() 
            });
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)} 
        />
      )}
      
      {showAdminEdit && (
        <AdminEditDialog 
          title={thread.title} 
          content={thread.content} 
          createdAt={thread.created_at} 
          boardId={thread.board_id} 
          isThread
          onSave={async (data) => {
            await adminUpdateThread(thread.id, { 
              title: data.title || thread.title, 
              content: data.content, 
              boardId: data.boardId || thread.board_id, 
              createdAt: data.createdAt || thread.created_at 
            });
            handleUpdate({ 
              title: data.title || thread.title, 
              content: data.content, 
              board_id: data.boardId || thread.board_id,
              created_at: data.createdAt || thread.created_at,
              edited_at: new Date().toISOString() 
            });
            setShowAdminEdit(false);
          }}
          onClose={() => setShowAdminEdit(false)} 
        />
      )}

      {showReport && user && (
        <ReportDialog
          targetType="thread"
          targetId={thread.id}
          reporterId={user.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
