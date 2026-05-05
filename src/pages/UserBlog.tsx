import { useParams, Link } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getProfileByUsername,
  getThreadsByAuthor,
  getAICharacterByProfileId,
  getPostCountByAuthor,
  getThreadsByReplies,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import KarmaBadge from '../components/ui/KarmaBadge';
import CharacterCard from '../components/blog/CharacterCard';
import BlogCard from '../components/blog/BlogCard';
import CreatePostForm from '../components/forum/CreatePostForm';
import type { Profile, Thread, AICharacter } from '../lib/types';

export default function UserBlog() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [character, setCharacter] = useState<AICharacter | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [repliedThreads, setRepliedThreads] = useState<Thread[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    async function load() {
      if (!username) return;
      setIsLoading(true);
      const p = await getProfileByUsername(username);
      setProfile(p);

      if (p) {
        const [t, rt, pc, ch] = await Promise.all([
          getThreadsByAuthor(p.id),
          getThreadsByReplies(p.id),
          getPostCountByAuthor(p.id),
          p.is_ai_character ? getAICharacterByProfileId(p.id) : Promise.resolve(null),
        ]);
        setThreads(t);
        setRepliedThreads(rt.filter(rt => !t.find(th => th.id === rt.id)));
        setPostCount(pc);
        setCharacter(ch);
      }
      setIsLoading(false);
    }
    load();
  }, [username]);

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

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
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
              共发表 {threads.length} 篇文章 · 参与 {totalDiscussions} 次讨论 · 获得 {profile.karma} 点声望
            </div>
          </div>
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
          threads.map((thread) => <BlogCard key={thread.id} thread={thread} />)
        )}
      </div>

      {/* Replies (threads participated in) */}
      {repliedThreads.length > 0 && (
        <>
          <h2 className="text-lg font-bold mb-3">参与讨论</h2>
          <div className="flex flex-col gap-4">
            {repliedThreads.map((thread) => <BlogCard key={thread.id} thread={thread} />)}
          </div>
        </>
      )}

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
