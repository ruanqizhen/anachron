import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import {
  getPendingThreads,
  getPendingPosts,
  approveThread,
  rejectThread,
  approvePost,
  rejectPost,
} from '../../lib/api';
import AdminGuard from '../../components/layout/AdminGuard';
import type { Thread, Post } from '../../lib/types';

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return new Date(d).toLocaleDateString('zh-CN');
}

export default function Moderation() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'threads' | 'posts'>('threads');

  async function load() {
    setIsLoading(true);
    const [t, p] = await Promise.all([getPendingThreads(), getPendingPosts()]);
    setThreads(t);
    setPosts(p);
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  const pendingCount = threads.length + posts.length;

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <h1 className="text-xl font-bold mb-2">内容审核</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          待审核：{pendingCount} 项
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setActiveTab('threads')}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors"
            style={{
              backgroundColor: activeTab === 'threads' ? 'var(--color-primary)' : 'var(--color-card-bg)',
              color: activeTab === 'threads' ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            主题帖 ({threads.length})
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors"
            style={{
              backgroundColor: activeTab === 'posts' ? 'var(--color-primary)' : 'var(--color-card-bg)',
              color: activeTab === 'posts' ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            回复 ({posts.length})
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : activeTab === 'threads' ? (
          threads.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无待审核帖子</div>
          ) : (
            <div className="flex flex-col gap-3">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold mb-1">{t.title}</h3>
                      <p className="text-sm line-clamp-3 mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {t.content.slice(0, 300)}
                      </p>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {timeAgo(t.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={async () => { await approveThread(t.id); load(); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
                        style={{ backgroundColor: 'var(--color-success)' }}
                      >
                        <Check size={12} /> 通过
                      </button>
                      <button
                        onClick={async () => { await rejectThread(t.id); load(); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
                        style={{ backgroundColor: 'var(--color-danger)' }}
                      >
                        <X size={12} /> 拒绝
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          posts.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无待审核回复</div>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {p.content.slice(0, 300)}
                      </p>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {timeAgo(p.created_at)} · Thread: {p.thread_id.slice(0, 8)}…
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={async () => { await approvePost(p.id); load(); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
                        style={{ backgroundColor: 'var(--color-success)' }}
                      >
                        <Check size={12} /> 通过
                      </button>
                      <button
                        onClick={async () => { await rejectPost(p.id); load(); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none"
                        style={{ backgroundColor: 'var(--color-danger)' }}
                      >
                        <X size={12} /> 拒绝
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </AdminGuard>
  );
}
