-- Migration: add work_types, push_token, jm_perm_saved
-- Run this in Supabase SQL Editor

-- jm_users: work types array and push token
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS work_types text[] DEFAULT '{}';
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS push_token text;

-- jm_vacancies: work type fields
ALTER TABLE jm_vacancies ADD COLUMN IF NOT EXISTS work_type text;
ALTER TABLE jm_vacancies ADD COLUMN IF NOT EXISTS work_type_label text;

-- jm_perm_vacancies: work type field
ALTER TABLE jm_perm_vacancies ADD COLUMN IF NOT EXISTS work_type text;

-- jm_perm_saved: saved permanent vacancies per worker
CREATE TABLE IF NOT EXISTS jm_perm_saved (
  user_id    text        NOT NULL,
  vacancy_id text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, vacancy_id)
);
