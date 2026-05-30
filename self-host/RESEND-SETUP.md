# Resend SMTP — setup-guide

Den här guiden tar dig från ett nyskapat Resend-konto till fungerande mail
från VPS:en (kontaktformulär, NOWPayments-notiser, backup-larm).

Du behöver **inte** röra Brevo längre. När Resend funkar kan du ta bort
Brevo-DNS:en helt.

---

## 1. Lägg till och verifiera din domän hos Resend

1. Logga in på <https://resend.com/domains>
2. Klicka **Add Domain** → skriv `peptivalabgroup.com` → **Add**
3. Resend visar 3–4 DNS-poster som ska in i din DNS-zon hos OrangeWebsite/TopDNS:
   - 1× `MX` på en subdomän (`send.peptivalabgroup.com`)
   - 1× `TXT` SPF på samma subdomän
   - 1× `TXT` DKIM (lång sträng som börjar med `p=...`) på
     `resend._domainkey.peptivalabgroup.com`
   - Valfritt: 1× `TXT` DMARC på `_dmarc.peptivalabgroup.com`

   > **Viktigt:** lägg in dem exakt som Resend visar. Region (`send`,
   > `eu-send` etc.) kan variera — kopiera värdena rakt av.

4. Lägg in posterna i TopDNS-panelen (samma ställe där du försökte med Brevo).
5. Tillbaka i Resend → klicka **Verify DNS Records**. Det brukar gå på
   minuter — max några timmar.

Om verifieringen inte går igenom: kör samma trick som vi gjorde med Brevo
och fråga TopDNS direkt:

```bash
dig +short TXT resend._domainkey.peptivalabgroup.com @ns-usa.topdns.com
dig +short MX  send.peptivalabgroup.com              @ns-usa.topdns.com
```

Om de raderna är tomma så ligger inte posterna i zonen — då är det panelen
som strular, inte Resend.

---

## 2. Skapa en API-key / SMTP-credential

Resend stödjer både egen API och vanlig SMTP. Vi använder **SMTP** så att
befintlig Nodemailer-kod fungerar utan ändringar.

1. <https://resend.com/api-keys> → **Create API Key**
2. Namn: `peptivalab-vps`, Permission: **Sending access**, Domain:
   `peptivalabgroup.com` → **Add**
3. Kopiera nyckeln (visas bara en gång — börjar med `re_...`)

SMTP-uppgifter (samma för alla konton):

| Fält        | Värde                       |
| ----------- | --------------------------- |
| `SMTP_HOST` | `smtp.resend.com`           |
| `SMTP_PORT` | `465` (TLS) eller `587`     |
| `SMTP_USER` | `resend`                    |
| `SMTP_PASS` | din API-key (`re_...`)      |

---

## 3. Uppdatera `.env` på VPS:en

SSH:a in på servern och öppna `self-host/.env`:

```bash
cd ~/peptivalab/self-host       # eller där din checkout ligger
nano .env
```

Byt ut Brevo-blocket mot:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxxxxxx
NOTIFY_EMAIL_FROM=PeptivaLab <noreply@peptivalabgroup.com>
NOTIFY_EMAIL_TO=din@adress.se
NOWPAYMENTS_NOTIFY_TO=din@adress.se
```

> Avsändaradressen (`noreply@peptivalabgroup.com`) måste ligga på domänen
> du verifierade i steg 1, annars vägrar Resend skicka.

Spara, stäng (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 4. Starta om app-containern så att den läser in nya variablerna

```bash
docker compose up -d --build --force-recreate app
```

`--force-recreate` är viktigt — annars sitter de gamla Brevo-värdena kvar
i den körande containern.

---

## 5. Verifiera att det funkar

Kör samma diagnostik-script vi redan har:

```bash
./troubleshoot/check-email.sh
```

Det:
- bekräftar att `.env` har alla värden
- bekräftar att docker-compose skickar dem vidare
- bekräftar att containern faktiskt har dem
- kör `transporter.verify()` mot Resend (SMTP-login)
- skickar ett **riktigt testmail** till `NOTIFY_EMAIL_TO`

Får du `SMTP-login fungerar` + `testmail skickades` är du klar. Kolla
inkorgen (och spam första gången).

Du kan också se varje skickat mail under <https://resend.com/emails> —
bra för felsökning om något inte kommer fram.

---

## 6. (Valfritt) Städa bort Brevo

När Resend är verifierat och kontaktformulär + NOWPayments-mail kommer
fram kan du:

1. Ta bort Brevo-posterna i TopDNS (`brevo-code:*`, `brevo1._domainkey`,
   `brevo2._domainkey`, och Brevos del av SPF om du lagt in den).
2. Avsluta Brevo-kontot.

SPF: om du behåller någon annan tjänst som skickar mail, lägg bara
`include:_spf.resend.com` i din TXT-post på roten:

```
v=spf1 include:_spf.resend.com ~all
```

---

## Snabb felsökning

| Symptom                                          | Trolig orsak                                                |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `Invalid login: 535 Authentication failed`       | Fel `SMTP_PASS` — kopiera API-keyn igen, hela `re_...`      |
| `Domain is not verified` i Resend dashboard      | DNS-posterna är inte i zonen — kör `dig` mot TopDNS         |
| Mailet skickas men kommer aldrig fram            | Kolla `https://resend.com/emails` → status + spam-mappen    |
| `check-email.sh` säger att variabler saknas      | Glömt `--force-recreate app` efter `.env`-ändring           |

Free tier: 3 000 mail/månad, 100/dag. Mer än nog för kontaktformulär +
order-notiser.
