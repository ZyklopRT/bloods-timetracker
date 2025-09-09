import PrismaService from "../database/prisma.js";

const database = new PrismaService();

/**
 * Format milliseconds into a human-readable time string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
export function formatTime(ms) {
  if (ms <= 0) return "0m";

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Calculate adjusted time for a session (accounting for pauses)
 * @param {Object} session - The session object
 * @returns {number} Adjusted time in milliseconds
 */
export function calculateAdjustedTime(session) {
  // Use the event-based calculation from database
  if (session.events) {
    return database.calculateSessionDuration(session.events);
  }

  // Fallback for sessions without events (shouldn't happen with new system)
  return 0;
}

/**
 * Validates if the current channel is allowed for time tracking
 * @param {string} guildId - Guild ID
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object>} Validation result with isValid and message
 */
export async function validateTrackingChannel(guildId, channelId) {
  const settings = await database.getGuildSettings(guildId);

  // If no tracking channel is set, allow all channels
  if (!settings?.trackingChannelId) {
    return { isValid: true };
  }

  // Check if current channel matches the designated tracking channel
  if (channelId === settings.trackingChannelId) {
    return { isValid: true };
  }

  // If we reach here, the user is in the wrong channel
  return {
    isValid: false,
    message: `❌ **On-Off nur in bestimmtem Kanal erlaubt!**\n\nBitte verwende die On-Off nur in <#${settings.trackingChannelId}>.`,
  };
}

/**
 * Create tracking control buttons
 * @param {string} status - Current tracking status ('active', 'paused', 'stopped')
 * @returns {Array} Array of button components
 */
export function createTrackingButtons(status) {
  const buttons = [];

  if (status === "active") {
    buttons.push(
      {
        type: 2, // BUTTON
        style: 2, // SECONDARY
        label: "Pausieren",
        emoji: { name: "⏸️" },
        custom_id: "pause_tracking",
      },
      {
        type: 2, // BUTTON
        style: 4, // DANGER
        label: "Stoppen",
        emoji: { name: "⏹️" },
        custom_id: "stop_tracking",
      }
    );
  } else if (status === "paused") {
    buttons.push(
      {
        type: 2, // BUTTON
        style: 3, // SUCCESS
        label: "Fortsetzen",
        emoji: { name: "▶️" },
        custom_id: "resume_tracking",
      },
      {
        type: 2, // BUTTON
        style: 4, // DANGER
        label: "Stoppen",
        emoji: { name: "⏹️" },
        custom_id: "stop_tracking",
      }
    );
  }

  return buttons.length > 0
    ? [
        {
          type: 1, // ACTION_ROW
          components: buttons,
        },
      ]
    : [];
}

/**
 * Create success embed for tracking start
 * @param {string} userId - User ID
 * @param {number} startTime - Start timestamp
 * @returns {Object} Embed object
 */
export function createTrackingStartEmbed(userId, startTime) {
  return {
    title: "🟢 On-Off Session gestartet!",
    description: `<@${userId}>, deine Zeiterfassung läuft jetzt.`,
    fields: [
      {
        name: "🕐 Gestartet",
        value: `<t:${Math.floor(startTime / 1000)}:R>`,
        inline: true,
      },
      {
        name: "⏱️ Status",
        value: "🟢 Aktiv",
        inline: true,
      },
    ],
    color: 0x00ff00, // Green
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create embed for tracking stop with session summary
 * @param {string} userId - User ID
 * @param {number} sessionTime - Session duration in milliseconds
 * @param {number} totalTime - Total time across all sessions
 * @param {number} sessionsCount - Number of completed sessions
 * @returns {Object} Embed object
 */
export function createTrackingStopEmbed(
  userId,
  sessionTime,
  totalTime,
  sessionsCount
) {
  return {
    title: "🔴 On-Off Session beendet!",
    description: `<@${userId}>, deine Session wurde erfolgreich beendet.`,
    fields: [
      {
        name: "⏱️ Session Dauer",
        value: formatTime(sessionTime),
        inline: true,
      },
      {
        name: "🏆 Gesamtzeit",
        value: formatTime(totalTime),
        inline: true,
      },
      {
        name: "📈 Sessions Gesamt",
        value: sessionsCount.toString(),
        inline: true,
      },
    ],
    color: 0xff0000, // Red
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create embed for tracking status update (pause/resume)
 * @param {string} userId - User ID
 * @param {string} status - New status ('paused' or 'active')
 * @param {number} currentTime - Current session time
 * @returns {Object} Embed object
 */
export function createTrackingStatusEmbed(userId, status, currentTime) {
  const statusInfo =
    status === "active"
      ? { emoji: "▶️", text: "Fortgesetzt", color: 0x00ff00 }
      : { emoji: "⏸️", text: "Pausiert", color: 0xffa500 };

  return {
    title: `${statusInfo.emoji} Session ${statusInfo.text}`,
    description: `<@${userId}>, deine Session wurde ${statusInfo.text.toLowerCase()}.`,
    fields: [
      {
        name: "⏱️ Bisherige Zeit",
        value: formatTime(currentTime),
        inline: true,
      },
      {
        name: "📊 Status",
        value: `${statusInfo.emoji} ${statusInfo.text}`,
        inline: true,
      },
    ],
    color: statusInfo.color,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if a string is a valid Discord snowflake ID
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid snowflake
 */
export function isValidSnowflake(id) {
  return /^\d{17,19}$/.test(id);
}

export { database };
