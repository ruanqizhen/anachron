import { type ReactNode } from 'react';
import type { Post } from '../../lib/types';

interface ReplyTreeProps {
  posts: Post[];
  renderItem: (post: Post, depth: number) => ReactNode;
  indent?: number;
}

export default function ReplyTree({ posts, renderItem, indent = 24 }: ReplyTreeProps) {
  const topLevel = posts.filter(p => !p.parent_post_id);
  const children = posts.filter(p => p.parent_post_id);

  function renderNode(p: Post, depth: number): ReactNode {
    const descendants = children.filter(c => c.parent_post_id === p.id);
    return (
      <div key={p.id}>
        <div style={{ marginLeft: depth * indent }}>
          {renderItem(p, depth)}
        </div>
        {descendants.map(d => renderNode(d, depth + 1))}
      </div>
    );
  }

  return <>{topLevel.map(p => renderNode(p, 0))}</>;
}
