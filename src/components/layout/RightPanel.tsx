import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getBoards, getFeaturedThreads } from '../../lib/api';
import type { Board, Thread } from '../../lib/types';

export default function RightPanel() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [hotThreads, setHotThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [fetchedBoards, fetchedHotThreads] = await Promise.all([
        getBoards(),
        getFeaturedThreads(),
      ]);
      setBoards(fetchedBoards);
      setHotThreads(fetchedHotThreads);
      setIsLoading(false);
    }
    loadData();
  }, []);

  return (
    <aside className="hidden lg:block w-[280px] shrink-0">
      <div className="sticky top-[72px] flex flex-col gap-4">
        {/* Board navigation */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            版块导航
          </div>
          <div className="py-1">
            {isLoading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
            ) : (
              boards.map((board) => (
                <Link
                  key={board.slug}
                  to={`/b/${board.slug}`}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span className="text-base">{board.icon}</span>
                  <span>{board.name}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Hot / Featured Threads */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            ⭐ 论坛热搜
          </div>
          <div className="py-1">
            {isLoading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
            ) : hotThreads.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>暂无精华帖</div>
            ) : (
              hotThreads.map((thread) => (
                <Link
                  key={thread.id}
                  to={`/b/${thread.boards?.slug || 'current-affairs'}/t/${thread.id}`}
                  className="block px-4 py-2 text-sm no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <div className="truncate font-medium">{thread.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {thread.reply_count} 回复 · {thread.like_count || 0} 赞
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

