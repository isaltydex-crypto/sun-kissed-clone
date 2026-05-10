# Troubleshooting scripts

All diagnostic / troubleshooting scripts live here. Always add new ones to this folder.

Run from `self-host/`:

```bash
bash troubleshoot/check-web-access.sh   # browser can't reach site (DNS/UFW/Caddy/cert)
bash troubleshoot/diag.sh               # full stack health (containers, app, db)
bash troubleshoot/diagnose-app.sh       # app container deep-dive
```

To pull latest on the VPS:

```bash
cd /home/deploy/sun-kissed-clone
git pull
chmod +x self-host/troubleshoot/*.sh
```
