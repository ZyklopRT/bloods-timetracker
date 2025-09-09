import PrismaService from "../database/prisma.js";
import { editChannelMessage, sendChannelMessage } from "./discordApi.js";
import { InteractionResponseFlags } from "discord-interactions";

const database = new PrismaService();

/**
 * Simple, clean session management
 */
export class SessionManager {
  
  /**
   * Format milliseconds to readable time
   */
  formatTime(ms) {
    if (ms <= 0) return "0min";
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  }

  /**
   * Start tracking for a user
   */
  async startSession(userId, guildId, channelId) {
    // Check for existing active session
    const activeSession = await database.getActiveSession(userId, guildId);
    if (activeSession) {
      return this.showExistingSession(activeSession);
    }

    // Create new session
    const startTime = new Date();
    await database.startSession(userId, guildId, startTime);

    // Update online list
    await this.updateOnlineList(guildId);

    const content = this.createSessionContent(userId, [{ type: 'START', time: startTime }], true);
    
    return {
      content,
      components: [this.createSessionButtons(true)],
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Stop tracking for a user  
   */
  async stopSession(userId, guildId) {
    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content: "❌ Du hast keine aktive Session!",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const stopTime = new Date();
    const sessionDuration = database.calculateSessionDuration(activeSession.events, stopTime);
    
    // Stop the session
    await database.stopSession(userId, guildId, stopTime);

    // Update online list
    await this.updateOnlineList(guildId);

    // Get all events for summary
    const allEvents = [...activeSession.events, { eventType: 'STOP', timestamp: stopTime }];
    const content = this.createSessionContent(userId, allEvents, false, sessionDuration);

    return {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Pause tracking
   */
  async pauseSession(userId, guildId) {
    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession || activeSession.status !== 'ACTIVE') {
      return {
        content: "❌ Du hast keine aktive Session!",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const pauseTime = new Date();
    await database.pauseSession(userId, guildId, pauseTime);
    await this.updateOnlineList(guildId);

    const allEvents = [...activeSession.events, { eventType: 'PAUSE', timestamp: pauseTime }];
    const content = this.createSessionContent(userId, allEvents, true);

    return {
      content,
      components: [this.createSessionButtons(false)],
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Resume tracking
   */
  async resumeSession(userId, guildId) {
    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession || activeSession.status !== 'PAUSED') {
      return {
        content: "❌ Du hast keine pausierte Session!",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const resumeTime = new Date();
    await database.resumeSession(userId, guildId, resumeTime);
    await this.updateOnlineList(guildId);

    const allEvents = [...activeSession.events, { eventType: 'RESUME', timestamp: resumeTime }];
    const content = this.createSessionContent(userId, allEvents, true);

    return {
      content,
      components: [this.createSessionButtons(true)],
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Show existing session
   */
  showExistingSession(activeSession) {
    const content = this.createSessionContent(
      activeSession.userId, 
      activeSession.events, 
      activeSession.status === 'ACTIVE'
    );
    
    return {
      content,
      components: [this.createSessionButtons(activeSession.status === 'ACTIVE')],
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Create session content text
   */
  createSessionContent(userId, events, isActive, finalDuration = null) {
    if (!events || events.length === 0) return "Keine Session-Daten gefunden.";

    const startEvent = events.find(e => e.eventType === 'START');
    if (!startEvent) return "Session-Start nicht gefunden.";

    let content = `**Zeiterfassung für <@${userId}>**\n\n`;

    // Current status
    if (finalDuration !== null) {
      content += `✅ **Session beendet**\n`;
      content += `📊 **Gesamtzeit:** ${this.formatTime(finalDuration)}\n\n`;
    } else if (isActive) {
      const currentDuration = database.calculateSessionDuration(events);
      content += `🟢 **Aktiv** - ${this.formatTime(currentDuration)}\n\n`;
    } else {
      const currentDuration = database.calculateSessionDuration(events);
      content += `⏸️ **Pausiert** - ${this.formatTime(currentDuration)}\n\n`;
    }

    // Event history
    content += `**Session-Verlauf:**\n`;
    events.forEach(event => {
      const time = new Date(event.timestamp);
      const timeStr = `<t:${Math.floor(time.getTime() / 1000)}:t>`;
      
      switch (event.eventType) {
        case 'START':
          content += `• ${timeStr} - Gestartet\n`;
          break;
        case 'PAUSE':
          content += `• ${timeStr} - Pausiert\n`;
          break;
        case 'RESUME':
          content += `• ${timeStr} - Fortgesetzt\n`;
          break;
        case 'STOP':
          content += `• ${timeStr} - Beendet\n`;
          break;
      }
    });

    return content;
  }

  /**
   * Create simple session buttons
   */
  createSessionButtons(isActive) {
    const buttons = [];

    if (isActive) {
      buttons.push(
        {
          type: 2,
          style: 2,
          label: "Pausieren",
          custom_id: "pause_session",
        },
        {
          type: 2,
          style: 4,
          label: "Beenden",
          custom_id: "stop_session",
        }
      );
    } else {
      buttons.push(
        {
          type: 2,
          style: 3,
          label: "Fortsetzen",
          custom_id: "resume_session",
        },
        {
          type: 2,
          style: 4,
          label: "Beenden",
          custom_id: "stop_session",
        }
      );
    }

    return {
      type: 1,
      components: buttons,
    };
  }

  /**
   * Update online list message
   */
  async updateOnlineList(guildId) {
    try {
      const settings = await database.getGuildSettings(guildId);
      if (!settings?.liveChannelId) return;

      const activeSessions = await database.getAllActiveSessions(guildId);
      const content = this.createOnlineListContent(activeSessions);

      if (settings.liveMessageId) {
        try {
          await editChannelMessage(settings.liveChannelId, settings.liveMessageId, { content });
        } catch (error) {
          // Message deleted or error - create new one
          const message = await sendChannelMessage(settings.liveChannelId, { content });
          await database.setGuildSettings(guildId, { liveMessageId: message.id });
        }
      } else {
        // Create first online list message
        const message = await sendChannelMessage(settings.liveChannelId, { content });
        await database.setGuildSettings(guildId, { liveMessageId: message.id });
      }
    } catch (error) {
      console.error("Error updating online list:", error);
    }
  }

  /**
   * Create simple online list content
   */
  createOnlineListContent(activeSessions) {
    if (activeSessions.length === 0) {
      return "**Online-Liste**\n\nZeit niemand online.";
    }

    let content = "**Online-Liste**\n\n";
    
    activeSessions.forEach(session => {
      const duration = database.calculateSessionDuration(session.events);
      const status = session.status === 'ACTIVE' ? '' : ' (pausiert)';
      content += `<@${session.userId}> - ${this.formatTime(duration)}${status}\n`;
    });

    content += `\n*${activeSessions.length} Benutzer online*`;
    return content;
  }

  /**
   * Get user statistics
   */
  async getUserStats(targetUserId, guildId) {
    const stats = await database.getUserStats(targetUserId, guildId);
    
    const avgTime = stats.sessionsCount > 0 ? stats.totalTimeMs / stats.sessionsCount : 0;
    
    let content = `**Statistiken für <@${targetUserId}>**\n\n`;
    content += `📊 **Gesamtzeit:** ${this.formatTime(stats.totalTimeMs)}\n`;
    content += `🎮 **Sessions:** ${stats.sessionsCount}\n`;
    content += `📈 **Durchschnitt:** ${this.formatTime(avgTime)}\n`;

    if (stats.lastSeen) {
      const lastSeen = `<t:${Math.floor(new Date(stats.lastSeen).getTime() / 1000)}:R>`;
      content += `👀 **Zuletzt:** ${lastSeen}`;
    }

    return content;
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(guildId, limit = 10) {
    const leaderboard = await database.getLeaderboard(guildId, limit);
    
    if (leaderboard.length === 0) {
      return "**Leaderboard**\n\nNoch keine Daten vorhanden.";
    }

    let content = "**Leaderboard - Top Spieler**\n\n";
    
    leaderboard.forEach((entry, index) => {
      const position = index + 1;
      const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : `${position}.`;
      content += `${medal} <@${entry.userId}> - ${this.formatTime(entry.totalTimeMs)} (${entry.sessionsCount} Sessions)\n`;
    });

    return content;
  }
}
