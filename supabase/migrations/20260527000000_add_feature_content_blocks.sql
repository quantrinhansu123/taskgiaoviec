-- Add JSON content blocks to features (for multi-assignees, future extensions)
alter table public.features
add column if not exists content_blocks jsonb null;

