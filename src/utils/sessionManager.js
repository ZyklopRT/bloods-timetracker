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

    // Get the fresh session with events to display
    const newSession = await database.getActiveSession(userId, guildId);
    const content = this.createSessionContent(userId, newSession.events, true);

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
    const sessionDuration = database.calculateSessionDuration(
      activeSession.events,
      stopTime
    );

    // Stop the session
    await database.stopSession(userId, guildId, stopTime);

    // Update online list
    await this.updateOnlineList(guildId);

    // Create completion summary without buttons
    let content = `**Zeiterfassung für <@${userId}>**\n\n`;
    content += `✅ **Session beendet**\n`;
    content += `📊 **Session-Dauer:** ${this.formatTime(sessionDuration)}\n\n`;

    // Get updated total stats
    const userStats = await database.getUserStats(userId, guildId);
    content += `🏆 **Gesamtzeit:** ${this.formatTime(userStats.totalTimeMs)}\n`;
    content += `📈 **Sessions Gesamt:** ${userStats.sessionsCount}`;

    return {
      content,
      components: [], // Remove buttons when session is stopped
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Pause tracking
   */
  async pauseSession(userId, guildId) {
    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession || activeSession.status !== "ACTIVE") {
      return {
        content: "❌ Du hast keine aktive Session!",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const pauseTime = new Date();
    await database.pauseSession(userId, guildId, pauseTime);
    await this.updateOnlineList(guildId);

    // Get fresh session data after pause
    const updatedSession = await database.getActiveSession(userId, guildId);
    const content = this.createSessionContent(
      userId,
      updatedSession.events,
      false
    );

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
    if (!activeSession || activeSession.status !== "PAUSED") {
      return {
        content: "❌ Du hast keine pausierte Session!",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const resumeTime = new Date();
    await database.resumeSession(userId, guildId, resumeTime);
    await this.updateOnlineList(guildId);

    // Get fresh session data after resume
    const updatedSession = await database.getActiveSession(userId, guildId);
    const content = this.createSessionContent(
      userId,
      updatedSession.events,
      true
    );

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
      activeSession.status === "ACTIVE"
    );

    return {
      content,
      components: [
        this.createSessionButtons(activeSession.status === "ACTIVE"),
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
    };
  }

  /**
   * Create session content text
   */
  createSessionContent(userId, events, isActive, finalDuration = null) {
    if (!events || events.length === 0) return "Keine Session-Daten gefunden.";

    const startEvent = events.find((e) => e.eventType === "START");
    if (!startEvent) return "Session-Start nicht gefunden.";

    let content = `**Zeiterfassung für <@${userId}>**\n\n`;

    // Current status
    if (finalDuration !== null) {
      content += `✅ **Session beendet**\n`;
      content += `📊 **Gesamtzeit:** ${this.formatTime(finalDuration)}\n\n`;
    } else if (isActive) {
      const currentDuration = database.calculateSessionDuration(
        events,
        new Date()
      );
      const startEvent = events.find((e) => e.eventType === "START");
      const startTime = `<t:${Math.floor(
        new Date(startEvent.timestamp).getTime() / 1000
      )}:R>`;
      content += `🟢 **Aktiv** seit ${startTime}\n\n`;
    } else {
      const currentDuration = database.calculateSessionDuration(
        events,
        new Date()
      );
      content += `⏸️ **Pausiert** - ${this.formatTime(currentDuration)}\n\n`;
    }

    // Event history
    content += `**Session-Verlauf:**\n`;
    events.forEach((event) => {
      const time = new Date(event.timestamp);
      const timeStr = `<t:${Math.floor(time.getTime() / 1000)}:t>`;

      switch (event.eventType) {
        case "START":
          content += `• ${timeStr} - Gestartet\n`;
          break;
        case "PAUSE":
          content += `• ${timeStr} - Pausiert\n`;
          break;
        case "RESUME":
          content += `• ${timeStr} - Fortgesetzt\n`;
          break;
        case "STOP":
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
      console.log(`[DEBUG] Guild settings for ${guildId}:`, settings);

      if (!settings?.liveChannelId) {
        console.log(`[DEBUG] No live channel configured for guild ${guildId}`);
        return;
      }

      const activeSessions = await database.getAllActiveSessions(guildId);
      const content = this.createOnlineListContent(activeSessions);
      console.log(`[DEBUG] Online list content:`, content);

      if (settings.liveMessageId) {
        console.log(
          `[DEBUG] Trying to update existing message ID: ${settings.liveMessageId}`
        );
        try {
          await editChannelMessage(
            settings.liveChannelId,
            settings.liveMessageId,
            { content }
          );
          console.log(`[DEBUG] Successfully updated existing message`);
        } catch (error) {
          console.log(
            `[DEBUG] Failed to update online list message (${settings.liveMessageId}), creating new one:`,
            error.message
          );
          // Message deleted or error - create new one
          const message = await sendChannelMessage(settings.liveChannelId, {
            content,
          });
          console.log(`[DEBUG] Created new message with ID: ${message.id}`);
          await database.setGuildSettings(guildId, {
            liveMessageId: message.id,
          });
        }
      } else {
        console.log(
          `[DEBUG] No existing message ID, creating first online list message`
        );
        // Create first online list message
        const message = await sendChannelMessage(settings.liveChannelId, {
          content,
        });
        console.log(`[DEBUG] Created first message with ID: ${message.id}`);
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

    activeSessions.forEach((session) => {
      const startEvent = session.events.find((e) => e.eventType === "START");
      const startTime = `<t:${Math.floor(new Date(startEvent.timestamp).getTime() / 1000)}:R>`;
      const status = session.status === "ACTIVE" ? "" : " (pausiert)";
      content += `<@${session.userId}> - seit ${startTime}${status}\n`;
    });

    content += `\n*${activeSessions.length} Benutzer online*`;
    return content;
  }

  /**
   * Get user statistics
   */
  async getUserStats(targetUserId, guildId) {
    const stats = await database.getUserStats(targetUserId, guildId);

    const avgTime =
      stats.sessionsCount > 0 ? stats.totalTimeMs / stats.sessionsCount : 0;

    let content = `**Statistiken für <@${targetUserId}>**\n\n`;
    content += `📊 **Gesamtzeit:** ${this.formatTime(stats.totalTimeMs)}\n`;
    content += `🎮 **Sessions:** ${stats.sessionsCount}\n`;
    content += `📈 **Durchschnitt:** ${this.formatTime(avgTime)}\n`;

    if (stats.lastSeen) {
      const lastSeen = `<t:${Math.floor(
        new Date(stats.lastSeen).getTime() / 1000
      )}:R>`;
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
      const medal =
        position === 1
          ? "🥇"
          : position === 2
          ? "🥈"
          : position === 3
          ? "🥉"
          : `${position}.`;
      content += `${medal} <@${entry.userId}> - ${this.formatTime(
        entry.totalTimeMs
      )} (${entry.sessionsCount} Sessions)\n`;
    });

    return content;
  }
}
