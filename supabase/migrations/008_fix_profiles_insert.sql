-- Add INSERT policy for profiles (missing from initial migration).
-- Without this, user registration creates an auth account but fails to
-- create the corresponding profiles row, causing 406 errors on login.

CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
