import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, ImagePlus } from 'lucide-react';
import type { Post } from '../../lib/types';
import { getPostsByThread, createPost, getProfileByUsername, createNotification, createGuestSession, getUserLikes, canCreateReply } from '../../lib/api';
import GuestNameDialog from './GuestNameDialog';
import { useAuth } from '../../lib/auth';
import { parseMentions } from '../../lib/mentions';
import Avatar from '../ui/Avatar';
import ReplyTree from './ReplyTree';
import ReplyItem from './ReplyItem';
import { useMentions } from '../../hooks/useMentions';
import { useImageUpload } from '../../lib/useImageUpload';
import BCDateTimePicker from '../ui/BCDateTimePicker';


function CommentInput({
  value, onChange, onSubmit, placeholder, disabled, isSubmitting, className = ''
}: {
  value: string; onChange: (val: string) => void; onSubmit: () => void;
  placeholder: string; disabled?: boolean; isSubmitting?: boolean; className?: string;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    mentionQuery, setMentionQuery, mentionPosition, mentionOptions, mentionIndex, setMentionIndex,
    textareaRef, handleMentionChange, insertMention
  } = useMentions();

  const { handlePaste: rawHandlePaste, handleFileChange } = useImageUpload({
    userId: user?.id,
    onInsert: (md) => {
      onChange(value.includes('![Uploading image...]()')
        ? value.replace('![Uploading image...]()', md)
        : value + md);
    },
    onPlaceholder: () => '\n![Uploading image...]()\n',
  });

  function handlePaste(e: React.ClipboardEvent) { rawHandlePaste(e as unknown as ClipboardEvent); }

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
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isSubmitting && value.trim()) {
        onSubmit();
      }
    }
  }

  function handleMentionSelect(profile: import('../../lib/types').Profile) {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const result = insertMention(profile, value, pos);
    if (result) {
      onChange(result.newText);
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
    <div className={`relative flex-1 flex flex-col rounded-xl border focus-within:border-[var(--color-primary)] transition-colors bg-[var(--color-page-bg)] ${className}`} style={{ borderColor: 'var(--color-border)' }}>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          handleMentionChange(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="w-full flex-1 p-2.5 outline-none text-sm bg-transparent"
        style={{ color: 'var(--color-text-primary)', minHeight: 100, resize: 'none' } as React.CSSProperties}
        disabled={disabled}
      />

      <div className="px-2 py-1.5 flex items-center justify-between border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded-full hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors cursor-pointer border-none bg-transparent"
            title="上传图片"
            disabled={disabled}
          >
            <ImagePlus size={16} />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim() || isSubmitting}
          className="p-1.5 rounded-full cursor-pointer bg-transparent border-none disabled:opacity-30"
          style={{ color: 'var(--color-primary)' }}
        >
          {isSubmitting ? <span className="text-xs">发送中</span> : <Send size={16} />}
        </button>
      </div>

      {/* Drag handle */}
      <div
        className="h-2 cursor-s-resize hover:bg-[var(--color-primary)]/10 transition-colors flex items-center justify-center group border-t border-dashed"
        style={{ borderColor: 'var(--color-border)' }}
        onMouseDown={(e) => {
          e.preventDefault();
          const container = e.currentTarget.parentElement;
          if (!container) return;
          const startY = e.clientY;
          const startH = container.offsetHeight;
          const onMove = (ev: MouseEvent) => {
            container.style.height = Math.max(120, Math.min(600, startH + ev.clientY - startY)) + 'px';
            container.style.flex = 'none';
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      >
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] transition-colors opacity-30 group-hover:opacity-100" />
          <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] transition-colors opacity-30 group-hover:opacity-100" />
          <div className="w-1 h-1 rounded-full bg-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] transition-colors opacity-30 group-hover:opacity-100" />
        </div>
      </div>

      {mentionQuery !== null && mentionOptions.length > 0 && (
        <div
          className="absolute z-50 bg-[var(--color-card-bg)] border rounded-lg shadow-lg overflow-hidden py-1 max-h-48 overflow-y-auto w-full"
          style={{ top: mentionPosition.top + 'px', left: mentionPosition.left + 'px', borderColor: 'var(--color-border)' }}
        >
          {mentionOptions.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleMentionSelect(opt)}
              className="w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 border-none cursor-pointer"
              style={{ backgroundColor: i === mentionIndex ? 'var(--color-hover)' : 'transparent', color: 'var(--color-text-primary)' }}
              onMouseEnter={() => setMentionIndex(i)}
            >
              <span>{opt.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentSectionProps {
  threadId: string;
}


export default function CommentSection({ threadId }: CommentSectionProps) {
  const { user, guest, impersonating, startGuestSession } = useAuth();
  const [replyText, setReplyText] = useState(() => localStorage.getItem(`draft_reply_thread_${threadId}`) || '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [replyTime, setReplyTime] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(`draft_reply_thread_${threadId}`, replyText);
  }, [replyText, threadId]);

  const loadPosts = useCallback(async () => {
    const fetchedPosts = await getPostsByThread(threadId);
    setPosts(fetchedPosts);
    if (user && fetchedPosts.length > 0) {
      getUserLikes(user.id, fetchedPosts.map(p => p.id)).then(setLikedIds);
    }
  }, [threadId, user]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await loadPosts();
      setIsLoading(false);
    }
    loadData();
  }, [threadId, loadPosts]);

  async function doSubmitReply(overrideGuestName?: string) {
    setError('');
    let gid: string | undefined = guestId || undefined;
    const currentGuestName = overrideGuestName || guest?.username;

    if (!user && !gid && currentGuestName) {
      gid = await createGuestSession(currentGuestName);
      setGuestId(gid);
    }

    const newPost = await createPost({
      threadId,
      content: replyText.trim(),
      authorId: impersonating?.profileId || user?.id,
      guestId: gid,
      createdAt: replyTime || undefined,
    });
    setReplyText('');

    const mentionedUsernames = parseMentions(replyText.trim());
    for (const mentionedName of mentionedUsernames) {
      const mentionedProfile = await getProfileByUsername(mentionedName);
      if (mentionedProfile && mentionedProfile.id !== user?.id) {
        await createNotification({
          recipientId: mentionedProfile.id,
          type: 'mention',
          actorId: user?.id,
          threadId,
          postId: newPost.id,
        }).catch((e: unknown) => console.warn(e));
      }
    }

    if (!user && guest) (newPost as any).guest_sessions = { username: guest.username };
    setPosts(prev => [...prev, newPost as Post]);
    localStorage.removeItem(`draft_reply_thread_${threadId}`);
  }

  async function handleReply() {
    if (!replyText.trim() || isSubmitting) return;

    if (replyText.trim().length < 2) {
      setError('回复内容至少需要 2 个字符');
      return;
    }

    const rateCheck = canCreateReply(!user);
    if (!rateCheck.ok) {
      setError(`发言过于频繁，请等 ${rateCheck.wait} 秒后再试`);
      return;
    }

    if (!user && !guest && !guestId) {
      setShowGuestDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await doSubmitReply();
    } catch (err: unknown) {
      setError((err as Error).message || '发送失败');
    }
    setIsSubmitting(false);
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <ReplyTree posts={posts} renderItem={(p) => (
        <ReplyItem post={p} likedIds={likedIds} onPostUpdated={loadPosts} />
      )} />

      {posts.length === 0 && (
        <div className="px-4 py-3 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无评论，来说点什么吧
        </div>
      )}

      {impersonating && (
        <BCDateTimePicker
          isoString={replyTime}
          onChange={setReplyTime}
          label="回复时间"
          className="mx-4 mt-2"
        />
      )}
      <div className="flex items-start gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Avatar
          name={impersonating ? impersonating.username : (user ? '我' : (guest?.username || '游客'))}
          url={impersonating?.avatarUrl}
          size={32}
        />
        <div className="flex-1 flex flex-col">
          {error && (
            <p className="text-xs m-0 mb-1 px-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}
          <CommentInput
            value={replyText}
            onChange={setReplyText}
            placeholder="写回复... 至少 2 个字"
            onSubmit={() => handleReply()}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            startGuestSession(name);
            const gid = await createGuestSession(name);
            setGuestId(gid);
            setIsSubmitting(true);
            try { await doSubmitReply(name); } catch (err: unknown) { setError((err as Error).message || '发送失败'); }
            setIsSubmitting(false);
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </div>
  );
}
