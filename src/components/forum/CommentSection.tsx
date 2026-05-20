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
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // No longer need localStorage for replyText here, handled by PostEditor if needed or just removed for simplicity

  const POST_PAGE = 20;
  const [hasMore, setHasMore] = useState(false);
  const postsCountRef = useRef(0);

  // Keep ref in sync with posts state
  useEffect(() => { postsCountRef.current = posts.length; }, [posts.length]);

  const loadPosts = useCallback(async (isMore = false) => {
    const offset = isMore ? postsCountRef.current : 0;

    const fetchedPosts = await getPostsByThread(threadId, POST_PAGE, offset);
    
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
      setIsLoading(false);
      
      if (initialPosts.length > 0) {
        getUserLikes(user?.id || null, initialPosts.map(p => p.id)).then(setLikedIds);
      }
    }
    loadData();

    return () => { isMounted = false; };
  }, [threadId, user]);

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
          setTimeout(() => {
            el.style.backgroundColor = originalBg;
          }, 2000);
        }
      }, 100);
    }
  }, [isLoading, posts.length]);

  useEffect(() => {
    // Real-time subscription
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

  async function doSubmitReply(content: string, createdAt?: string, overrideGuestName?: string, authorId?: string, resolvedGuestId?: string) {
    let gid: string | undefined = resolvedGuestId || guestId || guest?.id || undefined;
    const currentGuestName = overrideGuestName || guest?.username;

    if (!resolvedGuestId && !user && !gid && currentGuestName) {
      const session = await startGuestSession(currentGuestName);
      gid = session.id;
      setGuestId(gid);
    }

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
        created_at: new Date().toISOString()
      };
    }
    setPosts(prev => [...prev, newPost as Post]);
    toast.success('回复成功！');
  }

  // handleReply removed, logic moved to PostEditor's onSave

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
            const session = await startGuestSession(name);
            setGuestId(session.id);
            // After getting guest name, the user will have to click submit again
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </div>
  );
}
