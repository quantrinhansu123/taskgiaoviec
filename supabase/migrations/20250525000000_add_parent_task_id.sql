-- Sub-task: công việc con lồng trong task cha (cùng feature_id)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks (task_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_feature_root ON tasks (feature_id) WHERE parent_task_id IS NULL;

COMMENT ON COLUMN tasks.parent_task_id IS 'Task cha; NULL = công việc gốc trong hạng mục';
