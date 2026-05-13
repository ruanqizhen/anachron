import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useAuth } from '../../lib/auth';
import { useMentions } from '../../hooks/useMentions';
import { getBoards } from '../../lib/api';
import type { Board, Profile } from '../../lib/types';
import MarkdownEditor from '../ui/MarkdownEditor';
import Avatar from '../ui/Avatar';
import BCDateTimePicker from '../ui/BCDateTimePicker';
import { isAdmin } from '../../lib/admin';

interface PostEditorProps {
  mode: 'create' | 'edit' | 'reply';
  isThread?: boolean;
  initialTitle?: string;
  initialContent?: string;
  initialBoardId?: string;
  initialCreatedAt?: string;
  placeholder?: string;
  defaultBoardSlug?: string;
  onSave: (data: {
    title?: string;
    content: string;
    boardId?: string;
    createdAt?: string;
    turnstileToken?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  minHeight?: number;
  autoFocus?: boolean;
}

export default function PostEditor({
  mode, isThread, initialTitle = '', initialContent = '', initialBoardId = '', initialCreatedAt = '',
  placeholder, defaultBoardSlug, onSave, onCancel, className = '', minHeight = 120, autoFocus
}: PostEditorProps) {
  const { user, impersonating } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [boardId, setBoardId] = useState(initialBoardId);
  const [boards, setBoards] = useState<Board[]>([]);
  const [customTime, setCustomTime] = useState(initialCreatedAt || (() => {
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  })());
  const [token, setToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const {
    mentionQuery, setMentionQuery, mentionPosition, mentionOptions, mentionIndex, setMentionIndex,
    textareaRef, handleMentionChange, insertMention
  } = useMentions();

  const isAdminUser = isAdmin(user?.id);
  const isImpersonating = !!impersonating;
  const showTitle = isThread || (mode === 'create' && isThread);
  const showBoardSelect = (mode === 'create' || mode === 'edit') && isThread;
  const showTurnstile = mode === 'create';
  const showAdminControls = isImpersonating || isAdminUser;

  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

  useEffect(() => {
    if (showBoardSelect) {
      getBoards().then(list => {
        setBoards(list);
        if (list.length > 0 && !boardId) {
          if (defaultBoardSlug) {
            const def = list.find(b => b.slug === defaultBoardSlug);
            if (def) setBoardId(def.id);
            else setBoardId(list[0].id);
          } else {
            setBoardId(list[0].id);
          }
        }
      });
    }
  }, [showBoardSelect, defaultBoardSlug, boardId]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, textareaRef]);

  const handleMentionSelect = (profile: Profile) => {
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (showTitle && !title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!content.trim()) {
      setError('请输入内容');
      return;
    }
    if (showTurnstile && !token) {
      setError('请完成验证');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title: showTitle ? title.trim() : undefined,
        content: content.trim(),
        boardId: showBoardSelect ? boardId : undefined,
        createdAt: showAdminControls ? customTime : undefined,
        turnstileToken: showTurnstile ? token : undefined,
      });
      if (mode === 'create' || mode === 'reply') {
        setContent('');
        setTitle('');
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {showBoardSelect && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] ml-1">发布板块</label>
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border outline-none text-sm bg-[var(--color-page-bg)] transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.icon} {b.name} ({b.era_tag})</option>
            ))}
          </select>
        </div>
      )}

      {showTitle && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] ml-1">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="为你的帖子起个吸引人的标题..."
            className="w-full px-4 py-2.5 rounded-xl border outline-none text-base font-semibold bg-[var(--color-page-bg)] transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
      )}

      <div className="relative flex-1 flex flex-col">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] ml-1 mb-1">正文</label>
        <MarkdownEditor
          value={content}
          onChange={(v) => { setContent(v); handleMentionChange(v, textareaRef.current?.selectionStart || 0); }}
          minHeight={minHeight}
          maxHeight={1200}
          showToolbar={true}
          hideLabel={true}
          textareaProps={{
            ref: textareaRef,
            placeholder: placeholder || (isThread ? '分享你的见解...' : '写下你的回复...'),
            onKeyDown: handleKeyDown,
            style: { padding: '12px' }
          }}
        >
          {/* Mentions Dropdown */}
          {mentionQuery !== null && mentionOptions.length > 0 && (
            <div className="absolute z-50 bg-[var(--color-card-bg)] border rounded-xl shadow-2xl overflow-hidden py-1.5 max-h-60 overflow-y-auto w-64"
              style={{ top: mentionPosition.top + 10 + 'px', left: mentionPosition.left + 'px', borderColor: 'var(--color-border)' }}>
              {mentionOptions.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleMentionSelect(opt)}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 border-none cursor-pointer"
                  style={{ backgroundColor: i === mentionIndex ? 'var(--color-hover)' : 'transparent', color: 'var(--color-text-primary)' }}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  <Avatar name={opt.username} url={opt.avatar_url} size={24} />
                  <span className="font-medium">{opt.username}</span>
                </button>
              ))}
            </div>
          )}
        </MarkdownEditor>
      </div>

      {showAdminControls && (
        <div className="flex flex-col gap-1">
          <BCDateTimePicker isoString={customTime} onChange={setCustomTime} />
        </div>
      )}

      {error && (
        <div className="text-sm font-medium px-4 py-2.5 rounded-xl animate-shake" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mt-2">
        <div className="flex-1 max-w-[300px]">
          {showTurnstile && (
            <div className="transform scale-90 origin-left">
              <Turnstile
                siteKey={SITE_KEY}
                onSuccess={(t) => setToken(t)}
                onExpire={() => setToken('')}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-[var(--color-hover)] cursor-pointer border-none bg-transparent"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              取消
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (showTurnstile && !token) || !content.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer border-none"
            style={{
              backgroundColor: 'var(--color-primary)',
              boxShadow: isSubmitting ? 'none' : '0 4px 12px rgba(24, 119, 242, 0.2)'
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                执行中...
              </span>
            ) : (
              <>
                {mode === 'edit' ? '保存更改' : isThread ? '发布帖子' : '发表回复'}
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
