import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  User,
} from "discord.js";
import { database } from "../index";
import { createUserStatsEmbed } from "../utils/helpers";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View time tracking statistics")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to view stats for (defaults to yourself)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const targetUser: User =
        interaction.options.getUser("user") || interaction.user;
      const guildId = interaction.guildId!;

      // Get user stats from database
      const userStats = database.getUserStats(targetUser.id, guildId);

      if (!userStats || userStats.sessionsCount === 0) {
        await interaction.reply({
          content: `📊 ${targetUser.displayName} hasn't completed any time tracking sessions yet.`,
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
        content: "❌ Failed to retrieve statistics. Please try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
