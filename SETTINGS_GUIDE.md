# 🎛️ Enhanced Settings System

This Discord bot now features a comprehensive settings system that moves configuration from environment variables to an intuitive Discord user interface.

## 🔧 Environment Variables Update

### New Environment Variable Names (Discord Developer Docs Standard)

```env
# Required - Keep these secure!
APPLICATION_ID=your_application_id_here
TOKEN=your_bot_token_here
PUBLIC_KEY=your_public_key_here

# Database
DATABASE_PATH=./data/timetracker.db

# Optional - Can be configured via Discord UI
GUILD_ID=your_guild_id_here
BOT_PREFIX=!
DEFAULT_TRACK_CHANNEL_ID=your_tracking_channel_id_here
```

**Note:** The sensitive credentials (`APPLICATION_ID`, `TOKEN`, `PUBLIC_KEY`) remain in environment variables for security, while user-configurable settings are now managed through Discord's interface.

## 🎨 New Settings Interface

### Main Commands

- `/settings panel` - Opens the interactive settings panel
- `/settings view` - Shows current configuration (read-only)
- `/settings reset` - Resets all settings to defaults

### Interactive Components

#### 📊 Basic Settings (Modal)

Configure fundamental bot settings:

- **Bot Prefix** - Command prefix (e.g., `!`)
- **Embed Color** - Hex color for bot embeds (e.g., `#0099ff`)
- **Timezone** - Server timezone (e.g., `UTC`, `EST`)

#### ⚡ Features (Multi-Select Menu)

Toggle various bot features:

- 🟢 **Online Messages** - Show when users start tracking
- 🔴 **Offline Messages** - Show when users stop tracking
- 📋 **Tracking List** - Live tracking list message
- 👤 **Self Tracking** - Allow users to track themselves
- 🏆 **Leaderboard** - Time tracking leaderboard
- 🗑️ **Auto Delete** - Auto-delete bot messages

#### 🔧 Advanced Settings (Modal)

Fine-tune advanced options:

- **Message Delete Delay** - Seconds before auto-deletion
- **Minimum Time Required** - Minimum minutes to track
- **Leaderboard Update Interval** - Minutes between updates

#### 📺 Channel Configuration

- **Set Tracking Channel** - Designate notification channel

### Additional Features

- **🔄 Refresh** - Update settings panel display
- **📋 Export Config** - Export current settings as JSON

## 💾 Enhanced Database Schema

The database now supports additional configuration options:

```sql
-- New settings columns added:
botPrefix TEXT DEFAULT '!'
autoDeleteMessages INTEGER DEFAULT 0
messageDeleteDelay INTEGER DEFAULT 30
requireTimeMinimum INTEGER DEFAULT 0
minimumTimeMinutes INTEGER DEFAULT 5
allowSelfTracking INTEGER DEFAULT 1
enableLeaderboard INTEGER DEFAULT 1
leaderboardUpdateInterval INTEGER DEFAULT 60
timezone TEXT DEFAULT 'UTC'
embedColor TEXT DEFAULT '#0099ff'
```

## 🎯 Key Benefits

### For Server Administrators

- **No Environment Variables** - Configure everything through Discord
- **Visual Interface** - Intuitive buttons, modals, and menus
- **Real-time Updates** - Changes apply immediately
- **Export/Import** - Backup and share configurations

### For Developers

- **Discord API Standards** - Proper environment variable naming
- **Modern UI Components** - Buttons, modals, select menus
- **Comprehensive Validation** - Input validation and error handling
- **Extensible Architecture** - Easy to add new settings

### Security Improvements

- **Secure Credentials** - Keep sensitive data in environment variables
- **User Permissions** - Only administrators can modify settings
- **Input Validation** - Prevent invalid configurations

## 🔄 Migration Notes

If you're updating from the old system:

1. **Update Environment Variables**: Rename `DISCORD_TOKEN` → `TOKEN` and `CLIENT_ID` → `APPLICATION_ID`
2. **Add PUBLIC_KEY**: Add `PUBLIC_KEY` environment variable if needed
3. **Database Migration**: The database schema will auto-update on first run
4. **Settings Migration**: Existing settings are preserved and enhanced

## 🚀 Usage Examples

### Quick Setup

```
/settings panel
```

Click "Basic Settings" → Configure prefix, color, timezone → Save

### Feature Configuration

```
/settings panel
```

Click "Features" → Select desired features → Confirm

### View Current Settings

```
/settings view
```

### Reset Everything

```
/settings reset
```

## 🎨 UI Components Used

- **Embeds** - Rich information display
- **Buttons** - Category navigation
- **Modals** - Text input forms
- **Select Menus** - Multi-option toggles
- **Action Rows** - Component organization

This new system provides a much more user-friendly way to configure your Discord time tracking bot while maintaining security best practices!
