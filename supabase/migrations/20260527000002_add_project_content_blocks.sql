-- Completion metadata and extensions for projects (alongside documents)
alter table public.projects
add column if not exists content_blocks jsonb null;
