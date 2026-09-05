create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  image_url text,
  created_at timestamptz not null default now()
);

alter table users enable row level security;

create table folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references users(id) on delete cascade,
  parent_id uuid references folders(id) on delete cascade,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index folders_unique_name_per_parent
  on folders(owner_id, parent_id, name)
  where is_deleted = false;

alter table folders enable row level security;

create table files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_key text unique not null,
  owner_id uuid not null references users(id) on delete cascade,
  folder_id uuid references folders(id) on delete cascade,
  checksum text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index files_owner_id_idx on files(owner_id);
create index files_folder_id_idx on files(folder_id);

alter table files enable row level security;