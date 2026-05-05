import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import { adminGetAllCharacters, adminUpdateCharacter } from '../../lib/api';
import AdminGuard from '../../components/layout/AdminGuard';
import type { AICharacter } from '../../lib/types';

export default function CharacterEdit() {
  const { id } = useParams<{ id: string }>();
  const [char, setChar] = useState<(AICharacter & { username?: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Editable fields
  const [bio, setBio] = useState('');
  const [personality, setPersonality] = useState('');
  const [comedy, setComedy] = useState('');
  const [style, setStyle] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    adminGetAllCharacters().then((list) => {
      const found = list.find((c: any) => c.id === id);
      if (found) {
        setChar(found as unknown as AICharacter & { username?: string });
        setBio((found as unknown as { bio?: string }).bio || '');
        setPersonality(found.personality_prompt || '');
        setComedy(found.comedy_notes || '');
        setStyle(found.writing_style || '');
        setActive(found.is_active);
      }
      setIsLoading(false);
    });
  }, [id]);

  async function handleSave() {
    if (!char) return;
    setSaving(true);
    setMsg('');
    try {
      await adminUpdateCharacter(char.id, {
        personality_prompt: personality,
        comedy_notes: comedy,
        writing_style: style,
        is_active: active,
        bio,
      });
      setMsg('保存成功');
    } catch (err: unknown) {
      setMsg('保存失败: ' + ((err as Error).message || '未知错误'));
    }
    setSaving(false);
  }

  const FIELD_STYLE: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
    outline: 'none', fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
  };

  return (
    <AdminGuard>
      <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
        <Link to="/admin/characters" className="flex items-center gap-1 text-sm no-underline mb-4 hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={14} /> 返回角色列表
        </Link>

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : !char ? (
          <div className="text-center py-12">角色未找到</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">编辑：{(char as unknown as { username?: string }).username}</h1>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
                  启用
                </label>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Save size={14} /> {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            {msg && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{
                backgroundColor: msg.includes('失败') ? '#FDEDED' : '#E8F5E9',
                color: msg.includes('失败') ? 'var(--color-danger)' : 'var(--color-success)',
              }}>{msg}</div>
            )}

            <div className="rounded-lg p-5 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
              <div>
                <label className="block text-sm font-medium mb-1">简介 (bio)</label>
                <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} style={FIELD_STYLE} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">人格提示词 (personality_prompt)</label>
                <textarea rows={5} value={personality} onChange={e => setPersonality(e.target.value)} style={FIELD_STYLE} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">喜剧方向 (comedy_notes)</label>
                <textarea rows={4} value={comedy} onChange={e => setComedy(e.target.value)} style={FIELD_STYLE} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">语言风格 (writing_style)</label>
                <textarea rows={3} value={style} onChange={e => setStyle(e.target.value)} style={FIELD_STYLE} />
              </div>

            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
