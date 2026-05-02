import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { getBoards } from '../../lib/api';
import type { Board } from '../../lib/types';

interface CreatePostFormProps {
  onClose: () => void;
  defaultBoardSlug?: string;
}

export default function CreatePostForm({ onClose, defaultBoardSlug }: CreatePostFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [boardId, setBoardId] = useState('');
  const [token, setToken] = useState<string>('');
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    async function fetchBoards() {
      const fetchedBoards = await getBoards();
      setBoards(fetchedBoards);
      
      if (fetchedBoards.length > 0) {
        if (defaultBoardSlug) {
          const defaultBoard = fetchedBoards.find(b => b.slug === defaultBoardSlug);
          if (defaultBoard) {
            setBoardId(defaultBoard.id);
            return;
          }
        }
        setBoardId(fetchedBoards[0].id);
      }
    }
    fetchBoards();
  }, [defaultBoardSlug]);

  // Use test key as fallback if not provided
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !token) {
      alert('请填写完整内容并完成验证');
      return;
    }
    // Mock submission
    console.log('Submit post:', { title, content, boardId, token });
    alert('发帖成功（Mock）');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="w-full max-w-2xl rounded-xl flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-bold m-0 text-[var(--color-text-primary)]">发布新帖</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--color-page-bg)] transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={24} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>版块</label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-transparent"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              {boards.map(board => (
                <option key={board.id} value={board.id}>
                  {board.icon} {board.name} ({board.era_tag})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>标题</label>
            <input
              type="text"
              placeholder="一句话概括主题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-transparent transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>正文 (支持 Markdown)</label>
            <textarea
              placeholder="分享你的想法、问题或见解..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full flex-1 min-h-[200px] px-3 py-2 rounded-lg border outline-none text-sm resize-none bg-transparent transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="overflow-hidden rounded-lg">
              <Turnstile 
                siteKey={SITE_KEY} 
                onSuccess={(t) => setToken(t)} 
                options={{ theme: 'light' }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!title.trim() || !content.trim() || !token}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              发布
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
