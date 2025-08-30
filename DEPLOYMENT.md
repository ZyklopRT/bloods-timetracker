# Coolify Deployment Guide

Dieser Guide beschreibt die optimierte Deployment-Strategie für den Discord Time Tracker Bot auf Coolify.

## Überblick

Das Deployment wurde nach Discord.js Best Practices und Docker-Standards optimiert:

- **Intelligentes Command-Deployment**: Commands werden nur bei Bedarf deployed, nicht bei jedem Container-Neustart
- **Multi-Stage Docker Build**: Optimiert für Größe und Sicherheit
- **Proper Signal Handling**: Graceful shutdown mit dumb-init
- **Non-root Execution**: Erhöhte Sicherheit
- **Persistent Data**: SQLite-Datenbank überlebt Container-Neustarts

## Deployment-Prozess

### 1. Automatisches Build

Das Dockerfile verwendet einen Multi-Stage Build:

1. **Builder Stage**: Kompiliert TypeScript zu JavaScript
2. **Production Stage**: Erstellt optimales Runtime-Image

### 2. Intelligentes Startup

Das `startup.sh` Script:

- Überprüft ob Commands deployed werden müssen
- Deployed Commands nur beim ersten Start oder wenn `FORCE_DEPLOY=true` gesetzt ist
- Startet den Bot mit proper Signal Handling

### 3. Environment Variables

Erforderliche Umgebungsvariablen:

```env
TOKEN=your_discord_bot_token
APPLICATION_ID=your_discord_application_id
GUILD_ID=your_discord_guild_id_for_testing (optional)
DATABASE_PATH=/app/data/timetracker.db
DEFAULT_TRACK_CHANNEL_ID=your_default_channel_id
```

Optionale Variablen:

```env
FORCE_DEPLOY=true  # Erzwingt Command-Deployment
```

## Coolify Setup

### 1. Docker Image Build

Coolify buildet automatisch das Docker Image aus dem Repository.

### 2. Volume Mounting

Für Datenpersistenz mount folgende Volumes:

```yaml
volumes:
  - /app/data # Für SQLite-Datenbank
```

### 3. Environment Variables

Setze die erforderlichen Environment Variables in Coolify:

- `TOKEN`
- `APPLICATION_ID`
- `GUILD_ID` (optional, für Development)
- `DATABASE_PATH=/app/data/timetracker.db`
- `DEFAULT_TRACK_CHANNEL_ID`

### 4. Health Checks

Der Container hat einen integrierten Health Check der überprüft ob der Bot-Prozess läuft.

## Features

### Simplified Scripts

Die `package.json` Scripts wurden auf das Wesentliche reduziert:

- `start`: Startet den Bot
- `build`: Kompiliert TypeScript
- `deploy-commands`: Deployed Discord Commands

### Graceful Shutdown

Der Bot kann graceful shutdowns handhaben und schließt Datenbankverbindungen ordnungsgemäß.

### Security

- Non-root User (nodeapp:1001)
- Minimal Alpine Linux Base Image
- Proper Signal Handling mit dumb-init

## Troubleshooting

### Commands werden nicht deployed

Lösche die `.commands_deployed` Datei oder setze `FORCE_DEPLOY=true`:

```bash
# In Coolify Console
rm /app/data/.commands_deployed
```

### Datenbank-Probleme

Überprüfe dass das `/app/data` Volume gemounted ist und beschreibbar ist.

### Bot startet nicht

Überprüfe die Logs für:

- Fehlende Environment Variables
- Discord Token/Permission Probleme
- Netzwerk-Connectivity

## Production Best Practices

1. **Nie Development Dependencies in Production**
2. **Proper Volume Mounting für Datenpersistenz**
3. **Environment Variables für sensitive Daten**
4. **Health Checks für Monitoring**
5. **Graceful Shutdown Handling**
6. **Security durch Non-root Execution**

Diese Setup folgt allen Discord.js Dokumentations-Best-Practices und Docker-Standards für Production-Deployments.
