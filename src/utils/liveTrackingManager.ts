import { EmbedBuilder, TextChannel, Client, Message } from "discord.js";
import { database } from "../database/database";
import { formatTime } from "./helpers";

export class LiveTrackingManager {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Updates the live tracking message for a guild
   */
  async updateLiveMessage(guildId: string): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);

      // Skip if no live channel is set
      if (!settings?.liveChannelId) {
        return;
      }

      // Get the live channel
      const channel = await this.client.channels.fetch(settings.liveChannelId);
      if (!channel || !this.isTextChannel(channel)) {
        console.warn(
          `Live channel ${settings.liveChannelId} not found or not a text channel`
        );
        return;
      }

      // Get all active sessions for this guild
      const activeSessions = database.getAllActiveSessions(guildId);

      // Create the embed with current players
      const embed = await this.createLiveTrackingEmbed(activeSessions);

      // Try to update existing message or create new one
      let message: Message | null = null;

      if (settings.liveMessageId) {
        try {
          message = await channel.messages.fetch(settings.liveMessageId);
          await message.edit({ embeds: [embed] });
        } catch (error) {
          console.warn(`Could not update existing live message: ${error}`);
          message = null;
        }
      }

      // If no existing message or update failed, create new one
      if (!message) {
        message = await channel.send({ embeds: [embed] });

        // Update settings with new message ID
        const updatedSettings = {
          ...settings,
          liveMessageId: message.id,
        };
        database.createOrUpdateGuildSettings(updatedSettings);
      }
    } catch (error) {
      console.error("Error updating live tracking message:", error);
    }
  }

  /**
   * Creates an embed for the live tracking display
   */
  private async createLiveTrackingEmbed(
    activeSessions: any[]
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle("🎮 Live Tracking - Wer spielt gerade")
      .setColor(0x00ae86)
      .setTimestamp()
      .setFooter({
        text: "Aktualisiert sich automatisch wenn Spieler die Zeiterfassung starten/stoppen",
      });

    if (activeSessions.length === 0) {
      embed.setDescription(
        "🔕 **Niemand erfasst gerade Zeit.**\n\nVerwende `/play` um deine Spielzeit zu erfassen!"
      );
      return embed;
    }

    // Fetch user information and create description with players listed vertically
    const playerEntries = await Promise.all(
      activeSessions.map(async (session) => {
        try {
          // Try to get user from cache first, then fetch if needed
          let user = this.client.users.cache.get(session.userId);
          if (!user) {
            user = await this.client.users.fetch(session.userId);
          }

          const currentTime = Date.now() - session.startTime.getTime();
          const adjustedTime = Math.max(
            0,
            currentTime - (session.pausedTime || 0)
          );

          const statusEmoji = session.status === "active" ? "🟢" : "⏸️";
          const statusText =
            session.status === "active" ? "Spielt" : "Pausiert";

          return `${statusEmoji} **${
            user.displayName
          }** • ${statusText} • ${formatTime(adjustedTime)}`;
        } catch (error) {
          console.warn(`Could not fetch user ${session.userId}:`, error);
          const statusEmoji = session.status === "active" ? "🟢" : "⏸️";
          const statusText =
            session.status === "active" ? "Spielt" : "Pausiert";
          return `${statusEmoji} **Unbekannter Benutzer** • ${statusText} • ${formatTime(
            Date.now() - session.startTime.getTime()
          )}`;
        }
      })
    );

    const description = `🎯 **${activeSessions.length} Spieler erfass${
      activeSessions.length > 1 ? "en" : "t"
    } gerade Zeit**\n\n${playerEntries.join("\n")}`;

    embed.setDescription(description);

    return embed;
  }

  /**
   * Removes the live tracking message when live channel is disabled
   */
  async removeLiveMessage(guildId: string): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);

      if (!settings?.liveMessageId || !settings?.liveChannelId) {
        return;
      }

      // Get the channel and message
      const channel = await this.client.channels.fetch(settings.liveChannelId);
      if (!channel || !this.isTextChannel(channel)) {
        return;
      }

      try {
        const message = await channel.messages.fetch(settings.liveMessageId);
        await message.delete();
      } catch (error) {
        console.warn(`Could not delete live message: ${error}`);
      }

      // Clear the message ID from settings
      const updatedSettings = {
        ...settings,
        liveMessageId: null,
      };
      database.createOrUpdateGuildSettings(updatedSettings);
    } catch (error) {
      console.error("Error removing live tracking message:", error);
    }
  }

  /**
   * Type guard to check if channel is a text channel
   */
  private isTextChannel(channel: any): channel is TextChannel {
    return channel && channel.type === 0; // GuildText
  }

  /**
   * Updates the live message periodically for all guilds
   * This should be called on a timer to update the time displays
   */
  async updateAllLiveMessages(): Promise<void> {
    try {
      // Get all guilds that have live channels configured
      const guilds = this.client.guilds.cache;

      for (const [guildId] of guilds) {
        const settings = database.getGuildSettings(guildId);
        if (settings?.liveChannelId) {
          await this.updateLiveMessage(guildId);
        }
      }
    } catch (error) {
      console.error("Error updating all live messages:", error);
    }
  }
}
