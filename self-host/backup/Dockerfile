# Tiny image: postgres-client + cron, runs backup.sh on a schedule.
FROM alpine:3.20

RUN apk add --no-cache postgresql16-client tzdata dcron findutils coreutils

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Crontab: every day at 03:17 UTC. Override BACKUP_CRON via env if you want.
# (dcron honors /etc/crontabs/root.)
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
