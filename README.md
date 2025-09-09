# Discord Time Tracker Bot - HTTP Interactions ⚡

Ein moderner Discord Bot für Zeiterfassung in GTA Roleplay Servern, optimiert für Container-Deployments mit HTTP Interactions Architektur.

## ✨ Features

- **⏱️ Zeiterfassung**: Start, Pause, Resume und Stop von Sessions
- **📊 Statistiken**: Persönliche und Server-weite Zeiterfassungs-Statistiken
- **🏆 Leaderboards**: Wer verbringt die meiste Zeit auf dem Server
- **⚙️ Guild Settings**: Konfigurierbare Tracking-Kanäle
- **🔗 HTTP Interactions**: Moderne Webhook-basierte Architektur
- **💾 Persistente Datenbank**: SQLite für zuverlässige Datenspeicherung
- **🐳 Docker Ready**: Container-optimiert für moderne Cloud-Deployments
- **🚀 Auto-Scaling**: Stateless und horizontal skalierbar
- **📱 Interactive Buttons**: Pause/Resume über Discord Buttons

## 🎮 Commands

| Command                            | Beschreibung                                       | Berechtigung  |
| ---------------------------------- | -------------------------------------------------- | ------------- |
| `/play`                            | Starte die On-Off Zeiterfassung                    | Alle          |
| `/stop`                            | Stoppe die On-Off Zeiterfassung                    | Alle          |
| `/stats [user]`                    | Zeige Statistiken für dich oder einen anderen User | Alle          |
| `/status`                          | Zeige alle aktuell aktiven Sessions                | Alle          |
| `/leaderboard`                     | Zeige das Server-Leaderboard                       | Alle          |
| `/settings channel [channel]`      | Setze Zeiterfassungs-Kanal                         | Administrator |
| `/settings live-channel [channel]` | Setze Live-Tracking Kanal                          | Administrator |

## 🚀 Quick Start

### Lokale Entwicklung

```bash
# Repository klonen
git clone <repository-url>
cd bloods-timetracker

# Dependencies installieren
npm install

# Environment Variables konfigurieren
cp env.example .env
# .env editieren mit deinen Discord Credentials

# Commands registrieren
npm run register

# Bot starten
npm run dev
```

### Docker Deployment

```bash
# Docker Image bauen
docker build -t bloods-timetracker .

# Container starten
docker run -d \
  --name bloods-timetracker \
  -p 3001:3001 \
  -v bloods_data:/app/data \
  -e APPLICATION_ID=your_app_id \
  -e TOKEN=your_bot_token \
  -e PUBLIC_KEY=your_public_key \
  bloods-timetracker
```

## 📋 Voraussetzungen

- Node.js 18+
- Discord Application mit Bot Token und Public Key
- Öffentlich erreichbare URL für Interactions Endpoint (für Production)

## ⚙️ Discord Setup

### 1. Discord Application erstellen

1. Gehe zur [Discord Developer Console](https://discord.com/developers/applications)
2. **New Application** → Name eingeben
3. **General Information** → Kopiere `Application ID` und `Public Key`
4. **Bot** → Kopiere `Token`

### 2. Bot Berechtigungen

Der Bot benötigt:

- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History

### 3. Interactions Endpoint setzen

**Wichtig für Production:**

1. **General Information** → **Interactions Endpoint URL**
2. Setze: `https://yourdomain.com/interactions`
3. **Save Changes**

Discord sendet automatisch eine Ping-Anfrage zur Verifizierung.

### 4. Bot einladen

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=274878221312&scope=bot%20applications.commands
```

## 🔧 Environment Variables

```env
# ERFORDERLICH
APPLICATION_ID=your_discord_application_id
TOKEN=your_discord_bot_token
PUBLIC_KEY=your_discord_public_key

# SERVER
PORT=3001
NODE_ENV=production

# DATABASE
DATABASE_PATH=/app/data/timetracker.db

# OPTIONAL (Development)
GUILD_ID=your_test_guild_id
```

## 🏗️ Architektur

### HTTP Interactions vs Gateway Bot

| Aspekt                | HTTP Interactions ⚡     | Gateway Bot           |
| --------------------- | ------------------------ | --------------------- |
| **Verbindungstyp**    | HTTP Webhooks            | Persistente WebSocket |
| **Skalierung**        | Horizontal skalierbar    | Single Instance       |
| **Ressourcen**        | Niedrig (nur bei Bedarf) | Hoch (kontinuierlich) |
| **Container-Eignung** | Exzellent                | Gut                   |
| **Load Balancing**    | Natürlich unterstützt    | Schwierig             |

### Datenbankschema

```sql
-- Sessions Tabelle
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  paused_time INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);

