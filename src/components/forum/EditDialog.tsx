import PostEditorDialog from './PostEditorDialog';

interface EditDialogProps {
  title?: string;
  content: string;
  isThread?: boolean;
  onSave: (title: string | undefined, content: string) => Promise<void>;
  onClose: () => void;
}

export default function EditDialog({ title, content, isThread, onSave, onClose }: EditDialogProps) {
  return (
    <PostEditorDialog
      mode="edit"
      isThread={isThread}
      initialTitle={title}
      initialContent={content}
      onSave={async (data) => {
        await onSave(data.title, data.content);
      }}
      onClose={onClose}
    />
  );
}
