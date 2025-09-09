import PrismaService from "../database/prisma.js";
import {
  formatTime,
  validateTrackingChannel,
  createTrackingButtons,
  createTrackingStartEmbed,
  createTrackingStopEmbed,
  createTrackingStatusEmbed,
} from "./helpers.js";
import { LiveChannelManager } from "./liveChannelManager.js";
import { InteractionResponseFlags } from "discord-interactions";

const database = new PrismaService();
const liveChannelManager = new LiveChannelManager();

export class TimeTrackingManager {
  /**
   * Start tracking for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {string} channelId - Discord channel ID
   * @returns {Object} Response object for Discord
   */
  async startTracking(userId, guildId, channelId) {
    // Validate channel permissions
    const channelValidation = await validateTrackingChannel(guildId, channelId);
    if (!channelValidation.isValid) {
      return {
        content: channelValidation.message,
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Check if user already has an active session
    const activeSession = await database.getActiveSession(userId, guildId);
    if (activeSession) {
      const adjustedTime = this.calculateAdjustedTime(activeSession);
      const statusEmoji = activeSession.status === "ACTIVE" ? "🟢" : "⏸️";
      const statusText =
        activeSession.status === "ACTIVE" ? "Aktiv" : "Pausiert";

      return {
        content: `❌ **Du hast bereits eine aktive Session!**\n\n${statusEmoji} Status: **${statusText}**\n⏱️ Bisherige Zeit: **${formatTime(
          adjustedTime
        )}**\n🕐 Gestartet: <t:${Math.floor(
          activeSession.startTime.getTime() / 1000
        )}:R>`,
        components: createTrackingButtons(activeSession.status.toLowerCase()),
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Start new tracking session
    const startTime = Date.now();
    await database.startSession(userId, guildId, new Date(startTime));

    // Update live channel message
    await liveChannelManager.updateLiveMessage(guildId);

    const embed = createTrackingStartEmbed(userId, startTime);
    const buttons = createTrackingButtons("active");

    return {
      embeds: [embed],
      components: buttons,
    };
  }

  /**
   * Stop tracking for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {string} channelId - Discord channel ID
   * @returns {Object} Response object for Discord
   */
  async stopTracking(userId, guildId, channelId) {
    // Validate channel permissions
    const channelValidation = await validateTrackingChannel(guildId, channelId);
    if (!channelValidation.isValid) {
      return {
        content: channelValidation.message,
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content:
          "❌ **Du hast keine aktive Zeiterfassung!**\n\nStarte eine neue Session mit `/play`.",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Calculate session duration BEFORE stopping (since we need the current time)
    const endTime = new Date();
    const adjustedTime = database.calculateSessionDuration(
      activeSession.events,
      endTime
    );

    // Stop the session (adds STOP event)
    await database.stopSession(userId, guildId, endTime);

    // Update live channel message
    await liveChannelManager.updateLiveMessage(guildId);

    // Get updated user stats
    const userStats = await database.getUserStats(userId, guildId);

    const embed = createTrackingStopEmbed(
      userId,
      adjustedTime,
      userStats.totalTimeMs,
      userStats.sessionsCount
    );

    return {
      embeds: [embed],
    };
  }

  /**
   * Pause tracking for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Object} Response object for Discord
   */
  async pauseTracking(userId, guildId) {
    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content: "❌ **Du hast keine aktive Zeiterfassung!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    if (activeSession.status === "PAUSED") {
      return {
        content: "❌ **Deine Session ist bereits pausiert!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Calculate current session time BEFORE pausing
    const pauseTime = new Date();
    const currentSessionTime = database.calculateSessionDuration(
      activeSession.events,
      pauseTime
    );

    // Pause the session with current timestamp
    await database.pauseSession(userId, guildId, pauseTime);

    // Update live channel message
    await liveChannelManager.updateLiveMessage(guildId);
    const embed = createTrackingStatusEmbed(
      userId,
      "paused",
      currentSessionTime
    );
    const buttons = createTrackingButtons("paused");

    return {
      embeds: [embed],
      components: buttons,
    };
  }

  /**
   * Resume tracking for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Object} Response object for Discord
   */
  async resumeTracking(userId, guildId) {
    const activeSession = await database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content: "❌ **Du hast keine aktive Zeiterfassung!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    if (activeSession.status === "ACTIVE") {
      return {
        content: "❌ **Deine Session läuft bereits!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Resume the session
    await database.resumeSession(userId, guildId, new Date());

    // Update live channel message
    await liveChannelManager.updateLiveMessage(guildId);

    // Calculate accumulated time from events
    const currentTime = database.calculateSessionDuration(activeSession.events);

    const embed = createTrackingStatusEmbed(userId, "active", currentTime);
    const buttons = createTrackingButtons("active");

    return {
      embeds: [embed],
      components: buttons,
    };
  }

  /**
   * Calculate adjusted time for a session (accounting for pauses)
   * @param {Object} session - The session object
   * @returns {number} Adjusted time in milliseconds
   */
  calculateAdjustedTime(session) {
    // Use the new event-based calculation from database
    if (session.events) {
      return database.calculateSessionDuration(session.events);
    }

    // Fallback for sessions without events (shouldn't happen with new system)
    return 0;
  }
}
