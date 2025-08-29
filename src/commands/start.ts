import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { TimeTrackingManager } from "../utils/trackingManager";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Starte die Zeiterfassung"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const trackingManager = new TimeTrackingManager();
    await trackingManager.startTracking(
      interaction.user.id,
      interaction.guildId!,
      interaction
    );
  },
};

export default command;
