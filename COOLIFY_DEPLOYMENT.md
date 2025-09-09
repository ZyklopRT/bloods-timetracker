# Discord Bot Deployment mit Coolify 🚀

Diese Anleitung zeigt dir, wie du deinen Discord Time Tracker Bot (HTTP Interactions Version) mit Coolify hostest.

## Voraussetzungen

- Server/VPS mit SSH Zugang
- Docker installiert
- Git Repository (GitHub/GitLab/etc.)
- Discord Bot Token, Application ID und Public Key
- Öffentlich erreichbare Domain/URL (für Interactions Endpoint)

## 1. Coolify Installation

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

## 2. Vorbereitung deines Projekts

### Build für Production

```bash
# Nicht mehr nötig!
# HTTP Interactions Version verwendet direkte JavaScript Dateien
# Kein TypeScript Build erforderlich
```

### Git Repository

Stelle sicher, dass alle Dateien committet sind:

```bash
git add .
git commit -m "Add Coolify deployment configuration"
git push origin main
```

## 3. Coolify Setup

### Server hinzufügen

1. Öffne Coolify Dashboard
2. Füge deinen Server hinzu (SSH Verbindung)
3. Teste die Verbindung

### Application erstellen

1. **New Application** → **From Git Repository**
2. Repository URL eingeben
3. Branch: `main`
4. Build Command: Leer lassen (wird im Dockerfile gemacht)
5. Start Command: Leer lassen (wird im Dockerfile gemacht)
6. **Port:** 3001 (HTTP Interactions Port - konfigurierbar über PORT env var)
7. **Domain:** Deine öffentliche URL konfigurieren

### Environment Variables

**WICHTIG für HTTP Interactions:** Füge folgende Environment Variables hinzu:

```env
# ERFORDERLICH - Discord Bot Credentials
TOKEN=dein_discord_bot_token
APPLICATION_ID=deine_discord_application_id
PUBLIC_KEY=dein_discord_public_key

# SERVER KONFIGURATION
PORT=3001
NODE_ENV=production

# DATABASE
DATABASE_PATH=/app/data/timetracker.db

# OPTIONAL - nur für Development/Testing
GUILD_ID=deine_test_guild_id
```

**⚠️ WICHTIG:** HTTP Interactions benötigen **PUBLIC_KEY** und eine **öffentlich erreichbare URL**!

### Volumes für persistente Daten

- **Source Path (Host):** `/var/lib/coolify/data/timetracker`
- **Destination Path (Container):** `/app/data`
- **Type:** Directory mount

## 4. Deployment

1. **Deploy** Button klicken
2. Build Logs überwachen
3. **Commands registrieren:**
   ```bash
   # In Container ausführen oder lokal:
   npm run register
   ```
4. **Discord Interactions Endpoint setzen:**
   - Discord Developer Console → Deine Application
   - **General Information** → **Interactions Endpoint URL**
   - Setze: `https://deine-domain.com/interactions`
   - **Save Changes**
5. Bot Status in Discord überprüfen

## 5. Monitoring

### Health Checks

Coolify überwacht automatisch:

- Container Status (HTTP Health Check: `/health`)
- Memory Usage
- CPU Usage
- Application Logs
- HTTP Response Codes

### Logs einsehen

- Build Logs
- Application Logs
- Error Logs

## 6. Updates

### Automatische Deployments

Konfiguriere Webhooks für automatische Deployments bei Git pushes:

1. **Settings** → **Webhooks**
2. Webhook URL kopieren
3. In GitHub/GitLab Repository Settings einfügen

### Manuelle Updates

```bash
git push origin main
# Automatic deployment via webhook
```

## Troubleshooting

### Bot startet nicht

1. Environment Variables überprüfen (inkl. PUBLIC_KEY)
2. Database Pfad kontrollieren
3. Port verfügbar? (Standard: 3001, konfigurierbar über PORT env var)
4. Docker Container Logs checken
5. Interactions Endpoint erreichbar? (curl https://domain.com/interactions)

### Interactions funktionieren nicht

1. **PUBLIC_KEY korrekt?** (Exakt aus Discord Developer Console kopieren)
2. **Endpoint URL korrekt?** (Muss https://domain.com/interactions sein)
3. **Commands registriert?** (npm run register ausführen)
4. **HTTPS erforderlich** (Discord akzeptiert nur HTTPS Endpoints)

### Database Issues

```bash
# Volume Pfad überprüfen
docker volume ls
docker volume inspect timetracker_data
```

### Memory Issues

- PM2 max_memory_restart auf 500M gesetzt
- Bei Bedarf Server RAM erhöhen

## Vorteile von Coolify

✅ **Einfache Verwaltung** - Web Interface  
✅ **Automatische SSL** - HTTPS Support  
✅ **Git Integration** - Auto-deployments  
✅ **Monitoring** - Logs und Metriken  
✅ **Backup Support** - Database Backups  
✅ **Resource Management** - CPU/Memory Limits  
✅ **Security** - Container Isolation

## Kosten

- **Coolify:** Kostenlos (Open Source)
- **Server:** ~5-10€/Monat (VPS)
- **Domain:** Optional ~10€/Jahr

## Support

Bei Problemen:

1. Coolify Dokumentation: https://coolify.io/docs
2. Discord Bot Logs in Coolify Dashboard
3. GitHub Issues für den Bot Code
