import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} from "discord.js";
import { database } from "../database/database";
import { Command, GuildSettings } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure time tracking bot settings")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("channel")
        .setDescription("Set the dedicated time tracking channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "Channel for time tracking (leave empty to allow all channels)"
            )
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Check permissions
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: "❌ You need Administrator permissions to use this command.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;

      if (subcommand === "channel") {
        await setTrackingChannel(interaction, guildId);
      } else {
        await interaction.reply({
          content: "❌ Unknown subcommand.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("Error in settings command:", error);
      await interaction.reply({
        content: "❌ Failed to process settings. Please try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

async function setTrackingChannel(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const channel = interaction.options.getChannel("channel");

  // Get or create guild settings
  let settings = database.getGuildSettings(guildId);
  if (!settings) {
    settings = {
      guildId,
      showOnlineMessages: true,
      showOfflineMessages: true,
      showTrackingList: true,
      autoDeleteMessages: false,
      messageDeleteDelay: 30,
      requireTimeMinimum: false,
      minimumTimeMinutes: 5,
      allowSelfTracking: true,
      enableLeaderboard: true,
      leaderboardUpdateInterval: 60,
      timezone: "UTC",
      embedColor: "#0099ff",
      botPrefix: "!",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const updatedSettings: Omit<GuildSettings, "createdAt" | "updatedAt"> = {
    ...settings,
    trackingChannelId: channel?.id || null,
  };

  database.createOrUpdateGuildSettings(updatedSettings);

  if (channel) {
    await interaction.reply({
      content: `✅ **Tracking channel set!**\n\nTime tracking commands will now only work in ${channel}.\n\n⚠️ **Important:** Users can only start/stop tracking in this channel.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: `✅ **Channel restriction removed!**\n\nTime tracking commands can now be used in any channel.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export default command;
