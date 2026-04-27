# statthus-cms

Selbst-gehostetes Tina CMS für die staTThus-Website. Editoren melden sich mit Email/Passwort an, Inhaltsänderungen werden direkt ins [statthus-website](https://github.com/statthus-husum/statthus-website)-Repo committet.

## Architektur (Zielzustand)

```
        Bewohner:in
            │
            ▼
   autor.statthus.de
            │
       ┌────┴────┐
       │  Caddy  │  Auto-TLS via Let's Encrypt
       └────┬────┘
            │
   ┌────────┴────────┐
   │  Tina Backend   │  Next.js, Auth.js (Email/PW), GraphQL-API
   │   + Admin UI    │
   └─┬────────────┬──┘
     │            │
     │            ▼
     │      ┌──────────┐
     │      │ MongoDB  │  User-Accounts
     │      └──────────┘
     │
     ▼ commits via GitHub API
   github.com/statthus-husum/statthus-website
            │
            ▼ GitHub Action
   statthus-husum.github.io/statthus-website
```

## Status

**Phase 1 (jetzt):** Nur Caddy läuft, validiert TLS + DNS + Stack-Lifecycle. Antwort auf `https://autor.statthus.de` ist ein Platzhalter-Text.

**Phase 2 (folgt):**
- Tina Next.js Backend mit Auth.js (Credentials Provider, Email/PW)
- MongoDB für User-Accounts
- `tina/config.ts` mit Schema für Events, News, People, Themen-Intros
- GitHub-PAT als `GITHUB_PERSONAL_ACCESS_TOKEN`-Env für Commit-Operationen
- Erste Userin (du) anlegen via CLI-Skript

## Lokale Entwicklung (Phase 1)

```bash
cp .env.example .env
$EDITOR .env   # CMS_DOMAIN auf z.B. cms.local setzen, dann ein Hosts-Eintrag
docker compose up
```

Lokal kein Let's Encrypt — Caddy fällt auf selbstsigniertes Zert zurück bei nicht-öffentlichen Domains.

## Deployment

Wird von [statthus-infra](https://github.com/statthus-husum/statthus-infra) per OpenTofu+cloud-init betrieben:
1. VM startet
2. Cloud-init klont dieses Repo nach `/opt/cms`
3. Schreibt `.env` mit produktivem `CMS_DOMAIN`
4. Startet via systemd-Unit `statthus-cms.service` → `docker compose up -d`

Updates am Stack auf dem Server:
```bash
ssh root@<server-ip>
cd /opt/cms
git pull
docker compose pull
docker compose up -d
```

## Aufbau

| Datei | Zweck |
|---|---|
| `docker-compose.yml` | Stack-Definition |
| `Caddyfile` | Reverse-Proxy + Auto-TLS |
| `.env.example` | dokumentierte Env-Variablen |
| _Phase 2:_ `app/` | Tina Next.js Anwendung |
| _Phase 2:_ `tina/config.ts` | Content-Schema |
