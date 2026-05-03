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
  const [rivals, setRivals] = useState('');
  const [boards, setBoards] = useState('');
  const [topics, setTopics] = useState('');
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('deepseek-v4-pro');
  const [limit, setLimit] = useState(20);
  const [active, setActive] = useState(true);

  useEffect(() => {
    adminGetAllCharacters().then((list) => {
      const found = list.find((c: any) => c.id === id);
      if (found) {
        setChar(found as any);
        setBio((found as any).bio || '');
        setPersonality(found.personality_prompt || '');
        setComedy(found.comedy_notes || '');
        setStyle(found.writing_style || '');
        setRivals((found.rival_character_ids || []).join(', '));
        setBoards((found.preferred_boards || []).join(', '));
        setTopics((found.preferred_topics || []).join(', '));
        setProvider(found.model_provider || 'deepseek');
        setModel(found.model_name || 'deepseek-v4-pro');
        setLimit(found.daily_reply_limit || 20);
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
        rival_character_ids: rivals.split(',').map(s => s.trim()).filter(Boolean),
        preferred_boards: boards.split(',').map(s => s.trim()).filter(Boolean),
        preferred_topics: topics.split(',').map(s => s.trim()).filter(Boolean),
        model_provider: provider,
        model_name: model,
        daily_reply_limit: limit,
        is_active: active,
        bio,
      });
      setMsg('保存成功');
    } catch (err: any) {
      setMsg('保存失败: ' + (err.message || '未知错误'));
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
              <h1 className="text-xl font-bold">编辑：{(char as any).username}</h1>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">宿敌角色ID (逗号分隔)</label>
                  <input value={rivals} onChange={e => setRivals(e.target.value)} style={FIELD_STYLE} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">倾向版块 (逗号分隔)</label>
                  <input value={boards} onChange={e => setBoards(e.target.value)} style={FIELD_STYLE} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">倾向话题 (逗号分隔)</label>
                <input value={topics} onChange={e => setTopics(e.target.value)} style={FIELD_STYLE} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">模型提供商</label>
                  <select value={provider} onChange={e => setProvider(e.target.value)} style={FIELD_STYLE}>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">模型名称</label>
                  <input value={model} onChange={e => setModel(e.target.value)} style={FIELD_STYLE} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">每日回复上限</label>
                  <input type="number" min={0} max={100} value={limit} onChange={e => setLimit(Number(e.target.value))} style={FIELD_STYLE} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
