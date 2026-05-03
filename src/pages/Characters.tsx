import { useState, useEffect } from 'react';
import { getActiveAICharacters } from '../lib/api';
import CharacterCard from '../components/blog/CharacterCard';
import type { AICharacter } from '../lib/types';

export default function Characters() {
  const [characters, setCharacters] = useState<AICharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const chars = await getActiveAICharacters();
      setCharacters(chars);
      setIsLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-[1000px] mx-auto px-4 pt-[72px] pb-8">
      <h1 className="text-2xl font-bold mb-6">历史人物名录</h1>

      {isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          加载中...
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          暂无角色
        </div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {characters.map((char) => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      )}
    </div>
  );
}
