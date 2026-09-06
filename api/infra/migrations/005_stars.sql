-- Starring is per-user, not a property of the resource. A file someone shared
-- with you can sit in your Starred list without touching the owner's view, so
-- this is a join table keyed by (user, resource) rather than a boolean column
-- on files/folders.
--
-- resource_id is polymorphic and carries no foreign key, matching the shares
-- table. The check constraint keeps resource_type honest.
create table stars (
  user_id       uuid not null references users(id) on delete cascade,
  resource_type text not null check (resource_type in ('file','folder')),
  resource_id   uuid not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, resource_type, resource_id)
);

-- The composite primary key already serves the "is this one starred" lookup.
-- This covers the other direction: "everything I starred, newest first",
-- which is the Starred view's only query.
create index stars_user_idx on stars(user_id, created_at desc);

alter table stars enable row level security;
