-- Migration: full schema sync
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ─── jm_users ────────────────────────────────────────────────────────────────
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS work_types   text[]  DEFAULT '{}';
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS push_token   text;
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS bio          text;
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS avg_rating   numeric DEFAULT 0;
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS rating_count int     DEFAULT 0;
ALTER TABLE jm_users ADD COLUMN IF NOT EXISTS password     text    DEFAULT '';

-- ─── jm_vacancies ────────────────────────────────────────────────────────────
ALTER TABLE jm_vacancies ADD COLUMN IF NOT EXISTS work_type       text;
ALTER TABLE jm_vacancies ADD COLUMN IF NOT EXISTS work_type_label text;

-- ─── jm_perm_vacancies ───────────────────────────────────────────────────────
ALTER TABLE jm_perm_vacancies ADD COLUMN IF NOT EXISTS work_type text;

-- ─── jm_likes ────────────────────────────────────────────────────────────────
ALTER TABLE jm_likes ADD COLUMN IF NOT EXISTS worker_confirmed   boolean DEFAULT false;
ALTER TABLE jm_likes ADD COLUMN IF NOT EXISTS employer_confirmed boolean DEFAULT false;
ALTER TABLE jm_likes ADD COLUMN IF NOT EXISTS worker_rated       boolean DEFAULT false;
ALTER TABLE jm_likes ADD COLUMN IF NOT EXISTS employer_rated     boolean DEFAULT false;
ALTER TABLE jm_likes ADD COLUMN IF NOT EXISTS shift_completed    boolean DEFAULT false;
ALTER TABLE jm_likes ADD COLUMN IF NOT EXISTS matched_at         timestamptz;

-- ─── jm_perm_saved ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jm_perm_saved (
  user_id    text        NOT NULL,
  vacancy_id text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, vacancy_id)
);

-- ─── jm_saved ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jm_saved (
  user_id    text NOT NULL,
  vacancy_id text NOT NULL,
  PRIMARY KEY (user_id, vacancy_id)
);

-- ─── jm_complaints ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jm_complaints (
  id               text        PRIMARY KEY,
  reporter_id      text        NOT NULL,
  reporter_phone   text,
  reporter_company text,
  target_id        text        NOT NULL,
  target_phone     text,
  target_company   text,
  complaint_type   text        NOT NULL,
  description      text,
  created_at       timestamptz DEFAULT now()
);

-- ─── jm_ratings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jm_ratings (
  id          text        PRIMARY KEY,
  from_user_id text       NOT NULL,
  to_user_id  text        NOT NULL,
  vacancy_id  text,
  like_id     text,
  rating      numeric     NOT NULL,
  role        text        NOT NULL,
  review_text text,
  created_at  timestamptz DEFAULT now()
);
