import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { createReport } from '../../lib/api';

interface ReportDialogProps {
  targetType: 'thread' | 'post';
  targetId: string;
  reporterId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  '垃圾广告信息',
  '涉嫌违规或敏感内容',
  '恶意人身攻击/引战',
  '内容不符合板块主题',
  '其他'
];

export default function ReportDialog({ targetType, targetId, reporterId, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalReason = reason === '其他' ? customReason.trim() : reason;
    if (!finalReason) {
      setErrorMsg('请填写举报原因');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await createReport({
        targetType,
        targetId,
        reporterId,
        reason: finalReason
      });
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || '提交失败');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--color-card-bg)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />
            提交举报
          </h2>
          <button onClick={onClose} className="p-1 rounded-full cursor-pointer bg-transparent border-none hover:bg-[var(--color-page-bg)]">
            <X size={20} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center text-green-600 font-medium">
            举报已提交，管理员将尽快处理
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>举报原因</label>
              <div className="flex flex-col gap-2">
                {REPORT_REASONS.map(r => (
                  <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="cursor-pointer"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {reason === '其他' && (
              <div>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="请详细描述举报原因（必填）"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{
                    backgroundColor: 'var(--color-page-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>
            )}

            {errorMsg && (
              <div className="text-sm text-red-500">{errorMsg}</div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none bg-transparent transition-colors hover:bg-[var(--color-page-bg)]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none transition-colors opacity-90 hover:opacity-100 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-danger)' }}
              >
                {isSubmitting ? '提交中...' : '提交'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
