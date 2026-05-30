# WireGuard VPN → admin-allowlist

Skydda `/admin` (och `/api/admin/*`) genom att låta Caddy bara svara på
trafik som kommer in via WireGuard-tunneln. För hela internet ser admin-
panelen ut att inte existera (Caddy svarar `404`).

```
[Din laptop / mobil]  --WireGuard (UDP 51820)-->  [VPS]
                                                    |
                                                    v
                                              wg0: 10.13.13.1
                                                    |
                                              Caddy: tillåt /admin
                                              endast från 10.13.13.0/24
```

WireGuard-containern är **inaktiv som default** — den ligger bakom Docker
Compose-profilen `vpn` och startar inte med `docker compose up -d`. Du
sätter på den medvetet när du vill.

---

## 1. Öppna UDP-porten i brandväggen

På VPS:n, en gång:

```bash
sudo ufw allow 51820/udp comment 'WireGuard'
sudo ufw reload
```

Om du har provider-brandvägg (Hetzner Cloud, OrangeWebsite-panel, etc.):
öppna **51820/udp** där också.

---

## 2. Konfigurera och starta containern

Lägg till / justera i `self-host/.env`:

```env
WG_SERVERURL=peptivalabgroup.com   # eller VPS:ns publika IP
WG_SERVERPORT=51820
WG_PEERS=laptop,phone              # ett namn per klient
WG_INTERNAL_SUBNET=10.13.13.0/24
WG_ALLOWEDIPS=10.13.13.0/24        # split-tunnel: bara VPN-nätet
```

Starta:

```bash
cd self-host
docker compose --profile vpn up -d wireguard
docker compose logs -f wireguard   # vänta tills "wg-quick: wg0" är uppe
```

Vid första start genererar containern en peer-config per namn i
`WG_PEERS` och lägger dem i volymen `wg_config` under
`/config/peer_<namn>/`.

---

## 3. Hämta klient-config till din enhet

**Dator (config-fil):**

```bash
docker compose --profile vpn exec wireguard \
  cat /config/peer_laptop/peer_laptop.conf
```

Klistra in i WireGuard-klienten ([Windows / macOS / Linux](https://www.wireguard.com/install/)).

**Mobil (QR-kod):**

```bash
docker compose --profile vpn exec wireguard \
  /app/show-peer peer_phone
```

(Visar QR i terminalen — scanna med WireGuard-appen på iOS/Android.)

Du kan när som helst lägga till fler peers genom att uppdatera `WG_PEERS`
i `.env` och köra `docker compose --profile vpn up -d --force-recreate wireguard`.
Befintliga peers behålls.

---

## 4. Aktivera Caddy-allowlist för admin

I `self-host/Caddyfile`, **avkommentera** blocket märkt
`OPTIONAL: WireGuard-gated admin allowlist` (ligger i
`{$SITE_DOMAIN}, {$WWW_DOMAIN} { ... }`).

Ladda om Caddy:

```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Verifiera (på VPS:n):

```bash
# Med VPN av (din publika IP) → ska vara 404
curl -sI https://peptivalabgroup.com/admin/login | head -n1

# Med VPN på (klient ansluten) → ska vara 200
curl -sI https://peptivalabgroup.com/admin/login | head -n1
```

---

## 5. Kör verifierings-scriptet

```bash
bash self-host/troubleshoot/check-wireguard.sh
```

Det kollar att containern kör, att peers är handskakade, att UFW är öppet,
och att Caddy faktiskt blockerar admin utan VPN.

---

## Vanliga fallgropar

- **`WG_SERVERURL=auto` ger fel IP** på vissa providers. Sätt din publika
  IP eller domän explicit.
- **Klient ansluter men admin är fortfarande 404:** kolla att klienten
  fick `10.13.13.X` (kör `wg show` i klienten). Om den fick något annat
  så har `WG_INTERNAL_SUBNET` ändrats efter peer-generering — radera
  `wg_config`-volymen och kör om steg 2.
- **Du låser ut dig själv:** om du tappar VPN-access har du fortfarande
  SSH till VPS:n. Antingen kommentera tillbaka Caddy-blocket eller
  generera en ny peer-config via SSH.
- **Provider-brandvägg blockerar UDP:** om VPN-klienten inte handskakar
  trots att porten är öppen i UFW, kolla provider-panelens egen
  brandvägg/security group.
