# Blood's Time Tracker Discord Bot

A Discord bot designed for GTA roleplay servers to track user time and activity. Users can start time tracking with a command, receive private message controls, and see their time logged in a constantly updated message.

## Features

- **Time Tracking**: Start, pause, and stop time tracking with slash commands
- **Private Controls**: Users receive DM with pause/stop buttons for easy control
- **Real-time Updates**: Constantly updated message showing all online users
- **Notifications**: Configurable messages when users go online/offline
- **Statistics**: View detailed time tracking statistics for users
- **Admin Settings**: Toggleable features and channel configuration
- **Database Storage**: SQLite database for persistent data storage

## Commands

### User Commands

- `/start` - Start time tracking for GTA roleplay
- `/stop` - Stop your current time tracking session
- `/stats [user]` - View time tracking statistics (for yourself or another user)

### Admin Commands

- `/settings channel <channel>` - Set the channel for time tracking notifications
- `/settings toggle <feature> <enabled>` - Toggle features (online messages, offline messages, tracking list)
- `/settings view` - View current bot settings

## Setup

### Prerequisites

- Node.js 18 or higher
- A Discord bot token
- A Discord server where you have admin permissions

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd bloods-timetracker
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `env.example` to `.env` and fill in your values:

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your Discord bot credentials:

   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   DATABASE_PATH=./data/timetracker.db
   BOT_PREFIX=!
   DEFAULT_TRACK_CHANNEL_ID=your_tracking_channel_id_here
   ```

4. **Build the project**

   ```bash
   npm run build
   ```

5. **Deploy slash commands**

   ```bash
   npm run deploy
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

### Development

For development with auto-restart:

```bash
npm run dev
```

## Discord Bot Setup

### Creating a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give your bot a name and create it
4. Go to the "Bot" section
5. Click "Add Bot"
6. Copy the bot token for your `.env` file
7. Copy the Application ID (Client ID) for your `.env` file

### Bot Permissions

The bot needs the following permissions:

- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History
- Send Messages in Threads
- Use External Emojis

### Inviting the Bot

Use this URL structure to invite your bot:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274878221312&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your bot's client ID.

## Configuration

### Guild Settings

After inviting the bot, use these commands to configure it:

1. **Set notification channel:**

   ```
   /settings channel #time-tracking
   ```

2. **Configure features:**

   ```
   /settings toggle online_messages true
   /settings toggle offline_messages true
   /settings toggle tracking_list true
   ```

3. **View current settings:**
   ```
   /settings view
   ```

## Usage

### For Users

1. **Start tracking:**

   ```
   /start
   ```

   - You'll receive a DM with control buttons
   - A message appears in the channel that you're online
   - You're added to the tracking list

2. **Control your session:**

   - Use the **Pause** button in your DM to pause tracking
   - Use the **Resume** button to continue tracking
   - Use the **Stop** button to end your session

3. **View statistics:**
   ```
   /stats
   /stats @username
   ```

### For Administrators

- Configure the bot using `/settings` commands
- Monitor user activity through the tracking list
- Customize which features are enabled

## Database

The bot uses SQLite for data storage with the following tables:

- `sessions` - Individual time tracking sessions
- `guild_settings` - Per-server configuration
- `user_stats` - Aggregated user statistics
- `pause_sessions` - Pause periods within sessions

## File Structure

```
bloods-timetracker/
├── src/
│   ├── commands/           # Slash command implementations
│   ├── events/            # Discord event handlers
│   ├── database/          # Database management
│   ├── utils/             # Utility functions and managers
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Main bot file
├── dist/                  # Compiled JavaScript (generated)
├── data/                  # Database files (generated)
├── package.json
├── tsconfig.json
├── .eslintrc.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting: `npm run lint`
5. Test your changes
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, create an issue on the GitHub repository or contact the development team.
