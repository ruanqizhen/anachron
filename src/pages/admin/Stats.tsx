import { useState, useEffect } from 'react';
import { adminGetDailyStats } from '../../lib/api';
import AdminGuard from '../../components/layout/AdminGuard';

export default function AdminStats() {
  const [stats, setStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminGetDailyStats(7).then(setStats).finally(() => setIsLoading(false));
  }, []);

  // Group by character
  const byChar: Record<string, any[]> = {};
  stats.forEach((s: any) => {
    const name = s.character_name || '未知';
    if (!byChar[name]) byChar[name] = [];
    byChar[name].push(s);
  });

  // Get unique dates
  const dates = [...new Set(stats.map((s: any) => s.date))].sort().reverse() as string[];

  // Colors
  const COLORS = ['#1877F2', '#42B72A', '#F02849', '#FF6900', '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6'];

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <h1 className="text-xl font-bold mb-6">AI 调用量统计</h1>

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无数据</div>
        ) : (
          <div>
            {/* Bar chart */}
            <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
              <h2 className="text-base font-bold mb-4">过去 7 天各角色回复数</h2>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, paddingBottom: 24 }}>
                {dates.map((date) => (
                  <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    {Object.entries(byChar).map(([name, items], ci) => {
                      const item = items.find((s: any) => s.date === date);
                      const count = item ? item.reply_count : 0;
                      const maxVal = Math.max(...stats.map((s: any) => s.reply_count), 1);
                      const h = maxVal > 0 ? (count / maxVal) * 160 : 0;
                      return (
                        <div
                          key={name}
                          title={`${name}: ${count}`}
                          style={{
                            width: 16, height: Math.max(h, count > 0 ? 4 : 1),
                            backgroundColor: count > 0 ? COLORS[ci % COLORS.length] : 'var(--color-border)',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.3s',
                          }}
                        />
                      );
                    })}
                    <span className="text-xs mt-2" style={{ color: 'var(--color-text-muted)', writingMode: 'vertical-rl', fontSize: 10 }}>
                      {date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4">
                {Object.keys(byChar).map((name, i) => (
                  <div key={name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length], display: 'inline-block' }} />
                    {name}
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left px-4 py-3 text-sm font-semibold">日期</th>
                    {Object.keys(byChar).map(name => (
                      <th key={name} className="text-right px-4 py-3 text-sm font-semibold">{name}</th>
                    ))}
                    <th className="text-right px-4 py-3 text-sm font-semibold">合计</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date) => (
                    <tr key={date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-2.5 text-sm">{date}</td>
                      {Object.keys(byChar).map(name => {
                        const item = byChar[name].find((s: any) => s.date === date);
                        return (
                          <td key={name} className="text-right px-4 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {item ? item.reply_count : 0}
                          </td>
                        );
                      })}
                      <td className="text-right px-4 py-2.5 text-sm font-semibold">
                        {Object.values(byChar).reduce((sum, items) => {
                          const item = items.find((s: any) => s.date === date);
                          return sum + (item ? item.reply_count : 0);
                        }, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
