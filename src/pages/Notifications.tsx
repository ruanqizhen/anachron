import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AtSign, MessageCircle, ThumbsUp, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteAllNotifications } from '../lib/api';
import Avatar from '../components/ui/Avatar';
import type { Notification } from '../lib/types';
import { formatDisplayDate } from '../lib/dateUtils';
import SEO from '../components/layout/SEO';

const TYPE_ICONS: Record<string, typeof AtSign> = {
  mention: AtSign,
  reply: MessageCircle,
  like: ThumbsUp,
  thread_update: Bell,
  new_thread: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  mention: '提到了你',
  reply: '回复了你',
  like: '赞了你的帖子',
  thread_update: '关注的帖子有了新动态',
  new_thread: '关注的博主发布了新文章',
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  async function handleClearAll() {
    if (!user || isClearing) return;
    if (!window.confirm('确定要清除所有通知吗？此操作不可撤销。')) return;

    setIsClearing(true);
    try {
      await deleteAllNotifications(user.id);
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
      alert('清除通知失败，请稍后重试');
    } finally {
      setIsClearing(false);
    }
  }

  useEffect(() => {
    async function load() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      const data = await getNotifications(user.id);
      setNotifications(data as Notification[]);
      setIsLoading(false);

      // Automatically mark all notifications as read when opening the page
      try {
        await markAllNotificationsRead(user.id);
      } catch (err) {
        console.error('Failed to mark notifications as read:', err);
      }
    }
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
        <SEO title="通知" noindex={true} />
        <div className="text-center py-20">
          <Bell size={48} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-4 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
            请先登录查看通知
          </p>
          <Link to="/login" className="mt-2 inline-block text-sm" style={{ color: 'var(--color-primary)' }}>
            去登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
      <SEO title="通知" description="查看您的回音堂账户通知和最新回复动态。" noindex={true} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">通知</h1>
        {notifications.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isClearing}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all border bg-transparent cursor-pointer disabled:opacity-50"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => {
              if (isClearing) return;
              e.currentTarget.style.backgroundColor = 'var(--color-page-bg)';
              e.currentTarget.style.color = 'var(--color-danger)';
              e.currentTarget.style.borderColor = 'var(--color-danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <Trash2 size={13} />
            清除全部
          </button>
        )}
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            加载中...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Bell size={32} style={{ color: 'var(--color-text-muted)' }} />
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              暂无通知
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const actor = (n as unknown as Record<string, { username: string; avatar_url: string }>).profiles;
            const thread = (n as unknown as Record<string, { id: string; boards?: { slug: string } }>).threads;
            const Icon = TYPE_ICONS[n.type] || Bell;
            const threadLink = thread
              ? `/b/${thread.boards?.slug || 'current-affairs'}/t/${n.thread_id || thread.id}`
              : '#';

            return (
              <Link
                key={n.id}
                to={threadLink}
                onClick={() => markNotificationRead(n.id)}
                className="flex items-start gap-3 px-6 py-3.5 no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  opacity: n.is_read ? 0.6 : 1,
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: n.is_read ? 'var(--color-page-bg)' : '#E3F0FD' }}
                >
                  <Icon size={16} style={{ color: n.is_read ? 'var(--color-text-muted)' : 'var(--color-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  {actor && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Avatar name={actor.username} url={actor.avatar_url} size={20} />
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {actor.username}
                      </span>
                    </div>
                  )}
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {TYPE_LABELS[n.type] || n.type}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDisplayDate(n.created_at)}
                  </div>
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: 'var(--color-primary)' }} />
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
