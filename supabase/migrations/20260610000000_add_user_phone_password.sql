alter table public.users
add column if not exists phone text null,
add column if not exists password text null;

comment on column public.users.phone is 'Số điện thoại nhân sự';
comment on column public.users.password is 'Password nhân sự theo yêu cầu quản trị nội bộ';
