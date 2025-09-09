import { DatabaseManager } from "../database/database.js";
import {
  formatTime,
  validateTrackingChannel,
  createTrackingButtons,
  createTrackingStartEmbed,
  createTrackingStopEmbed,
  createTrackingStatusEmbed,
} from "./helpers.js";
import { InteractionResponseFlags } from "discord-interactions";

const database = new DatabaseManager();

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
    const channelValidation = validateTrackingChannel(guildId, channelId);
    if (!channelValidation.isValid) {
      return {
        content: channelValidation.message,
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Check if user already has an active session
    const activeSession = database.getActiveSession(userId, guildId);
    if (activeSession) {
      const adjustedTime = this.calculateAdjustedTime(activeSession);
      const statusEmoji = activeSession.status === "active" ? "🟢" : "⏸️";
      const statusText =
        activeSession.status === "active" ? "Aktiv" : "Pausiert";

      return {
        content: `❌ **Du hast bereits eine aktive Session!**\n\n${statusEmoji} Status: **${statusText}**\n⏱️ Bisherige Zeit: **${formatTime(
          adjustedTime
        )}**\n🕐 Gestartet: <t:${Math.floor(
          activeSession.startTime.getTime() / 1000
        )}:R>`,
        components: createTrackingButtons(activeSession.status),
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Start new tracking session
    const startTime = Date.now();
    database.startSession(userId, guildId, new Date(startTime));

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
    const channelValidation = validateTrackingChannel(guildId, channelId);
    if (!channelValidation.isValid) {
      return {
        content: channelValidation.message,
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    const activeSession = database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content:
          "❌ **Du hast keine aktive Zeiterfassung!**\n\nStarte eine neue Session mit `/play`.",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Calculate session duration
    const endTime = new Date();
    const adjustedTime = this.calculateAdjustedTime(activeSession);

    // Stop the session
    database.stopSession(userId, guildId, endTime);

    // Get updated user stats
    const userStats = database.getUserStats(userId, guildId);

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
    const activeSession = database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content: "❌ **Du hast keine aktive Zeiterfassung!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    if (activeSession.status === "paused") {
      return {
        content: "❌ **Deine Session ist bereits pausiert!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Pause the session
    const pausedTime =
      Date.now() -
      activeSession.startTime.getTime() +
      (activeSession.pausedTime || 0);
    database.pauseSession(userId, guildId, pausedTime);

    const embed = createTrackingStatusEmbed(userId, "paused", pausedTime);
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
    const activeSession = database.getActiveSession(userId, guildId);
    if (!activeSession) {
      return {
        content: "❌ **Du hast keine aktive Zeiterfassung!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    if (activeSession.status === "active") {
      return {
        content: "❌ **Deine Session läuft bereits!**",
        flags: InteractionResponseFlags.EPHEMERAL,
      };
    }

    // Resume the session
    database.resumeSession(userId, guildId, new Date());
    const currentTime = activeSession.pausedTime || 0;

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
    if (session.status === "active") {
      return (
        Date.now() - session.startTime.getTime() + (session.pausedTime || 0)
      );
    } else {
      return session.pausedTime || 0;
    }
  }
}
