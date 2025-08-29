import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  MessageFlags,
  ChatInputCommandInteraction,
  ButtonInteraction,
  TextChannel,
  Client,
} from "discord.js";
import { database } from "../database/database";
import { TimeTrackingSession } from "../types";
import {
  generateSessionId,
  formatDetailedTime,
  validateTrackingChannel,
} from "./helpers";
import { LiveTrackingManager } from "./liveTrackingManager";

export class TimeTrackingManager {
  private liveTrackingManager: LiveTrackingManager;

  constructor(client: Client) {
    this.liveTrackingManager = new LiveTrackingManager(client);
  }

  /**
   * Starts time tracking for a user
   */
  async startTracking(
    userId: string,
    guildId: string,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    try {
      // Check if user already has an active session
      const existingSession = database.getActiveSession(userId, guildId);
      if (existingSession) {
        await interaction.reply({
          content: `⚠️ Du hast bereits eine aktive On-Off! Verwende die Buttons unten, um sie zu steuern.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Create new session
      const sessionId = generateSessionId();
      const newSession: Omit<TimeTrackingSession, "createdAt" | "updatedAt"> = {
        id: sessionId,
        userId,
        guildId,
        startTime: new Date(),
        status: "active",
        pausedTime: 0,
      };

      database.createSession(newSession);

      // Create control buttons for ephemeral message
      const pauseButton = new ButtonBuilder()
        .setCustomId("pause_tracking")
        .setLabel("Pausieren")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏸️");

      const stopButton = new ButtonBuilder()
        .setCustomId("stop_tracking")
        .setLabel("Stoppen")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏹️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        pauseButton,
        stopButton
      );

      // Send ephemeral reply with controls
      await interaction.reply({
        content: `🕒 **On-Off gestartet!**\n\nDeine Session ist jetzt aktiv. Verwende die Buttons unten, um deine Session zu steuern:`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });

      // Send public notification that user started playing
      await this.sendStartNotification(interaction.user, interaction);

      // Update live tracking message
      await this.liveTrackingManager.updateLiveMessage(guildId);
    } catch (error) {
      console.error("Error starting tracking:", error);
      await interaction.reply({
        content:
          "❌ On-Off konnte nicht gestartet werden. Bitte versuche es erneut.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Stops time tracking for a user
   */
  async stopTracking(
    userId: string,
    guildId: string,
    interaction: ChatInputCommandInteraction | ButtonInteraction
  ): Promise<void> {
    try {
      // Validate if tracking is allowed in this channel (only for button interactions, slash commands already validated)
      if (
        interaction.isButton() &&
        !(await validateTrackingChannel(interaction))
      ) {
        return;
      }
      const session = database.getActiveSession(userId, guildId);
      if (!session) {
        const errorMsg = "⚠️ Du hast keine aktive On-Off.";

        if (interaction.isButton()) {
          await interaction.reply({
            content: errorMsg,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: errorMsg,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      const endTime = new Date();
      const sessionDuration = endTime.getTime() - session.startTime.getTime();
      const adjustedDuration = Math.max(
        0,
        sessionDuration - (session.pausedTime || 0)
      );

      // Update session in database
      database.updateSession(session.id, {
        endTime,
        status: "stopped",
      });

      // Update user stats
      database.updateUserStats(userId, guildId, adjustedDuration);

      // Send public stop notification
      await this.sendStopNotification(
        interaction.user,
        adjustedDuration,
        interaction
      );

      // Update live tracking message
      await this.liveTrackingManager.updateLiveMessage(guildId);

      // Update the ephemeral message briefly, then delete it
      const replyMessage = `🔴 **On-Off beendet!**\n\nDu hast **${formatDetailedTime(
        adjustedDuration
      )}** gespielt. Tolle Session! 🎉\n\n*Diese Nachricht wird in 3 Sekunden gelöscht...*`;

      if (interaction.isButton()) {
        await interaction.update({
          content: replyMessage,
          components: [],
        });

        // Delete the ephemeral message after 3 seconds
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {
            console.error("Failed to delete ephemeral message:", error);
          }
        }, 3000);
      } else {
        await interaction.reply({
          content: replyMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("Error stopping tracking:", error);
      const errorMsg =
        "❌ On-Off konnte nicht beendet werden. Bitte versuche es erneut.";

      if (interaction.isButton()) {
        await interaction.reply({
          content: errorMsg,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: errorMsg,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }

  /**
   * Pauses time tracking for a user
   */
  async pauseTracking(
    userId: string,
    guildId: string,
    interaction: ButtonInteraction
  ): Promise<void> {
    try {
      // Validate if tracking is allowed in this channel
      if (!(await validateTrackingChannel(interaction))) {
        return;
      }
      const session = database.getActiveSession(userId, guildId);
      if (!session) {
        await interaction.reply({
          content: "⚠️ Du hast keine aktive On-Off.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.status === "paused") {
        await interaction.reply({
          content: "⚠️ Deine On-Off ist bereits pausiert.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Start pause period
      database.startPause(session.id);
      database.updateSession(session.id, { status: "paused" });

      // Update buttons to show resume option
      const resumeButton = new ButtonBuilder()
        .setCustomId("resume_tracking")
        .setLabel("Fortsetzen")
        .setStyle(ButtonStyle.Success)
        .setEmoji("▶️");

      const stopButton = new ButtonBuilder()
        .setCustomId("stop_tracking")
        .setLabel("Stoppen")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏹️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        resumeButton,
        stopButton
      );

      await interaction.update({
        content:
          "⏸️ **On-Off pausiert**\n\nDeine Session ist pausiert. Klicke **Fortsetzen** um fortzufahren oder **Stoppen** um die Session zu beenden.",
        components: [row],
      });

      // Update live tracking message
      await this.liveTrackingManager.updateLiveMessage(guildId);
    } catch (error) {
      console.error("Error pausing tracking:", error);
      await interaction.reply({
        content:
          "❌ On-Off konnte nicht pausiert werden. Bitte versuche es erneut.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Resumes time tracking for a user
   */
  async resumeTracking(
    userId: string,
    guildId: string,
    interaction: ButtonInteraction
  ): Promise<void> {
    try {
      // Validate if tracking is allowed in this channel
      if (!(await validateTrackingChannel(interaction))) {
        return;
      }
      const session = database.getActiveSession(userId, guildId);
      if (!session) {
        await interaction.reply({
          content: "⚠️ Du hast keine aktive On-Off.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.status === "active") {
        await interaction.reply({
          content: "⚠️ Deine On-Off ist bereits aktiv.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // End pause period and add to total paused time
      const pauseDuration = database.endPause(session.id);
      const newPausedTime = (session.pausedTime || 0) + pauseDuration;

      database.updateSession(session.id, {
        status: "active",
        pausedTime: newPausedTime,
      });

      // Update buttons back to pause/stop
      const pauseButton = new ButtonBuilder()
        .setCustomId("pause_tracking")
        .setLabel("Pausieren")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏸️");

      const stopButton = new ButtonBuilder()
        .setCustomId("stop_tracking")
        .setLabel("Stoppen")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏹️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        pauseButton,
        stopButton
      );

      await interaction.update({
        content:
          "▶️ **On-Off fortgesetzt**\n\nDeine Session ist wieder aktiv. Klicke **Pausieren** zum Pausieren oder **Stoppen** um die Session zu beenden.",
        components: [row],
      });

      // Update live tracking message
      await this.liveTrackingManager.updateLiveMessage(guildId);
    } catch (error) {
      console.error("Error resuming tracking:", error);
      await interaction.reply({
        content:
          "❌ On-Off konnte nicht fortgesetzt werden. Bitte versuche es erneut.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Sends start notification in the designated tracking channel or current channel
   */
  private async sendStartNotification(
    user: User,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const settings = database.getGuildSettings(guildId);

      // Skip notifications if disabled
      if (settings && !settings.showOnlineMessages) {
        return;
      }

      let targetChannel = interaction.channel;

      // Use designated tracking channel if set and available
      if (settings?.trackingChannelId) {
        try {
          const trackingChannel = (await interaction.client.channels.fetch(
            settings.trackingChannelId
          )) as TextChannel;
          if (trackingChannel && trackingChannel.type === 0) {
            // GuildText
            targetChannel = trackingChannel;
          }
        } catch (error) {
          console.warn(
            `Could not fetch tracking channel ${settings.trackingChannelId}:`,
            error
          );
          // Fallback to current channel
        }
      }

      if (targetChannel && "send" in targetChannel) {
        await targetChannel.send({
          content: `🎮 **${user.displayName}** spielt jetzt!`,
        });
      }
    } catch (error) {
      console.error("Failed to send start notification:", error);
    }
  }

  /**
   * Sends stop notification in the designated tracking channel or current channel
   */
  private async sendStopNotification(
    user: User,
    duration: number,
    interaction: ChatInputCommandInteraction | ButtonInteraction
  ): Promise<void> {
    try {
      const guildId = interaction.guildId!;
      const settings = database.getGuildSettings(guildId);

      // Skip notifications if disabled
      if (settings && !settings.showOfflineMessages) {
        return;
      }

      let targetChannel = interaction.channel;

      // Use designated tracking channel if set and available
      if (settings?.trackingChannelId) {
        try {
          const trackingChannel = (await interaction.client.channels.fetch(
            settings.trackingChannelId
          )) as TextChannel;
          if (trackingChannel && trackingChannel.type === 0) {
            // GuildText
            targetChannel = trackingChannel;
          }
        } catch (error) {
          console.warn(
            `Could not fetch tracking channel ${settings.trackingChannelId}:`,
            error
          );
          // Fallback to current channel
        }
      }

      if (targetChannel && "send" in targetChannel) {
        await targetChannel.send({
          content: `🔴 **${
            user.displayName
          }** spielt nicht mehr und hat **${formatDetailedTime(
            duration
          )}** gespielt!`,
        });
      }
    } catch (error) {
      console.error("Failed to send stop notification:", error);
    }
  }
}
