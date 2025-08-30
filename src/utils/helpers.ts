import {
  EmbedBuilder,
  User,
  ChatInputCommandInteraction,
  ButtonInteraction,
} from "discord.js";
import { TrackingListUser, TimeTrackingSession } from "../types";
import { database } from "../database/database";

/**
 * Formats milliseconds into a human-readable time string
 * @param ms - Time in milliseconds
 * @returns Formatted string like "2h 30m 15s"
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days} Tag${days > 1 ? "e" : ""}`);
  if (remainingHours > 0)
    parts.push(`${remainingHours} Stunde${remainingHours > 1 ? "n" : ""}`);
  if (remainingMinutes > 0)
    parts.push(`${remainingMinutes} Minute${remainingMinutes > 1 ? "n" : ""}`);
  if (remainingSeconds > 0 || parts.length === 0)
    parts.push(`${remainingSeconds} Sekunde${remainingSeconds > 1 ? "n" : ""}`);

  return parts.join(", ");
}

/**
 * Formats a time duration with detailed breakdown
 * @param ms - Time in milliseconds
 * @returns Detailed formatted string
 */
export function formatDetailedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days} Tag${days > 1 ? "e" : ""}`);
  if (remainingHours > 0)
    parts.push(`${remainingHours} Stunde${remainingHours > 1 ? "n" : ""}`);
  if (remainingMinutes > 0)
    parts.push(`${remainingMinutes} Minute${remainingMinutes > 1 ? "n" : ""}`);
  if (remainingSeconds > 0 || parts.length === 0)
    parts.push(`${remainingSeconds} Sekunde${remainingSeconds > 1 ? "n" : ""}`);

  if (parts.length === 1) return parts[0] || "";
  if (parts.length === 2) return parts.join(" und ");

  const lastPart = parts.pop();
  return parts.join(", ") + " und " + lastPart;
}

/**
 * Generates a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculates the adjusted time for a session, properly accounting for paused time
 * @param session - The time tracking session
 * @returns Adjusted time in milliseconds
 */
export function calculateAdjustedTime(session: TimeTrackingSession): number {
  const currentTime = Date.now() - session.startTime.getTime();
  let totalPausedTime = session.pausedTime || 0;

  // If session is paused, add the current pause duration
  if (session.status === "paused") {
    const currentPauseStart = database.getCurrentPauseStartTime(session.id);
    if (currentPauseStart) {
      const currentPauseDuration = Date.now() - currentPauseStart.getTime();
      totalPausedTime += currentPauseDuration;
    }
  }

  return Math.max(0, currentTime - totalPausedTime);
}

/**
 * Creates an embed for tracking list display
 * @param users - Array of users currently being tracked
 * @returns Discord EmbedBuilder
 */
export function createTrackingListEmbed(
  users: TrackingListUser[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🕒 Active Time Tracking")
    .setColor(0x00ae86)
    .setTimestamp();

  if (users.length === 0) {
    embed.setDescription("No users are currently being tracked.");
    return embed;
  }

  const fields = users.map((user) => {
    // For TrackingListUser, we need to calculate time differently since it lacks pausedTime
    // For paused users, we'll show the time as it was when paused (assuming minimal pause tracking in this context)
    const currentTime = Date.now() - user.startTime.getTime();
    const adjustedTime = user.status === "paused" ? 0 : currentTime; // Simple fallback for tracking list
    const statusEmoji = user.status === "active" ? "🟢" : "⏸️";
    const statusText = user.status === "active" ? "Active" : "Paused";

    return {
      name: `${statusEmoji} ${user.username}`,
      value: `**Time:** ${formatTime(adjustedTime)}\n**Status:** ${statusText}`,
      inline: true,
    };
  });

  embed.addFields(fields);
  embed.setFooter({
    text: `${users.length} user${
      users.length > 1 ? "s" : ""
    } currently tracked`,
  });

  return embed;
}

/**
 * Creates an embed for user session start
 * @param user - Discord user
 * @returns Discord EmbedBuilder
 */
export function createSessionStartEmbed(user: User): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🟢 Time Tracking Started")
    .setDescription(`${user.displayName} has started time tracking!`)
    .setColor(0x00ff00)
    .setTimestamp()
    .setThumbnail(user.displayAvatarURL());
}

/**
 * Creates an embed for user session end
 * @param user - Discord user
 * @param duration - Session duration in milliseconds
 * @returns Discord EmbedBuilder
 */
export function createSessionEndEmbed(
  user: User,
  duration: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🔴 Time Tracking Stopped")
    .setDescription(
      `${user.displayName} was online for **${formatDetailedTime(duration)}**`
    )
    .setColor(0xff0000)
    .setTimestamp()
    .setThumbnail(user.displayAvatarURL());
}

/**
 * Creates an embed for user session pause
 * @param user - Discord user
 * @returns Discord EmbedBuilder
 */
export function createSessionPauseEmbed(user: User): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("⏸️ Time Tracking Paused")
    .setDescription(`${user.displayName} has paused their time tracking.`)
    .setColor(0xffaa00)
    .setTimestamp()
    .setThumbnail(user.displayAvatarURL());
}

/**
 * Creates an embed for user session resume
 * @param user - Discord user
 * @returns Discord EmbedBuilder
 */
export function createSessionResumeEmbed(user: User): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("▶️ Time Tracking Resumed")
    .setDescription(`${user.displayName} has resumed their time tracking.`)
    .setColor(0x00ff00)
    .setTimestamp()
    .setThumbnail(user.displayAvatarURL());
}

/**
 * Creates an embed for user statistics
 * @param user - Discord user
 * @param totalTime - Total time tracked in milliseconds
 * @param sessionsCount - Number of sessions completed
 * @param lastSeen - Last seen date
 * @returns Discord EmbedBuilder
 */
export function createUserStatsEmbed(
  user: User,
  totalTime: number,
  sessionsCount: number,
  lastSeen: Date
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`On-Off Statistiken - ${user.displayName}`)
    .setColor(0x0099ff)
    .addFields(
      {
        name: "Gesamte Spielzeit",
        value: formatDetailedTime(totalTime),
        inline: true,
      },
      {
        name: "Abgeschlossene Sessions",
        value: sessionsCount.toString(),
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "Durchschnittliche Session",
        value: formatDetailedTime(totalTime / sessionsCount),
        inline: true,
      },
      {
        name: "Zuletzt gesehen",
        value: `<t:${Math.floor(lastSeen.getTime() / 1000)}:R>`,
        inline: true,
      }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();
}

/**
 * Checks if a user has permission to use admin commands
 * @param user - Discord user
 * @param guildMember - Guild member object
 * @returns boolean
 */
export function hasAdminPermission(guildMember: any): boolean {
  return (
    guildMember.permissions.has("Administrator") ||
    guildMember.permissions.has("ManageGuild") ||
    guildMember.permissions.has("ManageChannels")
  );
}

/**
 * Validates if a string is a valid Discord snowflake ID
 * @param id - String to validate
 * @returns boolean
 */
export function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Validates if the current channel is allowed for time tracking
 * @param interaction - Discord interaction
 * @returns Promise<boolean> - true if allowed, false if not
 */
export async function validateTrackingChannel(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<boolean> {
  const guildId = interaction.guildId!;
  const channelId = interaction.channelId;

  // Get guild settings
  const settings = database.getGuildSettings(guildId);

  // If no tracking channel is set, allow all channels
  if (!settings?.trackingChannelId) {
    return true;
  }

  // Check if current channel matches the designated tracking channel
  if (channelId === settings.trackingChannelId) {
    return true;
  }

  // If we reach here, the user is in the wrong channel
  await interaction.reply({
    content: `❌ **On-Off nur in bestimmtem Kanal erlaubt!**\n\nBitte verwende die On-Off nur in <#${settings.trackingChannelId}>.`,
    flags: interaction.isButton() ? undefined : 64, // MessageFlags.Ephemeral for slash commands
  });

  return false;
}
