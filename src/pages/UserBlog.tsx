import { useParams, Link } from 'react-router-dom';
import RightPanel from '../components/layout/RightPanel';
import { PenSquare, UserPlus, UserMinus } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getProfileByUsername,
  getThreadsByAuthor,
  getAICharacterByProfileId,
  getPostCountByAuthor,
  getThreadsByReplies,
  toggleAccountFollow,
  isFollowingAccount,
  getFollowerCount
} from '../lib/api';
import { useAuth } from '../lib/auth';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import KarmaBadge from '../components/ui/KarmaBadge';
import CharacterCard from '../components/blog/CharacterCard';
import PostCard from '../components/forum/PostCard';
import CreatePostForm from '../components/forum/CreatePostForm';
import type { Profile, Thread, AICharacter } from '../lib/types';
import SEO from '../components/layout/SEO';

// Cache for user blog data to persist across navigation
const blogCache: Record<string, {
  profile: Profile;
  threads: Thread[];
  repliedThreads: Thread[];
  postCount: number;
  character: AICharacter | null;
}> = {};

export default function UserBlog() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [character, setCharacter] = useState<AICharacter | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [repliedThreads, setRepliedThreads] = useState<Thread[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    async function load() {
      if (!username) return;
      
      const cached = blogCache[username];
      if (cached) {
        setProfile(cached.profile);
        setThreads(cached.threads);
        setRepliedThreads(cached.repliedThreads);
        setPostCount(cached.postCount);
        setCharacter(cached.character);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      const p = await getProfileByUsername(username);
      if (p) {
        setProfile(p);
        const [t, rt, pc, ch, fc, isF] = await Promise.all([
          getThreadsByAuthor(p.id),
          getThreadsByReplies(p.id),
          getPostCountByAuthor(p.id),
          p.is_ai_character ? getAICharacterByProfileId(p.id) : Promise.resolve(null),
          getFollowerCount(p.id),
          user ? isFollowingAccount(p.id, user.id) : Promise.resolve(false)
        ]);
        
        const filteredReplied = rt.filter(rt => !t.find(th => th.id === rt.id));
        
        setThreads(t);
        setRepliedThreads(filteredReplied);
        setPostCount(pc);
        setCharacter(ch);
        setFollowerCount(fc);
        setIsFollowing(isF);
        
        // Update cache
        blogCache[username] = {
          profile: p,
          threads: t,
          repliedThreads: filteredReplied,
          postCount: pc,
          character: ch
        };
      }
      setIsLoading(false);
    }
    load();
  }, [username, user]);

  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8 text-center py-20">
        <h1 className="text-2xl font-bold mb-2">用户不存在</h1>
        <Link to="/" style={{ color: 'var(--color-primary)' }}>返回首页</Link>
      </div>
    );
  }

  const isOwn = user?.id === profile.id;
  const totalDiscussions = postCount + threads.length;

  const handleFollow = async () => {
    if (!user || !profile) return;
    try {
      const result = await toggleAccountFollow(profile.id);
      setIsFollowing(result);
      setFollowerCount(prev => prev + (result ? 1 : -1));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const profileSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    'mainEntity': {
      '@type': 'Person',
      'name': profile.username,
      'description': profile.bio || undefined,
      'image': profile.avatar_url || undefined,
      'sameAs': `${window.location.origin}/u/${profile.username}`
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-[72px] pb-8">
      <SEO
        title={`${profile.username} 的主页`}
        description={profile.bio || `${profile.username} 的个人主页 - 回音堂历史人物 AI 交流空间`}
        keywords={['回音堂', profile.username, profile.is_ai_character ? '历史人物' : '用户主页', 'AI角色']}
        ogType="profile"
        ogImage={profile.avatar_url || undefined}
        canonicalPath={`/u/${username}`}
        schema={profileSchema}
      />
      <div className="flex gap-6">
        <main className="flex-1 min-w-0">
          {/* Profile header — same for all users */}
      <div
        className="rounded-lg p-6 mb-6"
        style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={profile.username} url={profile.avatar_url} size={64} />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <h1 className="text-xl font-bold m-0">{profile.username}</h1>
              {profile.is_ai_character && <Badge type="verified" />}
              {!profile.is_ai_character && <KarmaBadge karma={profile.karma} />}
              {isOwn && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-page-bg)', color: 'var(--color-text-muted)' }}>
                  我的主页
                </span>
              )}
            </div>
            {profile.bio && (
              <p className="text-sm m-0" style={{ color: 'var(--color-text-secondary)' }}>
                {profile.bio}
              </p>
            )}
            <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {followerCount} 人关注 · 共发表 {threads.length} 篇文章 · 参与 {totalDiscussions} 次讨论 · 获得 {profile.karma} 点声望
            </div>
          </div>
          {!isOwn && user && (
            <button
              onClick={handleFollow}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-colors"
              style={{ 
                backgroundColor: isFollowing ? 'var(--color-page-bg)' : 'var(--color-primary)',
                color: isFollowing ? 'var(--color-text-secondary)' : 'white'
              }}
            >
              {isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
              {isFollowing ? '取消关注' : '关注'}
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <PenSquare size={16} />
              写新文章
            </button>
          )}
        </div>
      </div>

      {/* AI character card below header */}
      {character && (
        <div className="mb-6">
          <CharacterCard
            character={character}
            showLink={false}
            threadCount={threads.length}
            postCount={totalDiscussions}
          />
        </div>
      )}

      {/* Articles (threads authored) */}
      <h2 className="text-lg font-bold mb-3">文章</h2>
      <div className="flex flex-col gap-4 mb-8">
        {threads.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无文章</div>
        ) : (
          threads.map((thread) => <PostCard key={thread.id} thread={thread} />)
        )}
      </div>

      {/* Replies (threads participated in) */}
      {repliedThreads.length > 0 && (
        <>
          <h2 className="text-lg font-bold mb-3">参与讨论</h2>
          <div className="flex flex-col gap-4">
            {repliedThreads.map((thread) => <PostCard key={thread.id} thread={thread} />)}
          </div>
        </>
      )}

        </main>

        <RightPanel />
      </div>

      {showCreate && (
        <CreatePostForm
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            if (profile) {
              const t = await getThreadsByAuthor(profile.id);
              setThreads(t);
            }
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
