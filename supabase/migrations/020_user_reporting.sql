-- ============================
-- Anachron: User Reporting System
-- Migration: 020_user_reporting
-- ============================

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- who reported
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_id UUID NOT NULL, -- The ID of the thread or post
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert a report
CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admins can view and update all reports
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RPC for admins to get pending reports
CREATE OR REPLACE FUNCTION admin_get_pending_reports()
RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  target_type TEXT,
  target_id UUID,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  reporter_username TEXT,
  target_content TEXT
) AS $$
BEGIN
  -- We must verify admin status
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.reporter_id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    COALESCE(p.username, '未知用户') AS reporter_username,
    CASE 
      WHEN r.target_type = 'thread' THEN (SELECT title FROM threads WHERE threads.id = r.target_id)
      WHEN r.target_type = 'post' THEN (SELECT content FROM posts WHERE posts.id = r.target_id)
      ELSE '未知内容'
    END AS target_content
  FROM reports r
  LEFT JOIN profiles p ON r.reporter_id = p.id
  WHERE r.status = 'pending'
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for admins to resolve a report
CREATE OR REPLACE FUNCTION admin_resolve_report(p_report_id UUID, p_status TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  UPDATE reports SET status = p_status WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
