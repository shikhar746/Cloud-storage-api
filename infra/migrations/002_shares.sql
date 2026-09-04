create table shares (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('file','folder')),
  resource_id uuid not null,
  grantee_user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('viewer','editor')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  unique(resource_type, resource_id, grantee_user_id)
);

create index shares_resource_idx on shares(resource_type, resource_id);
create index shares_grantee_idx on shares(grantee_user_id);