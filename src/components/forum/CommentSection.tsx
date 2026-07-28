import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post } from '../../lib/types';
import { getPostsByThread, createPost, getUserLikes, canCreateReply } from '../../lib/api';
import GuestNameDialog from './GuestNameDialog';
import { useAuth } from '../../lib/auth';
import ReplyTree from './ReplyTree';
import ReplyItem from './ReplyItem';
import PostEditor from './PostEditor';
import { toast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';

interface CommentSectionProps {
  threadId: string;
  isLocked?: boolean;
  realtime?: boolean;
}

export default function CommentSection({ threadId, isLocked, realtime }: CommentSectionProps) {
  const { user, guest, startGuestSession } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);

  const POST_PAGE = 20;
  const serverOffsetRef = useRef(0); // only counts rows fetched from server
  const userId = user?.id || null;

  const fetchPage = useCallback(async (offset: number, forMore: boolean) => {
    const fetchedPosts = await getPostsByThread(threadId, POST_PAGE, offset);

    setPosts(prev => {
      if (!forMore) {
        // fresh load: replace entirely
        return fetchedPosts;
      }
      // loadMore: dedup by id (realtime may have inserted)
      const existingIds = new Set(prev.map(p => p.id));
      const deduped = fetchedPosts.filter(p => !existingIds.has(p.id));
      return prev.length === 0 ? fetchedPosts : [...prev, ...deduped];
    });

    // Update server offset only by how many rows we actually fetched from server
    if (forMore) {
      serverOffsetRef.current += fetchedPosts.length;
    } else {
      serverOffsetRef.current = fetchedPosts.length;
    }

    setHasMore(fetchedPosts.length >= POST_PAGE);

    if (fetchedPosts.length > 0) {
      getUserLikes(userId, fetchedPosts.map(p => p.id)).then(newLikes => {
        if (forMore) {
          setLikedIds(prev => new Set([...Array.from(prev), ...Array.from(newLikes)]));
        } else {
          setLikedIds(newLikes);
        }
      });
    }

    return fetchedPosts;
  }, [threadId, userId]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      serverOffsetRef.current = 0;
      try {
        const initial = await getPostsByThread(threadId, POST_PAGE, 0);
        if (!isMounted) return;
        setPosts(initial);
        serverOffsetRef.current = initial.length;
        setHasMore(initial.length >= POST_PAGE);
        if (initial.length > 0) {
          getUserLikes(userId, initial.map(p => p.id)).then(ids => {
            if (isMounted) setLikedIds(ids);
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Update likedIds when userId changes (login/logout) - keep posts, refresh likes for all loaded
  useEffect(() => {
    if (posts.length === 0) return;
    getUserLikes(userId, posts.map(p => p.id)).then(setLikedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Scroll to anchor hash
  useEffect(() => {
    if (!isLoading && posts.length > 0 && window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const originalBg = el.style.backgroundColor;
          el.style.transition = 'background-color 0.5s ease';
          el.style.backgroundColor = 'rgba(var(--color-primary-rgb, 0, 122, 255), 0.1)';
          setTimeout(() => { el.style.backgroundColor = originalBg; }, 2000);
        }
      }, 100);
    }
  }, [isLoading, posts.length]);

  // Realtime subscription - does NOT affect serverOffset
  useEffect(() => {
    if (!realtime || !threadId || !supabase) return;

    const channel = supabase
      .channel(`thread_comments:${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts',
        filter: `thread_id=eq.${threadId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const p = payload.new as unknown as Post;
        setPosts(prev => {
          if (prev.some(x => x.id === p.id)) return prev;
          return [...prev, p];
        });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [threadId, realtime]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      await fetchPage(serverOffsetRef.current, true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, isLoadingMore, hasMore]);

  async function doSubmitReply(content: string, createdAt?: string, _overrideGuestName?: string, authorId?: string, resolvedGuestId?: string) {
    let gid: string | undefined = resolvedGuestId || guestId || guest?.id || undefined;

    if (!resolvedGuestId && !user && !gid && guest?.username) {
      try {
        const session = await startGuestSession(guest.username);
        gid = session.id;
        setGuestId(gid);
      } catch {
        toast.error('游客身份创建失败，请重试');
        return;
      }
    }

    try {
      const newPost = await createPost({
        threadId,
        content: content.trim(),
        authorId: authorId || (resolvedGuestId ? undefined : user?.id),
        guestId: gid,
        createdAt: createdAt || undefined,
      });

      if (!user && guest) {
        newPost.guest_sessions = {
          id: gid || '',
          username: guest.username,
          session_token: '',
          created_at: new Date().toISOString(),
        };
      }
      setPosts(prev => {
        if (prev.some(x => x.id === newPost.id)) return prev;
        return [...prev, newPost as Post];
      });
      toast.success('回复成功！');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '回复失败，请稍后再试';
      toast.error(msg);
      throw e; // let PostEditor show error state
    }
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
        <ReplyItem post={p} likedIds={likedIds} onPostUpdated={() => { serverOffsetRef.current = 0; fetchPage(0, false); }} />
      )} />

      {hasMore && (
        <div className="text-center py-3">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-page-bg)', color: 'var(--color-primary)' }}
          >
            {isLoadingMore ? '加载中...' : '加载更多回复'}
          </button>
        </div>
      )}

      {posts.length === 0 && (
        <div className="px-4 py-3 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无评论，来说点什么吧
        </div>
      )}

      {isLocked ? (
        <div className="px-4 py-3 text-center text-sm mb-4 mx-4 rounded-xl font-medium" style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', color: '#E65100' }}>
          🔒 此帖已被锁定，目前无法回复
        </div>
      ) : (
        <div className="mx-4 mb-8 p-4 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-border)] shadow-sm">
          <PostEditor
            mode="reply"
            onFocusInterceptor={(e) => {
              if (!user && !guest && !guestId) {
                e.currentTarget.blur();
                setShowGuestDialog(true);
              }
            }}
            onSave={async (data) => {
              const rateCheck = canCreateReply(!user);
              if (!rateCheck.ok) {
                throw new Error(`发言过于频繁，请等 ${rateCheck.wait} 秒后再试`);
              }
              await doSubmitReply(data.content, data.createdAt, undefined, data.authorId, data.guestId);
            }}
            minHeight={100}
            draftKey={`draft_reply_thread_${threadId}`}
          />
        </div>
      )}

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            try {
              const session = await startGuestSession(name);
              setGuestId(session.id);
            } catch {
              toast.error('游客身份创建失败');
            }
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </div>
  );
}
