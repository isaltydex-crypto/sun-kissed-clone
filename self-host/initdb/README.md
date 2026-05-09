# initdb/

`zz-app-schema.sql` creates the app's `public` tables. The `zz-` prefix makes
it run **after** the supabase/postgres image's own init scripts (which create
`supabase_admin` and other internal roles). Don't rename it back to `00-`
or it will fail with `role "supabase_admin" does not exist`.

To import data from a previous host, drop a `zz-99-import.sql` next to it —
files run alphabetically, so this loads after the schema.

Files in this folder are ignored on subsequent boots — Postgres only runs
them when the data volume is empty.
