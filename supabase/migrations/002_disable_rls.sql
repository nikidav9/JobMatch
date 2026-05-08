-- Migration: disable RLS on all app tables
-- App uses custom phone/password auth, not Supabase Auth.
-- RLS with auth.uid() checks won't work here — disable it.
-- Run in Supabase SQL Editor → "Run without RLS"

ALTER TABLE jm_users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_vacancies        DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_perm_vacancies   DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_likes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_chats            DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_messages         DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_saved            DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_perm_saved       DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_perm_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_complaints       DISABLE ROW LEVEL SECURITY;
ALTER TABLE jm_ratings          DISABLE ROW LEVEL SECURITY;
