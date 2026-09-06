-- Auto-purge needs to know WHEN something was trashed. `is_deleted` is a
-- boolean and cannot express a retention window, so record the moment.
alter table files   add column if not exists deleted_at timestamptz;
alter table folders add column if not exists deleted_at timestamptz;

-- Anything already in the trash predates this column. Backfill from the last
-- time the row was touched, which for a trashed row is the deletion itself.
-- Without this, existing trash has a null deleted_at and would either never
-- expire or expire instantly, depending on how the comparison is written.
update files
   set deleted_at = coalesce(updated_at, created_at, now())
 where is_deleted = true and deleted_at is null;

update folders
   set deleted_at = coalesce(updated_at, created_at, now())
 where is_deleted = true and deleted_at is null;

-- The purge only ever scans deleted rows ordered by age, so a partial index
-- keeps it off the live rows entirely.
create index if not exists files_deleted_at_idx
  on files(deleted_at) where is_deleted = true;

create index if not exists folders_deleted_at_idx
  on folders(deleted_at) where is_deleted = true;
