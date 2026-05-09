import { useParams, Link } from 'react-router-dom';
import { getBoardBySlug, getThreadsByBoard } from '../lib/api';
import type { Board as BoardType } from '../lib/types';
import ThreadFeed from '../components/forum/ThreadFeed';
import CreatePostForm from '../components/forum/CreatePostForm';
import { PenSquare } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

export default function Board() {
  const { boardSlug } = useParams<{ boardSlug: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [board, setBoard] = useState<BoardType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!boardSlug) return;
    setIsLoading(true);
    getBoardBySlug(boardSlug).then(b => { setBoard(b); setIsLoading(false); });
  }, [boardSlug]);

  const fetchThreads = useCallback((limit: number, offset: number) => {
    if (!board) return Promise.resolve([]);
    return getThreadsByBoard(board.id, limit, offset);
  }, [board]);

  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2">版块不存在</h1>
          <Link to="/" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
      <div className="rounded-lg px-6 py-5 mb-6" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{board.icon}</span>
            <div>
              <h1 className="text-xl font-bold m-0">{board.name}</h1>
              <p className="text-sm m-0 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {board.description} · {board.era_tag}
              </p>
            </div>
          </div>
          <button onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <PenSquare size={16} /> 发帖
          </button>
        </div>
      </div>

      <ThreadFeed fetchThreads={fetchThreads} refreshKey={refreshKey}
        emptyMessage="暂无帖子，成为第一个发帖的人吧！" />

      {isCreateModalOpen && (
        <CreatePostForm
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => setRefreshKey(k => k + 1)}
          defaultBoardSlug={board.slug}
        />
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-6 z-30 sm:hidden flex items-center justify-center w-14 h-14 rounded-full text-white border-none cursor-pointer transition-transform active:scale-95"
        style={{
          backgroundColor: 'var(--color-primary)',
          boxShadow: '0 4px 16px rgba(24, 119, 242, 0.4)',
        }}
        aria-label="发帖"
      >
        <PenSquare size={22} />
      </button>
    </div>
  );
}
