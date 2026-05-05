import { useState, useEffect } from 'react';
import { Shield, Check, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { adminGetPendingReports, adminResolveReport } from '../../lib/api';
import type { Report } from '../../lib/types';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      setIsLoading(true);
      try {
        const data = await adminGetPendingReports();
        setReports(data as Report[]);
      } catch (err) {
        console.error('Failed to load reports:', err);
      }
      setIsLoading(false);
    }
    loadReports();
  }, []);

  async function handleResolve(id: string, status: 'resolved' | 'dismissed') {
    try {
      await adminResolveReport(id, status);
      setReports(reports.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to resolve report:', err);
      alert('处理失败');
    }
  }

  if (isLoading) {
    return <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>;
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold m-0">举报处理</h1>
          <p className="text-sm m-0 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            处理来自社区用户的违规内容举报
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {reports.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            <AlertTriangle size={32} className="mx-auto mb-3 opacity-50" />
            <p>目前没有待处理的举报，天下太平！</p>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.id} className="rounded-xl p-5 border" style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      举报人: {report.reporter_username}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                      {report.reason}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    时间: {new Date(report.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolve(report.id, 'resolved')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    <Check size={14} /> 已处理
                  </button>
                  <button
                    onClick={() => handleResolve(report.id, 'dismissed')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    <X size={14} /> 驳回
                  </button>
                </div>
              </div>

              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-page-bg)' }}>
                <div className="text-xs font-semibold mb-2 flex items-center justify-between" style={{ color: 'var(--color-text-muted)' }}>
                  <span>被举报内容 ({report.target_type === 'thread' ? '文章' : '评论'})</span>
                  {report.target_type === 'thread' && (
                    <a href={`/b/all/t/${report.target_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
                      去现场看看 <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="opacity-80">
                  <MarkdownRenderer content={report.target_content || '未知内容'} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
