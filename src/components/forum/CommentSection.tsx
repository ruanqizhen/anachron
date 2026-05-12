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
import { supabase } from '../../lib/supabase';

interface CommentSectionProps {
  threadId: string;
  isLocked?: boolean;
  realtime?: boolean;
}


export default function CommentSection({ threadId, isLocked, realtime }: CommentSectionProps) {
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

  const POST_PAGE = 20;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadPosts = useCallback(async (isMore = false) => {
    // Determine the page to fetch without depending on the 'page' state directly in the callback's dependencies
    let targetPage = 1;
    if (isMore) {
      setPage(prev => { targetPage = prev + 1; return targetPage; });
    } else {
      setPage(1);
    }

    const fetchedPosts = await getPostsByThread(threadId, POST_PAGE, (targetPage - 1) * POST_PAGE);
    
    if (isMore) {
      setPosts(prev => [...prev, ...fetchedPosts]);
    } else {
      setPosts(fetchedPosts);
    }
    
    setHasMore(fetchedPosts.length >= POST_PAGE);
    
    if (fetchedPosts.length > 0) {
      getUserLikes(user?.id || null, fetchedPosts.map(p => p.id)).then(newLikes => {
        setLikedIds(prev => new Set([...Array.from(prev), ...Array.from(newLikes)]));
      });
    }
  }, [threadId, user]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      const initialPosts = await getPostsByThread(threadId, POST_PAGE, 0);
      if (!isMounted) return;
      
      setPosts(initialPosts);
      setHasMore(initialPosts.length >= POST_PAGE);
      setPage(1);
      setIsLoading(false);
      
      if (initialPosts.length > 0) {
        getUserLikes(user?.id || null, initialPosts.map(p => p.id)).then(setLikedIds);
      }
    }
    loadData();

    return () => { isMounted = false; };
  }, [threadId, user]);

  useEffect(() => {
    // Real-time subscription
    if (!realtime || !threadId || !supabase) return;

    const channel = supabase
      .channel(`thread_comments:${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts',
        filter: `thread_id=eq.${threadId}`,
      }, (payload: any) => {
        const p = payload.new as Post;
        setPosts(prev => {
          if (prev.some(x => x.id === p.id)) return prev;
          return [...prev, p];
        });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [threadId, loadPosts, realtime]);

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
        <ReplyItem post={p} likedIds={likedIds} onPostUpdated={() => loadPosts(false)} />
      )} />

      {hasMore && (
        <div className="text-center py-3">
          <button
            onClick={() => loadPosts(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors hover:opacity-80"
            style={{ backgroundColor: 'var(--color-page-bg)', color: 'var(--color-primary)' }}
          >
            加载更多回复
          </button>
        </div>
      )}

      {posts.length === 0 && (
        <div className="px-4 py-3 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无评论，来说点什么吧
        </div>
      )}

      {isLocked ? (
        <div className="px-4 py-3 text-center text-sm mb-2 mx-4 rounded-lg" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>
          🔒 此帖已被锁定，无法回复
        </div>
      ) : (
        <>
          {impersonating && (
            <BCDateTimePicker
              isoString={replyTime}
              onChange={setReplyTime}
              label="回复时间"
              className="mx-4 mt-2"
            />
          )}
          <div className="flex items-start gap-3 px-4 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Avatar
              name={impersonating ? impersonating.username : (user ? '我' : (guest?.username || '游客'))}
              url={impersonating?.avatarUrl}
              size={36}
            />
            <div className="flex-1 flex flex-col">
              {error && (
                <p className="text-xs m-0 mb-1 px-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
              )}
              <CommentInput
                value={replyText}
                onChange={setReplyText}
                placeholder="写回复... 至少 2 个字，支持 Markdown"
                onSubmit={() => handleReply()}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </>
      )}

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
