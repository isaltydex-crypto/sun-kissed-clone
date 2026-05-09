# Uptime monitoring

The app exposes a public health endpoint at `/api/public/health` that returns
HTTP 200 + JSON when the app and database are reachable.

## Quick option: UptimeRobot (free)
1. Sign up at https://uptimerobot.com
2. New monitor → HTTP(s) → `https://peptivalabgroup.com/api/public/health`
3. Interval 5 min, alert by email/SMS.

## Self-hosted option: Uptime Kuma
Add to docker-compose.yml on the same VPS or another host:

```yaml
  kuma:
    image: louislam/uptime-kuma:1
    restart: always
    volumes: [kuma-data:/app/data]
    ports: ["3001:3001"]
```

Then point a monitor at `https://peptivalabgroup.com/api/public/health`.
