import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { database } from "../index";
import { formatTime } from "../utils/helpers";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show currently active time tracking sessions"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const activeSessions = database.getAllActiveSessions(guildId);

      const embed = new EmbedBuilder()
        .setTitle("⏰ Current Time Tracking Status")
        .setColor(0x00ae86)
        .setTimestamp();

      if (activeSessions.length === 0) {
        embed.setDescription("🔕 No users are currently being tracked.");
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
          username = `User ${session.userId.slice(0, 8)}...`;
        }

        const currentTime = Date.now() - session.startTime.getTime();
        const adjustedTime = Math.max(
          0,
          currentTime - (session.pausedTime || 0)
        );
        const statusEmoji = session.status === "active" ? "🟢" : "⏸️";
        const statusText = session.status === "active" ? "Active" : "Paused";

        statusEntries.push(
          `${statusEmoji} **${username}** - ${statusText}\n` +
            `⏱️ Current session: ${formatTime(adjustedTime)}\n` +
            `🕐 Started: <t:${Math.floor(
              session.startTime.getTime() / 1000
            )}:R>\n`
        );
      }

      embed.setDescription(statusEntries.join("\n"));
      embed.setFooter({
        text: `${activeSessions.length} user${
          activeSessions.length > 1 ? "s" : ""
        } currently tracked`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in status command:", error);
      await interaction.editReply({
        content: "❌ Failed to retrieve tracking status. Please try again.",
      });
    }
  },
};

export default command;
