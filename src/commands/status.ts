import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { database } from "../database/database";
import { formatTime, calculateAdjustedTime } from "../utils/helpers";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Zeige aktuell aktive On-Off-Sessions"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const activeSessions = database.getAllActiveSessions(guildId);

      const embed = new EmbedBuilder()
        .setTitle("⏰ Aktueller On-Off Status")
        .setColor(0x00ae86)
        .setTimestamp();

      if (activeSessions.length === 0) {
        embed.setDescription("🔕 Aktuell werden keine Benutzer erfasst.");
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Fetch user details and build status list
      const statusEntries = [];

      for (const session of activeSessions) {
        let username = "Unknown User";

        try {
          const guild = interaction.guild!;
          const member = await guild.members.fetch(session.userId);
          username = member.displayName;
        } catch (error) {
          // User might have left the server
          username = `Benutzer ${session.userId.slice(0, 8)}...`;
        }

        const adjustedTime = calculateAdjustedTime(session);
        const statusEmoji = session.status === "active" ? "🟢" : "⏸️";
        const statusText = session.status === "active" ? "Aktiv" : "Pausiert";

        statusEntries.push(
          `${statusEmoji} **${username}** - ${statusText}\n` +
            `⏱️ Aktuelle Session: ${formatTime(adjustedTime)}\n` +
            `🕐 Gestartet: <t:${Math.floor(
              session.startTime.getTime() / 1000
            )}:R>\n`
        );
      }

      embed.setDescription(statusEntries.join("\n"));
      embed.setFooter({
        text: `${activeSessions.length} Benutzer aktuell erfasst`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in status command:", error);
      await interaction.editReply({
        content:
          "❌ Status konnte nicht abgerufen werden. Bitte versuche es erneut.",
      });
    }
  },
};

export default command;
