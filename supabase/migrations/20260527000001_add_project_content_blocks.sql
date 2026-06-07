-- Project document links are stored in `projects.documents` (jsonb).
-- This migration is kept for older setups that used content_blocks; safe no-op if column exists.

alter table public.projects
add column if not exists documents jsonb null;
