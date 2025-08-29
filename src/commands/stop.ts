import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { TimeTrackingManager } from "../utils/trackingManager";
import { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stoppe die On-Off"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const trackingManager = new TimeTrackingManager(interaction.client);
    await trackingManager.stopTracking(
      interaction.user.id,
      interaction.guildId!,
      interaction
    );
  },
};

export default command;
