import PrismaService from "../database/prisma.js";
import {
  sendChannelMessage,
  editChannelMessage,
  getDiscordUsers,
} from "./discordApi.js";
import { formatTime } from "./helpers.js";

const database = new PrismaService();

/**
 * Manager for live channel message updates
 */
export class LiveChannelManager {
  /**
   * Update the live channel message with current online users
   * @param {string} guildId - Discord guild ID
   */
  async updateLiveMessage(guildId) {
    try {
      const settings = await database.getGuildSettings(guildId);
      if (!settings?.liveChannelId) {
        return; // Live channel not configured
      }

      const activeSessions = await database.getAllActiveSessions(guildId);
      const messageContent = await this.createLiveMessageContent(
        activeSessions
      );

      if (settings.liveMessageId) {
        // Try to update existing message
        try {
          await editChannelMessage(
            settings.liveChannelId,
            settings.liveMessageId,
            messageContent
          );
        } catch (error) {
          console.log(
            `Failed to update existing live message (${settings.liveMessageId}), creating new one:`,
            error.message
          );
          // If update fails (message deleted, permissions, etc.), create a new message
          const message = await sendChannelMessage(
            settings.liveChannelId,
            messageContent
          );

          // Save the new message ID
          await database.setGuildSettings(guildId, {
            liveMessageId: message.id,
          });
        }
      } else {
        // Create new live message
        const message = await sendChannelMessage(
          settings.liveChannelId,
          messageContent
        );

        // Save the message ID for future updates
        await database.setGuildSettings(guildId, {
          liveMessageId: message.id,
        });
      }
    } catch (error) {
      console.error("Error updating live message:", error);
    }
  }

  /**
   * Create the content for the live message
   * @param {Array} activeSessions - Array of active sessions
   * @returns {Promise<Object>} Message content object
   */
  async createLiveMessageContent(activeSessions) {
    if (activeSessions.length === 0) {
      return {
        embeds: [
          {
            title: "🔴 On-Off Live Status",
            description: "🔕 Aktuell sind keine Benutzer online.",
            color: 0x808080, // Gray
            timestamp: new Date().toISOString(),
            footer: {
              text: "Live-Status • Wird automatisch aktualisiert",
            },
          },
        ],
      };
    }

    // Get Discord user information for all active users
    const userIds = activeSessions.map((session) => session.userId);
    const discordUsers = await getDiscordUsers(userIds);

    const onlineEntries = activeSessions.map((session) => {
      const sessionDuration = database.calculateSessionDuration(session.events);
      const statusEmoji = session.status === "ACTIVE" ? "🟢" : "⏸️";
      const statusText = session.status === "ACTIVE" ? "Aktiv" : "Pausiert";

      // Get display name
      const discordUser = discordUsers[session.userId];
      const displayName = discordUser
        ? discordUser.global_name ||
          discordUser.username ||
          `<@${session.userId}>`
        : `<@${session.userId}>`;

      return (
        `${statusEmoji} **${displayName}** - ${statusText}\n` +
        `⏱️ Session: ${formatTime(sessionDuration)}\n` +
        `🕐 Gestartet: <t:${Math.floor(session.startTime.getTime() / 1000)}:R>`
      );
    });

    return {
      embeds: [
        {
          title: "🟢 On-Off Live Status",
          description: onlineEntries.join("\n\n"),
          color: 0x00ff00, // Green
          timestamp: new Date().toISOString(),
          footer: {
            text: `${activeSessions.length} Benutzer online • Live-Status • Wird automatisch aktualisiert`,
          },
        },
      ],
    };
  }

  /**
   * Clear the live message (when disabling live channel)
   * @param {string} guildId - Discord guild ID
   */
  async clearLiveMessage(guildId) {
    try {
      const settings = await database.getGuildSettings(guildId);
      if (settings?.liveChannelId && settings?.liveMessageId) {
        const clearContent = {
          embeds: [
            {
              title: "🔴 On-Off Live Status",
              description: "🔕 Live-Tracking wurde deaktiviert.",
              color: 0x808080, // Gray
              timestamp: new Date().toISOString(),
            },
          ],
        };

        await editChannelMessage(
          settings.liveChannelId,
          settings.liveMessageId,
          clearContent
        );
      }

      // Clear the stored message ID
      await database.setGuildSettings(guildId, {
        liveMessageId: null,
      });
    } catch (error) {
      console.error("Error clearing live message:", error);
    }
  }
}
