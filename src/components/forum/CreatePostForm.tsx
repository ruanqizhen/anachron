import { useState } from 'react';
import { createThread, createGuestSession, getProfileByUsername, createNotification, canCreateThread } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { parseMentions } from '../../lib/mentions';
import GuestNameDialog from './GuestNameDialog';
import PostEditorDialog from './PostEditorDialog';

interface CreatePostFormProps {
  onClose: () => void;
  onCreated?: () => void;
  defaultBoardSlug?: string;
}

export default function CreatePostForm({ onClose, onCreated, defaultBoardSlug }: CreatePostFormProps) {
  const { user, guest, startGuestSession, impersonating } = useAuth();
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

  const isLoggedIn = !!user;

  async function doSubmit(data: any) {
    const effectiveGuestName = guest?.username || null;
    
    const rateCheck = canCreateThread(!isLoggedIn);
    if (!rateCheck.ok) {
      throw new Error(`发言过于频繁，请等 ${rateCheck.wait} 秒后再试`);
    }

    // Create guest session in DB if posting as guest
    let guestId: string | undefined;
    if (!user && effectiveGuestName) {
      guestId = await createGuestSession(effectiveGuestName);
    }

    const newThread = await createThread({
      boardId: data.boardId,
      title: data.title,
      content: data.content,
      authorId: impersonating?.profileId || user?.id,
      guestId,
      turnstileToken: data.turnstileToken,
      createdAt: data.createdAt,
    });

    // Notify @mentioned users
    const mentionedUsernames = parseMentions(data.title + ' ' + data.content);
    for (const mentionedName of mentionedUsernames) {
      const profile = await getProfileByUsername(mentionedName);
      if (profile && profile.id !== user?.id) {
        await createNotification({
          recipientId: profile.id,
          type: 'mention',
          actorId: user?.id,
          threadId: newThread.id,
        }).catch(() => { /* ignore */ });
      }
    }

    onCreated?.();
    onClose();
  }

  return (
    <>
      <PostEditorDialog
        mode="create"
        isThread={true}
        defaultBoardSlug={defaultBoardSlug}
        onSave={async (data) => {
          if (!isLoggedIn && !guest) {
            setPendingData(data);
            setShowGuestDialog(true);
            throw new Error('please_login');
          }
          await doSubmit(data);
        }}
        onClose={onClose}
      />

      {showGuestDialog && (
        <GuestNameDialog
          onConfirm={(name) => {
            setShowGuestDialog(false);
            startGuestSession(name);
            // After setting guest name, user can click "Publish" again
          }}
          onClose={() => setShowGuestDialog(false)}
        />
      )}
    </>
  );
}
