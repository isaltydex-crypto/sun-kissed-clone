-- Assign the configured Postgres password to Supabase internal login roles.
-- This mirrors the official Supabase self-host roles bootstrap script.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH LOGIN PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH LOGIN PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH LOGIN PASSWORD :'pgpass';
ALTER USER supabase_admin WITH LOGIN PASSWORD :'pgpass';