-- Guild Settings Tabelle
CREATE TABLE guild_settings (
  guild_id TEXT PRIMARY KEY,
  tracking_channel_id TEXT,
  live_channel_id TEXT
);
```

## 📁 Projektstruktur

```
bloods-timetracker/
├── src/
│   ├── app.js                 # Express HTTP Server
│   ├── commands.js            # Command Registration
│   ├── database/
│   │   └── database.js        # SQLite Database Manager
│   └── utils/
│       ├── discordApi.js      # Discord API Helper
│       ├── helpers.js         # Utility Functions
│       └── trackingManager.js # Tracking Logic
├── data/                      # Database Files (generated)
├── Dockerfile                 # Container Configuration
├── package.json               # Dependencies & Scripts
└── env.example               # Environment Template
```

## 🚢 Production Deployment

### Mit Coolify

1. **New Application** → **Git Repository**
2. **Environment Variables** setzen
3. **Network Settings**: Port 3000, Domain konfigurieren
4. **Volume**: `/app/data` für Database Persistence
5. **Deploy** → Discord Interactions Endpoint setzen

### Mit Railway/Render

1. Repository verknüpfen
2. Environment Variables setzen
3. Auto-Deploy aktivieren
4. Public URL → Discord Interactions Endpoint

### Generische Container Platform

```bash
# Image bauen
docker build -t bloods-timetracker .

# Production Container
docker run -d \
  --name timetracker \
  --restart unless-stopped \
  -p 3001:3001 \
  -v timetracker_data:/app/data \
  -e APPLICATION_ID=$APP_ID \
  -e TOKEN=$BOT_TOKEN \
  -e PUBLIC_KEY=$PUBLIC_KEY \
  bloods-timetracker
```

## 📊 Monitoring

### Health Check

```bash
curl https://yourdomain.com/health
```

### Logs

```bash
# Docker Logs
docker logs -f bloods-timetracker

# Container Stats
docker stats bloods-timetracker
```

## 🔧 Development

### Lokales Testing

```bash
# Dependencies installieren
npm install

# Development mit Auto-Restart
npm run dev

# Commands registrieren
npm run register
```

### Mit ngrok (für lokales Interaction Testing)

```bash
# ngrok installieren und starten
ngrok http 3001

# Tunnel URL in Discord Developer Console setzen
# https://abc123.ngrok.io/interactions
```

## 🤝 Contributing

1. Repository forken
2. Feature Branch erstellen
3. Änderungen implementieren
4. Tests durchführen
5. Pull Request erstellen

## 📄 License

MIT License - siehe LICENSE Datei für Details.

## 🆘 Support & Troubleshooting

### Häufige Probleme

**Bot reagiert nicht auf Commands:**

- Public Key korrekt gesetzt?
- Interactions Endpoint erreichbar?
- Commands registriert? (`npm run register`)

**Container startet nicht:**

- Environment Variables vollständig?
- Port 3000 verfügbar?
- Database Volume gemountet?

**Discord Endpoint Validation fails:**

- HTTPS erforderlich (nicht HTTP)
- PUBLIC_KEY exakt aus Discord Console kopiert
- Endpoint muss `/interactions` zurückgeben

### Support

- GitHub Issues für Bug Reports
- Discord Community für Fragen
- Dokumentation: Siehe `/docs` Ordner

---

**🎉 Erfolgreich migriert zu HTTP Interactions!**

Dieser Bot ist jetzt optimiert für moderne Container-Deployments und bietet bessere Skalierbarkeit und Performance.
