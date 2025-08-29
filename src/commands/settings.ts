import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} from "discord.js";
import { database } from "../database/database";
import { Command, GuildSettings } from "../types";
import { LiveTrackingManager } from "../utils/liveTrackingManager";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Zeiterfassung Bot Einstellungen konfigurieren")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("channel")
        .setDescription("Speziellen Zeiterfassungs-Kanal festlegen")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "Kanal für Zeiterfassung (leer lassen um alle Kanäle zu erlauben)"
            )
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("live-channel")
        .setDescription("Live-Tracking Anzeige-Kanal festlegen")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "Kanal für Live-Tracking Anzeige (leer lassen um Live-Tracking zu deaktivieren)"
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
          content:
            "❌ Du benötigst Administrator-Berechtigung um diesen Befehl zu verwenden.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;

      if (subcommand === "channel") {
        await setTrackingChannel(interaction, guildId);
      } else if (subcommand === "live-channel") {
        await setLiveChannel(interaction, guildId);
      } else {
        await interaction.reply({
          content: "❌ Unbekannter Unterbefehl.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("Error in settings command:", error);
      await interaction.reply({
        content:
          "❌ Einstellungen konnten nicht verarbeitet werden. Bitte versuche es erneut.",
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
      content: `✅ **Zeiterfassungs-Kanal festgelegt!**\n\nZeiterfassungs-Befehle funktionieren jetzt nur noch in ${channel}.\n\n⚠️ **Wichtig:** Benutzer können nur in diesem Kanal die Zeiterfassung starten/stoppen.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: `✅ **Kanal-Beschränkung entfernt!**\n\nZeiterfassungs-Befehle können jetzt in jedem Kanal verwendet werden.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function setLiveChannel(
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

  // If disabling live channel, remove existing live message first
  if (!channel && settings.liveChannelId) {
    const liveTrackingManager = new LiveTrackingManager(interaction.client);
    await liveTrackingManager.removeLiveMessage(guildId);
  }

  const updatedSettings: Omit<GuildSettings, "createdAt" | "updatedAt"> = {
    ...settings,
    liveChannelId: channel?.id || null,
    liveMessageId: null, // Reset message ID when channel changes
  };

  database.createOrUpdateGuildSettings(updatedSettings);

  if (channel) {
    await interaction.reply({
      content: `✅ **Live-Tracking Kanal festgelegt!**\n\nEine Live-Nachricht wird in ${channel} gepostet, die alle Benutzer anzeigt, die gerade Zeit erfassen.\n\n⚠️ **Wichtig:** Der Kanal sollte für Benutzer nur lesbar sein, um Störungen der Live-Nachricht zu vermeiden.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: `✅ **Live-Tracking deaktiviert!**\n\nDie Live-Tracking Anzeige wurde ausgeschaltet.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export default command;
