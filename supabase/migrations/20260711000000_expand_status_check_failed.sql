-- Allow "failed" / Có lỗi status used by the app UI (mapUiStatus: fail → failed).
-- Existing projects_status_check only allowed pending | in_progress | completed.

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status is null or status in ('pending', 'in_progress', 'completed', 'failed'));

alter table public.features drop constraint if exists features_status_check;
alter table public.features
  add constraint features_status_check
  check (status is null or status in ('pending', 'in_progress', 'completed', 'failed'));

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status is null or status in ('pending', 'in_progress', 'completed', 'failed'));
