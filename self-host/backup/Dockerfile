FROM alpine:3.20

# wget is used by notify.sh to POST alerts to the app's internal endpoint.
RUN apk add --no-cache postgresql16-client tzdata dcron findutils coreutils gnupg rclone wget

COPY backup.sh         /usr/local/bin/backup.sh
COPY decrypt.sh        /usr/local/bin/decrypt.sh
COPY rotate-keys.sh    /usr/local/bin/rotate-keys.sh
COPY verify-backup.sh  /usr/local/bin/verify-backup.sh
COPY notify.sh         /usr/local/bin/notify.sh
COPY run-with-alert.sh /usr/local/bin/run-with-alert.sh
COPY entrypoint.sh     /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh \
             /usr/local/bin/decrypt.sh \
             /usr/local/bin/rotate-keys.sh \
             /usr/local/bin/verify-backup.sh \
             /usr/local/bin/notify.sh \
             /usr/local/bin/run-with-alert.sh \
             /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
