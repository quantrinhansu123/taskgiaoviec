-- Quyền truy cập: admin | worker
alter table public.users
add column if not exists access_role text null default 'worker';

comment on column public.users.access_role is 'admin = toàn quyền, worker = thợ hiện trường';

-- Đảm bảo projects.content_blocks tồn tại (GPS, chấm công, lịch đội)
alter table public.projects
add column if not exists content_blocks jsonb null;
