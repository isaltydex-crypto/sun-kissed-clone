FROM alpine:3.20

RUN apk add --no-cache postgresql16-client tzdata dcron findutils coreutils gnupg

COPY backup.sh      /usr/local/bin/backup.sh
COPY decrypt.sh     /usr/local/bin/decrypt.sh
COPY rotate-keys.sh /usr/local/bin/rotate-keys.sh
COPY entrypoint.sh  /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh \
             /usr/local/bin/decrypt.sh \
             /usr/local/bin/rotate-keys.sh \
             /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
