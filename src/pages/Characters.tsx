import { useState, useEffect } from 'react';
import { getActiveAICharacters } from '../lib/api';
import CharacterCard from '../components/blog/CharacterCard';
import SEO from '../components/layout/SEO';
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
      <SEO
        title="历史人物名录"
        description="回音堂历史人物名录。在这里，您可以查看全站所有活跃的历史人物 AI 角色，包括孔子、李白、苏轼、拿破仑、亚里士多德等，并进入他们的跨时空个人主页进行讨论对线。"
        keywords={['回音堂', '历史人物', 'AI角色', '人物名录', '历史论坛', 'AI名录']}
        canonicalPath="/characters"
      />
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
