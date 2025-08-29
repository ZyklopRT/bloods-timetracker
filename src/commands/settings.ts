import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { database } from "../index";
import { hasAdminPermission, isValidSnowflake } from "../utils/helpers";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure time tracking bot settings (Admin only)")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("channel")
        .setDescription("Set the channel for time tracking notifications")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to send notifications to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("toggle")
        .setDescription("Toggle various time tracking features")
        .addStringOption((option) =>
          option
            .setName("feature")
            .setDescription("Feature to toggle")
            .setRequired(true)
            .addChoices(
              { name: "Online Messages", value: "online_messages" },
              { name: "Offline Messages", value: "offline_messages" },
              { name: "Tracking List", value: "tracking_list" }
            )
        )
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Enable or disable the feature")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("view").setDescription("View current bot settings")
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

      // Get current settings or create defaults
      let settings = database.getGuildSettings(guildId);
      if (!settings) {
        settings = {
          guildId,
          showOnlineMessages: true,
          showOfflineMessages: true,
          showTrackingList: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        database.createOrUpdateGuildSettings(settings);
      }

      switch (subcommand) {
        case "channel": {
          const channel = interaction.options.getChannel("channel", true);

          if (channel.type !== ChannelType.GuildText) {
            await interaction.reply({
              content: "❌ Please select a text channel.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Update settings
          database.createOrUpdateGuildSettings({
            ...settings,
            trackingChannelId: channel.id,
          });

          await interaction.reply({
            content: `✅ Time tracking notifications will now be sent to ${channel}.`,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        case "toggle": {
          const feature = interaction.options.getString("feature", true);
          const enabled = interaction.options.getBoolean("enabled", true);

          const updates: any = { ...settings };
          let featureName = "";

          switch (feature) {
            case "online_messages":
              updates.showOnlineMessages = enabled;
              featureName = "Online Messages";
              break;
            case "offline_messages":
              updates.showOfflineMessages = enabled;
              featureName = "Offline Messages";
              break;
            case "tracking_list":
              updates.showTrackingList = enabled;
              featureName = "Tracking List";
              break;
          }

          database.createOrUpdateGuildSettings(updates);

          await interaction.reply({
            content: `✅ ${featureName} ${enabled ? "enabled" : "disabled"}.`,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        case "view": {
          const embed = new EmbedBuilder()
            .setTitle("⚙️ Time Tracking Settings")
            .setColor(0x0099ff)
            .addFields(
              {
                name: "📢 Notification Channel",
                value: settings.trackingChannelId
                  ? `<#${settings.trackingChannelId}>`
                  : "Not set",
                inline: true,
              },
              {
                name: "🟢 Online Messages",
                value: settings.showOnlineMessages
                  ? "✅ Enabled"
                  : "❌ Disabled",
                inline: true,
              },
              {
                name: "🔴 Offline Messages",
                value: settings.showOfflineMessages
                  ? "✅ Enabled"
                  : "❌ Disabled",
                inline: true,
              },
              {
                name: "📋 Tracking List",
                value: settings.showTrackingList ? "✅ Enabled" : "❌ Disabled",
                inline: true,
              },
              {
                name: "📝 Tracking List Message",
                value: settings.trackingListMessageId
                  ? "Active"
                  : "Not created yet",
                inline: true,
              }
            )
            .setFooter({
              text: "Use /settings channel and /settings toggle to modify these settings",
            })
            .setTimestamp();

          await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        default:
          await interaction.reply({
            content: "❌ Unknown subcommand.",
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (error) {
      console.error("Error in settings command:", error);
      await interaction.reply({
        content: "❌ Failed to update settings. Please try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
