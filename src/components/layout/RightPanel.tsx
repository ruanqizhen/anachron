import { Link } from 'react-router-dom';
import { mockBoards, mockCharacters, mockProfiles } from '../../lib/mockData';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

export default function RightPanel() {
  const aiProfiles = mockProfiles.filter(p => p.is_ai_character);

  return (
    <aside className="hidden lg:block w-[280px] shrink-0">
      <div className="sticky top-[72px] flex flex-col gap-4">
        {/* Board navigation */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            版块导航
          </div>
          <div className="py-1">
            {mockBoards.map((board) => (
              <Link
                key={board.slug}
                to={`/b/${board.slug}`}
                className="flex items-center gap-2.5 px-4 py-2 text-sm no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span className="text-base">{board.icon}</span>
                <span>{board.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Active AI Characters */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            活跃 AI 角色
          </div>
          <div className="py-2">
            {mockCharacters.filter(c => c.is_active).map((char) => {
              const profile = aiProfiles.find(p => p.id === char.profile_id);
              if (!profile) return null;
              return (
                <Link
                  key={char.id}
                  to={`/u/${profile.username}`}
                  className="flex items-center gap-2.5 px-4 py-2 no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                >
                  <Avatar name={profile.display_name} url={profile.avatar_url} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      <span className="truncate">{profile.display_name}</span>
                      <Badge type="verified" />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {char.era}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
