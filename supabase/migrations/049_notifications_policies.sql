-- Migration 049: Notifications Update and Delete Policies

-- Add UPDATE policy for notifications so users can mark their own notifications as read
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Add DELETE policy for notifications so users can delete/clear their own notifications
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE
  USING (auth.uid() = recipient_id);
