import { useState, useEffect } from 'react';
import { ShieldOff } from 'lucide-react';
import { getBlockedIps, resetBlockedIp } from '../../lib/api';
import AdminGuard from '../../components/layout/AdminGuard';

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string | null;
  risk_score: number;
  blocked_until: string | null;
  created_at: string;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return new Date(d).toLocaleDateString('zh-CN');
}

export default function IpRisks() {
  const [ips, setIps] = useState<BlockedIp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    const data = await getBlockedIps();
    setIps(data as BlockedIp[]);
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleReset(ip: BlockedIp) {
    setResetting(ip.id);
    try {
      await resetBlockedIp(ip.id);
      await load();
    } catch { /* ignore */ }
    setResetting(null);
  }

  return (
    <AdminGuard>
      <div className="max-w-[900px] mx-auto px-4 pt-[72px] pb-8">
        <h1 className="text-xl font-bold mb-2">高风险 IP 管理</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          共 {ips.length} 个高风险 IP
        </p>

        {isLoading ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : ips.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            暂无高风险 IP
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ips.map((ip) => (
              <div
                key={ip.id}
                className="rounded-lg p-4 flex items-center justify-between gap-4"
                style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {ip.ip_address}
                    </code>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: ip.risk_score >= 10 ? '#FDEDED' : '#FFF3E0',
                        color: ip.risk_score >= 10 ? 'var(--color-danger)' : '#E65100',
                      }}
                    >
                      风险 {ip.risk_score}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    标记于 {timeAgo(ip.created_at)}
                    {ip.reason && <> · {ip.reason}</>}
                    {ip.blocked_until && <> · 封禁至 {new Date(ip.blocked_until).toLocaleString('zh-CN')}</>}
                  </div>
                </div>
                <button
                  onClick={() => handleReset(ip)}
                  disabled={resetting === ip.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer border-none disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <ShieldOff size={12} />
                  {resetting === ip.id ? '重置中...' : '重置'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
