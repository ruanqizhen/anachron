import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { getBoards, createThread, createGuestSession, getProfileByUsername, createNotification, canCreateThread } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { parseMentions } from '../../lib/mentions';
import GuestNameDialog from './GuestNameDialog';
import type { Board } from '../../lib/types';

interface CreatePostFormProps {
  onClose: () => void;
  onCreated?: () => void;
  defaultBoardSlug?: string;
}

export default function CreatePostForm({ onClose, onCreated, defaultBoardSlug }: CreatePostFormProps) {
  const { user, guest, startGuestSession, impersonating } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [boardId, setBoardId] = useState('');
  const [token, setToken] = useState<string>('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(guest?.username || null);

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

  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
  const isLoggedIn = !!user;
  const effectiveGuestName = guestName || guest?.username || null;

  async function doSubmit() {
    setError('');

    if (!title.trim() || !content.trim()) {
      setError('请填写标题和正文');
      return;
    }
    if (title.trim().length < 5) {
      setError('标题至少 5 个字符');
      return;
    }
    if (content.trim().length < 20) {
      setError('正文至少 20 个字符');
      return;
    }
    if (!token) {
      setError('请完成人机验证');
      return;
    }
    if (!canCreateThread(!isLoggedIn)) {
      setError('发言过于频繁，请稍后再试');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create guest session in DB if posting as guest
      let guestId: string | undefined;
      if (!user && effectiveGuestName) {
        guestId = await createGuestSession(effectiveGuestName);
      }

      const newThread = await createThread({
        boardId,
        title: title.trim(),
        content: content.trim(),
        authorId: impersonating?.profileId || user?.id,
        guestId,
        turnstileToken: token,
      });

      // Notify @mentioned users
      const mentionedUsernames = parseMentions(title.trim() + ' ' + content.trim());
      for (const mentionedName of mentionedUsernames) {
        const profile = await getProfileByUsername(mentionedName);
        if (profile && profile.id !== user?.id) {
          await createNotification({
            recipientId: profile.id,
            type: 'mention',
            actorId: user?.id,
            threadId: newThread.id,
          }).catch(() => { /* ignore */ });
        }
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err.message || '发帖失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isLoggedIn && !effectiveGuestName) {
      setShowGuestDialog(true);
      return;
    }

    doSubmit();
  }

  function handleGuestConfirm(name: string) {
    setGuestName(name);
    setShowGuestDialog(false);
    startGuestSession(name);
    // Don't auto-submit - user still needs to fill form and verify
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div
          className="w-full max-w-2xl rounded-xl flex flex-col max-h-[90vh]"
          style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-xl font-bold m-0 text-[var(--color-text-primary)]">
              发布新帖
              {effectiveGuestName && (
                <span className="text-sm font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                  以「{effectiveGuestName}」身份
                </span>
              )}
            </h2>
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
                placeholder="一句话概括主题（5-100字）..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-transparent transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>正文 (支持 Markdown)</label>
              <textarea
                placeholder="分享你的想法、问题或见解（至少20字）..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full flex-1 min-h-[200px] px-3 py-2 rounded-lg border outline-none text-sm resize-none bg-transparent transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDED', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="overflow-hidden rounded-lg">
                <Turnstile
                  siteKey={SITE_KEY}
                  onSuccess={(t) => setToken(t)}
                  onExpire={() => setToken('')}
                  options={{ theme: 'light' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !content.trim() || !token}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {isSubmitting ? '发布中...' : '发布'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={handleGuestConfirm}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </>
  );
}
