-- Files above the multipart limit are uploaded straight to storage with a signed
-- URL, so the blob lands before any files row exists. This table is the record of
-- keys we handed out: POST /api/files/complete consumes a row, and anything left
-- behind is an upload the client abandoned — a sweeper can delete those blobs.
create table pending_uploads (
  storage_key text primary key,
  owner_id uuid not null references users(id) on delete cascade,
  folder_id uuid references folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index pending_uploads_created_at_idx on pending_uploads(created_at);

alter table pending_uploads enable row level security;
