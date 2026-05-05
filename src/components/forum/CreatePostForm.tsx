import { useState, useEffect, useRef } from 'react';
import { X, ImagePlus } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { getBoards, createThread, createGuestSession, getProfileByUsername, createNotification, canCreateThread } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { parseMentions } from '../../lib/mentions';
import GuestNameDialog from './GuestNameDialog';
import { useMentions } from '../../hooks/useMentions';
import type { Board, Profile } from '../../lib/types';
import { supabase } from '../../lib/supabase';

interface CreatePostFormProps {
  onClose: () => void;
  onCreated?: () => void;
  defaultBoardSlug?: string;
}

export default function CreatePostForm({ onClose, onCreated, defaultBoardSlug }: CreatePostFormProps) {
  const { user, guest, startGuestSession, impersonating } = useAuth();
  const [title, setTitle] = useState(() => localStorage.getItem('draft_new_post_title') || '');
  const [content, setContent] = useState(() => localStorage.getItem('draft_new_post_content') || '');
  const [boardId, setBoardId] = useState('');
  const [token, setToken] = useState<string>('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(guest?.username || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    mentionQuery,
    setMentionQuery,
    mentionPosition,
    mentionOptions,
    mentionIndex,
    setMentionIndex,
    textareaRef,
    handleMentionChange,
    insertMention
  } = useMentions();

  useEffect(() => {
    localStorage.setItem('draft_new_post_title', title);
  }, [title]);

  useEffect(() => {
    localStorage.setItem('draft_new_post_content', content);
  }, [content]);

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
    const rateCheck = canCreateThread(!isLoggedIn);
    if (!rateCheck.ok) {
      setError(`发言过于频繁，请等 ${rateCheck.wait} 秒后再试`);
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

      localStorage.removeItem('draft_new_post_title');
      localStorage.removeItem('draft_new_post_content');
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || '发帖失败');
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

  async function uploadImage(file: File) {
    if (!supabase) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${user?.id || 'guest'}/${fileName}`;

    try {
      setContent(prev => prev + '\n![Uploading image...]()\n');
      const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(filePath);
      setContent(prev => prev.replace('![Uploading image...]()', `![image](${publicUrl})`));
    } catch (err) {
      console.error('Upload error:', err);
      setContent(prev => prev.replace('\n![Uploading image...]()\n', ''));
      setError('图片上传失败');
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          uploadImage(file);
          break;
        }
      }
    }
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    handleMentionChange(val, e.target.selectionStart);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionOptions.length) % mentionOptions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(mentionOptions[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  }

  function handleMentionSelect(profile: Profile) {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const result = insertMention(profile, content, pos);
    if (result) {
      setContent(result.newText);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(result.newCursorPos, result.newCursorPos);
        }
      }, 0);
    }
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

            <div className="flex-1 flex flex-col relative">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>正文 (支持 Markdown)</label>
              
              <div className="relative flex-1 flex flex-col rounded-lg border focus-within:border-[var(--color-primary)] transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                <textarea
                  ref={textareaRef}
                  placeholder="分享你的想法、问题或见解... 试试输入 @ 召唤名流，或直接 Ctrl+V 粘贴图片"
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  className="w-full flex-1 min-h-[200px] p-3 outline-none text-sm resize-none bg-transparent"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                
                {/* Formatting toolbar */}
                <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-page-bg)' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors cursor-pointer border-none bg-transparent"
                    title="上传图片"
                  >
                    <ImagePlus size={18} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <span className="text-xs text-[var(--color-text-muted)] ml-auto">支持拖拽或剪贴板粘贴图片</span>
                </div>
              </div>

              {/* Mentions Dropdown */}
              {mentionQuery !== null && mentionOptions.length > 0 && (
                <div 
                  className="absolute z-50 bg-[var(--color-card-bg)] border rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto"
                  style={{ 
                    top: mentionPosition.top + 'px', 
                    left: mentionPosition.left + 'px',
                    borderColor: 'var(--color-border)'
                  }}
                >
                  {mentionOptions.map((opt, i) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleMentionSelect(opt)}
                      className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 border-none cursor-pointer"
                      style={{ 
                        backgroundColor: i === mentionIndex ? 'var(--color-hover)' : 'transparent',
                        color: 'var(--color-text-primary)'
                      }}
                      onMouseEnter={() => setMentionIndex(i)}
                    >
                      <span>{opt.username}</span>
                    </button>
                  ))}
                </div>
              )}
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
