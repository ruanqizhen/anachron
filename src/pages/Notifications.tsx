import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AtSign, MessageCircle, ThumbsUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getNotifications, markNotificationRead } from '../lib/api';
import Avatar from '../components/ui/Avatar';
import type { Notification } from '../lib/types';

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

const TYPE_ICONS: Record<string, typeof AtSign> = {
  mention: AtSign,
  reply: MessageCircle,
  like: ThumbsUp,
};

const TYPE_LABELS: Record<string, string> = {
  mention: '提到了你',
  reply: '回复了你',
  like: '赞了你的帖子',
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      const data = await getNotifications(user.id);
      setNotifications(data as Notification[]);
      setIsLoading(false);
    }
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
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
      <h1 className="text-xl font-bold mb-4">通知</h1>

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
            const actor = (n as any).profiles;
            const thread = (n as any).threads;
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
                    {timeAgo(n.created_at)}
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
