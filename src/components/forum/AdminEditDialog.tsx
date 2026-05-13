import PostEditorDialog from './PostEditorDialog';

interface AdminEditDialogProps {
  title?: string;
  content: string;
  createdAt: string;
  boardId?: string;
  isThread?: boolean;
  onSave: (data: {
    title?: string;
    content: string;
    createdAt?: string;
    boardId?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function AdminEditDialog({
  title, content, createdAt, boardId, isThread, onSave, onClose
}: AdminEditDialogProps) {
  return (
    <PostEditorDialog
      mode="edit"
      isThread={isThread}
      initialTitle={title}
      initialContent={content}
      initialCreatedAt={createdAt}
      initialBoardId={boardId}
      onSave={async (data) => {
        await onSave({
          title: data.title,
          content: data.content,
          createdAt: data.createdAt,
          boardId: data.boardId
        });
      }}
      onClose={onClose}
      title="管理员编辑"
    />
  );
}
