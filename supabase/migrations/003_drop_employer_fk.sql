-- Migration: remove employer_id FK constraints
-- App manages user references in code; DB-level FK caused insert failures
-- when user record wasn't yet synced to jm_users.

ALTER TABLE jm_vacancies      DROP CONSTRAINT IF EXISTS jm_vacancies_employer_id_fkey;
ALTER TABLE jm_perm_vacancies DROP CONSTRAINT IF EXISTS jm_perm_vacancies_employer_id_fkey;
