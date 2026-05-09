# initdb/

Drop a Postgres dump file here named `01-import.sql` (or any `.sql` /
`.sql.gz`) and it will be auto-loaded on the **first** Postgres startup.

If migrating from a previous host, export the database as SQL and save it to
`self-host/initdb/01-import.sql`.

Files in this folder are ignored on subsequent boots — Postgres only runs
them when the data volume is empty.
