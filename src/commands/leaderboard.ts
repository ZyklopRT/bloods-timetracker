import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { database } from "../database/database";
import { formatDetailedTime } from "../utils/helpers";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Zeige die Zeiterfassung-Bestenliste")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Anzahl der Benutzer (1-20)")
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const limit = interaction.options.getInteger("limit") || 10;

      // Get all user stats for this guild, ordered by total time
      const query = `
        SELECT userId, totalTimeMs, sessionsCount, lastSeen 
        FROM user_stats 
        WHERE guildId = ? AND totalTimeMs > 0 
        ORDER BY totalTimeMs DESC 
        LIMIT ?
      `;

      // We need to access the database directly for custom queries
      const results = (database as any).db.prepare(query).all(guildId, limit);

      if (results.length === 0) {
        await interaction.editReply({
          content:
            "📊 Noch keine Zeiterfassungsdaten für diesen Server gefunden!",
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 Zeiterfassung Bestenliste")
        .setColor(0xffd700)
        .setTimestamp()
        .setFooter({
          text: `Top ${results.length} Benutzer • Gesamte Sessions`,
        });

      // Fetch user details and build leaderboard
      const leaderboardEntries = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        let username = "Unknown User";

        try {
          const guild = interaction.guild!;
          const member = await guild.members.fetch(result.userId);
          username = member.displayName;
        } catch (error) {
          // User might have left the server
          username = `Benutzer ${result.userId.slice(0, 8)}...`;
        }

        const position = i + 1;
        const medal =
          position === 1
            ? "🥇"
            : position === 2
            ? "🥈"
            : position === 3
            ? "🥉"
            : `**${position}.**`;
        const timeFormatted = formatDetailedTime(result.totalTimeMs);
        const sessionsText =
          result.sessionsCount === 1 ? "Session" : "Sessions";

        leaderboardEntries.push(
          `${medal} **${username}**\n` +
            `⏱️ ${timeFormatted}\n` +
            `📈 ${result.sessionsCount} ${sessionsText}\n`
        );
      }

      embed.setDescription(leaderboardEntries.join("\n"));

      // Add summary field
      const totalTimeSum = results.reduce(
        (sum: number, result: any) => sum + result.totalTimeMs,
        0
      );
      const totalSessions = results.reduce(
        (sum: number, result: any) => sum + result.sessionsCount,
        0
      );



      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in leaderboard command:", error);
      await interaction.editReply({
        content:
          "❌ Bestenliste konnte nicht abgerufen werden. Bitte versuche es erneut.",
      });
    }
  },
};

export default command;
