-- Add direct assignee storage for projects
alter table public.projects
add column if not exists assignees text[] null;
