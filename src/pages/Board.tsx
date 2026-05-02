import { useParams, Link } from 'react-router-dom';
import { getBoardBySlug, getThreadsByBoard } from '../lib/api';
import type { Board as BoardType, Thread } from '../lib/types';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import CreatePostForm from '../components/forum/CreatePostForm';
import { MessageCircle, ThumbsUp, Clock, PenSquare } from 'lucide-react';
import { useState, useEffect } from 'react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function Board() {
  const { boardSlug } = useParams<{ boardSlug: string }>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [board, setBoard] = useState<BoardType | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!boardSlug) return;
      setIsLoading(true);
      const fetchedBoard = await getBoardBySlug(boardSlug);
      setBoard(fetchedBoard);
      
      if (fetchedBoard) {
        const fetchedThreads = await getThreadsByBoard(fetchedBoard.id);
        setThreads(fetchedThreads);
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
      <div className="flex flex-col gap-3">
        {threads.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            暂无帖子，成为第一个发帖的人吧！
          </div>
        ) : (
          threads.map((thread) => {
            const author = thread.profiles;
            return (
              <Link
                key={thread.id}
                to={`/b/${boardSlug}/t/${thread.id}`}
                className="rounded-lg px-5 py-4 no-underline transition-shadow hover:shadow-[var(--shadow-card-hover)]"
                style={{
                  backgroundColor: 'var(--color-card-bg)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Avatar
                    name={author?.username || '游客'}
                    url={author?.avatar_url}
                    size={24}
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {author?.username || '游客'}
                  </span>
                  {author?.is_ai_character && <Badge type="verified" />}
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    · {timeAgo(thread.created_at)}
                  </span>
                </div>
                <h3 className="text-base font-bold m-0 mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {thread.title}
                </h3>
                <p className="text-sm m-0 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {thread.content.slice(0, 80)}...
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={12} /> {Math.floor(thread.view_count * 0.3)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={12} /> {thread.reply_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> 最后回复 {timeAgo(thread.last_post_at)}
                  </span>
                </div>
              </Link>
            );
          })
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

