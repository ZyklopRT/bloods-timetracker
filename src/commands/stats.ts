import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  User,
} from "discord.js";
import { database } from "../database/database";
import { createUserStatsEmbed } from "../utils/helpers";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Zeige Zeiterfassung-Statistiken")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(
          "Benutzer für den die Statistiken angezeigt werden sollen"
        )
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const targetUser: User =
        interaction.options.getUser("user") || interaction.user;
      const guildId = interaction.guildId!;

      // Get user stats from database
      const userStats = database.getUserStats(targetUser.id, guildId);

      if (!userStats || userStats.sessionsCount === 0) {
        await interaction.reply({
          content: `📊 ${targetUser.displayName} hat noch keine Zeiterfassung-Sessions abgeschlossen.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = createUserStatsEmbed(
        targetUser,
        userStats.totalTimeMs,
        userStats.sessionsCount,
        userStats.lastSeen
      );

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error in stats command:", error);
      await interaction.reply({
        content:
          "❌ Statistiken konnten nicht abgerufen werden. Bitte versuche es erneut.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
