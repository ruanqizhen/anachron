import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface AdminListItemProps {
  avatarName: string;
  avatarUrl?: string | null;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  editLink?: string;
  isEditing?: boolean;
  editForm?: React.ReactNode;
}

export default function AdminListItem({
  avatarName,
  avatarUrl,
  title,
  subtitle,
  actions,
  onEdit,
  onDelete,
  editLink,
  isEditing,
  editForm
}: AdminListItemProps) {
  if (isEditing) {
    return (
      <div 
        className="rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
        style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-primary)' }}
      >
        {editForm}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md group"
      style={{ 
        backgroundColor: 'var(--color-card-bg)', 
        border: '1px solid var(--color-border)',
      }}
    >
      <Avatar name={avatarName} url={avatarUrl} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {actions}
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-2 rounded-lg cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)] transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            title="编辑"
          >
            <Pencil size={16} />
          </button>
        )}
        {editLink && (
          <Link
            to={editLink}
            className="p-2 rounded-lg cursor-pointer border-none bg-transparent hover:bg-[var(--color-page-bg)] transition-colors no-underline flex items-center justify-center"
            style={{ color: 'var(--color-text-secondary)' }}
            title="编辑"
          >
            <Pencil size={16} />
          </Link>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-lg cursor-pointer border-none bg-transparent hover:bg-[var(--color-danger-bg)] transition-colors"
            style={{ color: 'var(--color-danger)' }}
            title="删除"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
