import PostEditorDialog from './PostEditorDialog';

interface EditDialogProps {
  title?: string;
  content: string;
  boardId?: string;
  isThread?: boolean;
  onSave: (title: string | undefined, content: string, boardId?: string) => Promise<void>;
  onClose: () => void;
}

export default function EditDialog({ title, content, boardId, isThread, onSave, onClose }: EditDialogProps) {
  return (
    <PostEditorDialog
      mode="edit"
      isThread={isThread}
      initialTitle={title}
      initialContent={content}
      initialBoardId={boardId}
      onSave={async (data) => {
        await onSave(data.title, data.content, data.boardId);
      }}
      onClose={onClose}
    />
  );
}
