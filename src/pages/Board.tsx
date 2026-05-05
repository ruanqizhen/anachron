import { useParams, Link } from 'react-router-dom';
import { getBoardBySlug, getThreadsByBoard } from '../lib/api';
import type { Board as BoardType, Thread } from '../lib/types';
import PostCard from '../components/forum/PostCard';
import CreatePostForm from '../components/forum/CreatePostForm';
import { PenSquare } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Board() {
  const { boardSlug } = useParams<{ boardSlug: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [board, setBoard] = useState<BoardType | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!boardSlug) return;
      setIsLoading(true);
      const fetchedBoard = await getBoardBySlug(boardSlug);
      setBoard(fetchedBoard);
      
      if (fetchedBoard) {
        const fetchedThreads = await getThreadsByBoard(fetchedBoard.id, 20, 0);
        setThreads(fetchedThreads);
        setHasMore(fetchedThreads.length >= 20);
      }
      setIsLoading(false);
    }
    loadData();
  }, [boardSlug]);

  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 pt-[72px] pb-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 pt-[72px] pb-8">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2">版块不存在</h1>
          <Link to="/" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
      {/* Board header */}
      <div
        className="rounded-lg px-6 py-5 mb-6"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
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
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none transition-colors"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
          >
            <PenSquare size={16} />
            发帖
          </button>
        </div>
      </div>

      {/* Thread list */}
      <div className="flex flex-col gap-4">
        {threads.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            暂无帖子，成为第一个发帖的人吧！
          </div>
        ) : (
          threads.map((thread) => (
            <PostCard key={thread.id} thread={thread} />
          ))
        )}
        {hasMore && (
          <div className="text-center py-3">
            <button
              onClick={async () => {
                if (!board) return;
                const more = await getThreadsByBoard(board.id, 20, threads.length);
                setThreads(prev => [...prev, ...more]);
                setHasMore(more.length >= 20);
              }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors hover:opacity-80"
              style={{ backgroundColor: 'var(--color-page-bg)', color: 'var(--color-primary)' }}
            >
              加载更多
            </button>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreatePostForm
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={async () => {
            if (boardSlug) {
              const fetchedBoard = await getBoardBySlug(boardSlug);
              if (fetchedBoard) {
                const fetchedThreads = await getThreadsByBoard(fetchedBoard.id);
                setThreads(fetchedThreads);
              }
            }
          }}
          defaultBoardSlug={board.slug}
        />
      )}
    </div>
  );
}

