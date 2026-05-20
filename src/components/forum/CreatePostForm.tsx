import { useState } from 'react';
import { createThread, canCreateThread } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import GuestNameDialog from './GuestNameDialog';
import PostEditorDialog from './PostEditorDialog';
import { toast } from '../../lib/toast';

interface CreatePostFormProps {
  onClose: () => void;
  onCreated?: () => void;
  defaultBoardSlug?: string;
}

export default function CreatePostForm({ onClose, onCreated, defaultBoardSlug }: CreatePostFormProps) {
  const { user, guest, startGuestSession } = useAuth();
  const [showGuestDialog, setShowGuestDialog] = useState(!user && !guest);
  const isLoggedIn = !!user;

  async function doSubmit(data: any) {
    const rateCheck = canCreateThread(!isLoggedIn);
    if (!rateCheck.ok) {
      throw new Error(`发言过于频繁，请等 ${rateCheck.wait} 秒后再试`);
    }

    const guestId = data.guestId || guest?.id || undefined;

    await createThread({
      boardId: data.boardId,
      title: data.title,
      content: data.content,
      authorId: data.authorId || (data.guestId ? undefined : user?.id),
      guestId,
      turnstileToken: data.turnstileToken,
      createdAt: data.createdAt,
    });

    toast.success('发布成功！');
    onCreated?.();
  }

  return (
    <>
      {!showGuestDialog && (
        <PostEditorDialog
          mode="create"
          isThread={true}
          defaultBoardSlug={defaultBoardSlug}
          onSave={async (data) => {
            await doSubmit(data);
          }}
          onClose={onClose}
          draftKey={`draft_create_thread_${defaultBoardSlug || 'all'}`}
        />
      )}

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={async (name) => {
            setShowGuestDialog(false);
            await startGuestSession(name);
          }}
          onClose={onClose}
        />
      )}
    </>
  );
}
