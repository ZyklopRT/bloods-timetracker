import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  User,
  MessageFlags,
  ChatInputCommandInteraction,
  ButtonInteraction,
} from "discord.js";
import { database } from "../index";
import { TimeTrackingSession, TrackingListUser } from "../types";
import {
  generateSessionId,
  createSessionStartEmbed,
  createSessionEndEmbed,
  createSessionPauseEmbed,
  createSessionResumeEmbed,
  createTrackingListEmbed,
  formatDetailedTime,
} from "./helpers";

export class TimeTrackingManager {
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
          content: `⚠️ You already have an active time tracking session! Use the pause/stop buttons in your DMs or run \`/stop\` to end it.`,
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

      // Send initial reply
      await interaction.reply({
        content: "🟢 Time tracking started! Check your DMs for controls.",
        flags: MessageFlags.Ephemeral,
      });

      // Send control buttons via DM
      await this.sendControlButtons(interaction.user, sessionId);

      // Send notification in channel (if enabled)
      await this.sendStartNotification(interaction.user, guildId);

      // Update tracking list (if enabled)
      await this.updateTrackingList(guildId);
    } catch (error) {
      console.error("Error starting tracking:", error);
      await interaction.reply({
        content: "❌ Failed to start time tracking. Please try again.",
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
      const session = database.getActiveSession(userId, guildId);
      if (!session) {
        await interaction.reply({
          content: "⚠️ You don't have an active time tracking session.",
          flags: MessageFlags.Ephemeral,
        });
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

      // Reply to interaction
      const replyMessage = `🔴 Time tracking stopped! You were active for **${formatDetailedTime(
        adjustedDuration
      )}**.`;

      if (interaction.isButton()) {
        await interaction.update({
          content: replyMessage,
          components: [],
          embeds: [],
        });
      } else {
        await interaction.reply({
          content: replyMessage,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Send notification in channel (if enabled)
      await this.sendStopNotification(
        interaction.user,
        guildId,
        adjustedDuration
      );

      // Update tracking list (if enabled)
      await this.updateTrackingList(guildId);
    } catch (error) {
      console.error("Error stopping tracking:", error);
      const errorMsg = "❌ Failed to stop time tracking. Please try again.";

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
      const session = database.getActiveSession(userId, guildId);
      if (!session) {
        await interaction.reply({
          content: "⚠️ You don't have an active time tracking session.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.status === "paused") {
        await interaction.reply({
          content: "⚠️ Your tracking is already paused.",
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
        .setLabel("Resume")
        .setStyle(ButtonStyle.Success)
        .setEmoji("▶️");

      const stopButton = new ButtonBuilder()
        .setCustomId("stop_tracking")
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏹️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        resumeButton,
        stopButton
      );

      await interaction.update({
        content:
          "⏸️ Time tracking paused. Click **Resume** to continue or **Stop** to end your session.",
        components: [row],
      });

      // Send notification in channel (if enabled)
      await this.sendPauseNotification(interaction.user, guildId);

      // Update tracking list (if enabled)
      await this.updateTrackingList(guildId);
    } catch (error) {
      console.error("Error pausing tracking:", error);
      await interaction.reply({
        content: "❌ Failed to pause time tracking. Please try again.",
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
      const session = database.getActiveSession(userId, guildId);
      if (!session) {
        await interaction.reply({
          content: "⚠️ You don't have an active time tracking session.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.status === "active") {
        await interaction.reply({
          content: "⚠️ Your tracking is already active.",
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
        .setLabel("Pause")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏸️");

      const stopButton = new ButtonBuilder()
        .setCustomId("stop_tracking")
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏹️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        pauseButton,
        stopButton
      );

      await interaction.update({
        content:
          "▶️ Time tracking resumed! Click **Pause** to pause or **Stop** to end your session.",
        components: [row],
      });

      // Send notification in channel (if enabled)
      await this.sendResumeNotification(interaction.user, guildId);

      // Update tracking list (if enabled)
      await this.updateTrackingList(guildId);
    } catch (error) {
      console.error("Error resuming tracking:", error);
      await interaction.reply({
        content: "❌ Failed to resume time tracking. Please try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Sends control buttons to user's DM
   */
  private async sendControlButtons(
    user: User,
    sessionId: string
  ): Promise<void> {
    try {
      const pauseButton = new ButtonBuilder()
        .setCustomId("pause_tracking")
        .setLabel("Pause")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⏸️");

      const stopButton = new ButtonBuilder()
        .setCustomId("stop_tracking")
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏹️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        pauseButton,
        stopButton
      );

      await user.send({
        content:
          "🕒 **Time Tracking Controls**\n\nYour time tracking session has started! Use the buttons below to control your session:",
        components: [row],
      });
    } catch (error) {
      console.error("Failed to send DM to user:", error);
      // User might have DMs disabled
    }
  }

  /**
   * Sends start notification in the guild channel
   */
  private async sendStartNotification(
    user: User,
    guildId: string
  ): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);
      if (!settings?.showOnlineMessages || !settings.trackingChannelId) return;

      const guild = user.client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(
        settings.trackingChannelId
      ) as TextChannel;
      if (!channel) return;

      const embed = createSessionStartEmbed(user);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to send start notification:", error);
    }
  }

  /**
   * Sends stop notification in the guild channel
   */
  private async sendStopNotification(
    user: User,
    guildId: string,
    duration: number
  ): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);
      if (!settings?.showOfflineMessages || !settings.trackingChannelId) return;

      const guild = user.client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(
        settings.trackingChannelId
      ) as TextChannel;
      if (!channel) return;

      const embed = createSessionEndEmbed(user, duration);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to send stop notification:", error);
    }
  }

  /**
   * Sends pause notification in the guild channel
   */
  private async sendPauseNotification(
    user: User,
    guildId: string
  ): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);
      if (!settings?.showOnlineMessages || !settings.trackingChannelId) return;

      const guild = user.client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(
        settings.trackingChannelId
      ) as TextChannel;
      if (!channel) return;

      const embed = createSessionPauseEmbed(user);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to send pause notification:", error);
    }
  }

  /**
   * Sends resume notification in the guild channel
   */
  private async sendResumeNotification(
    user: User,
    guildId: string
  ): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);
      if (!settings?.showOnlineMessages || !settings.trackingChannelId) return;

      const guild = user.client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(
        settings.trackingChannelId
      ) as TextChannel;
      if (!channel) return;

      const embed = createSessionResumeEmbed(user);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to send resume notification:", error);
    }
  }

  /**
   * Updates the tracking list message
   */
  private async updateTrackingList(guildId: string): Promise<void> {
    try {
      const settings = database.getGuildSettings(guildId);
      if (!settings?.showTrackingList || !settings.trackingChannelId) return;

      const activeSessions = database.getAllActiveSessions(guildId);
      if (activeSessions.length === 0 && !settings.trackingListMessageId)
        return;

      const guild = activeSessions[0]?.userId ? activeSessions[0].userId : null;

      if (!guild) return;

      const guildObj = await (activeSessions[0] as any).client?.guilds.fetch(
        guildId
      );
      if (!guildObj) return;

      const channel = guildObj.channels.cache.get(
        settings.trackingChannelId
      ) as TextChannel;
      if (!channel) return;

      // Create tracking list data
      const trackingUsers: TrackingListUser[] = [];

      for (const session of activeSessions) {
        try {
          const user = await guildObj.members.fetch(session.userId);
          trackingUsers.push({
            userId: session.userId,
            username: user.displayName,
            startTime: session.startTime,
            status: session.status,
          });
        } catch (error) {
          console.error(`Failed to fetch user ${session.userId}:`, error);
        }
      }

      const embed = createTrackingListEmbed(trackingUsers);

      // Update or create the tracking list message
      if (settings.trackingListMessageId) {
        try {
          const message = await channel.messages.fetch(
            settings.trackingListMessageId
          );
          await message.edit({ embeds: [embed] });
        } catch (error) {
          // Message might have been deleted, create a new one
          const newMessage = await channel.send({ embeds: [embed] });
          database.createOrUpdateGuildSettings({
            ...settings,
            trackingListMessageId: newMessage.id,
          });
        }
      } else {
        const newMessage = await channel.send({ embeds: [embed] });
        database.createOrUpdateGuildSettings({
          ...settings,
          trackingListMessageId: newMessage.id,
        });
      }
    } catch (error) {
      console.error("Failed to update tracking list:", error);
    }
  }
}
