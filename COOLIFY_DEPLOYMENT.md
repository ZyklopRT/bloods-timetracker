# Discord Bot Deployment mit Coolify 🚀

Diese Anleitung zeigt dir, wie du deinen Discord Time Tracker Bot mit Coolify hostest.

## Voraussetzungen

- Server/VPS mit SSH Zugang
- Docker installiert
- Git Repository (GitHub/GitLab/etc.)
- Discord Bot Token und Application ID

## 1. Coolify Installation

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

## 2. Vorbereitung deines Projekts

### Build für Production

```bash
npm run build:prod
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
4. Build Command: `npm run build:prod`
5. Start Command: `node dist/index.js`

### Environment Variables

Füge folgende Environment Variables hinzu:

```env
TOKEN=dein_discord_bot_token
APPLICATION_ID=deine_discord_application_id
PUBLIC_KEY=dein_discord_public_key
DATABASE_PATH=/app/data/timetracker.db
NODE_ENV=production
```

### Volumes für persistente Daten

- **Source:** `/app/data`
- **Destination:** `/var/lib/coolify/data/timetracker`
- **Type:** bind

## 4. Deployment

1. **Deploy** Button klicken
2. Build Logs überwachen
3. Bot Status in Discord überprüfen

## 5. Monitoring

### Health Checks

Coolify überwacht automatisch:

- Container Status
- Memory Usage
- CPU Usage
- Application Logs

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

1. Environment Variables überprüfen
2. Database Pfad kontrollieren
3. Docker Container Logs checken

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
