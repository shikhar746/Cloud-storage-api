-- Google sign-in: an account created through Google has no password of its own,
-- so password_hash can no longer be required.
alter table users alter column password_hash drop not null;

-- Google's stable subject claim ("sub"). Nullable: password accounts never get one.
alter table users add column google_id text;

create unique index users_google_id_key on users(google_id) where google_id is not null;
