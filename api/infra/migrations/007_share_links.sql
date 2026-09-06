-- Public share links: access granted by holding a URL, with no account.
--
-- Separate from `shares`, which grants access to a known user. The two answer
-- different questions ("who may see this" vs "what does this link open") and
-- share no columns beyond the polymorphic resource pair.
create table share_links (
  id            uuid primary key default gen_random_uuid(),
  -- the bearer credential itself. Unique, and indexed by that constraint,
  -- because every public request looks the row up by exactly this value.
  token         text not null unique,
  resource_type text not null check (resource_type in ('file','folder')),
  resource_id   uuid not null,
  created_by    uuid not null references users(id) on delete cascade,
  -- bcrypt, never the password itself. Null means the link needs no password.
  password_hash text,
  -- null means the link does not expire
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  -- lets an owner see whether a link they forgot about is actually in use
  last_used_at  timestamptz
);

-- "what links exist for this file" — the owner-side list in the share modal
create index share_links_resource_idx on share_links(resource_type, resource_id);

-- "every link I created", for a future management screen
create index share_links_creator_idx on share_links(created_by);

alter table share_links enable row level security;
