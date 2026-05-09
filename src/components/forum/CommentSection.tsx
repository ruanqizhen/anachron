import { useState, useEffect, useCallback } from 'react';
import type { Post } from '../../lib/types';
import { getPostsByThread, createPost, getProfileByUsername, createNotification, createGuestSession, getUserLikes, canCreateReply } from '../../lib/api';
import GuestNameDialog from './GuestNameDialog';
import { useAuth } from '../../lib/auth';
import { parseMentions } from '../../lib/mentions';
import Avatar from '../ui/Avatar';
import ReplyTree from './ReplyTree';
import ReplyItem from './ReplyItem';
import CommentInput from './CommentInput';
import BCDateTimePicker from '../ui/BCDateTimePicker';

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
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 px-4 py-4 animate-pulse" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="shrink-0 w-9 h-9 rounded-full" style={{ backgroundColor: 'var(--color-page-bg)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 rounded w-24" style={{ backgroundColor: 'var(--color-page-bg)' }} />
              <div className="h-3 rounded w-full" style={{ backgroundColor: 'var(--color-page-bg)' }} />
              <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--color-page-bg)' }} />
            </div>
          </div>
        ))}
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
