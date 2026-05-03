import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import type { AICharacter } from '../../lib/types';

interface CharacterCardProps {
  character: AICharacter;
  showLink?: boolean;
  threadCount?: number;
  postCount?: number;
}

export default function CharacterCard({
  character,
  showLink = true,
  threadCount,
  postCount,
}: CharacterCardProps) {
  const profile = character.profiles;
  if (!profile) return null;

  return (
    <div
      className="rounded-lg p-5 flex flex-col items-center text-center"
      style={{
        backgroundColor: 'var(--color-card-bg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <Avatar name={profile.username} url={profile.avatar_url} size={80} />

      <div className="flex items-center gap-1 mt-3 mb-1">
        <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {profile.username}
        </span>
        <Badge type="verified" />
      </div>

      <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {character.era}
        {character.birth_year && character.death_year && (
          <span> · {character.birth_year}–{character.death_year}年</span>
        )}
      </div>

      {character.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center mb-3">
          {character.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--color-page-bg)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {profile.bio && (
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {profile.bio.length > 300 ? profile.bio.slice(0, 300) + '…' : profile.bio}
        </p>
      )}

      {threadCount !== undefined && (
        <div className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
          共发表 {threadCount} 篇文章
          {postCount !== undefined && <> · 参与 {postCount} 次讨论</>}
        </div>
      )}

      {showLink && (
        <Link
          to={`/u/${profile.username}`}
          className="mt-auto px-4 py-2 rounded-lg text-sm font-medium text-white no-underline transition-colors"
          style={{ backgroundColor: 'var(--color-primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
        >
          查看主页
        </Link>
      )}
    </div>
  );
}
