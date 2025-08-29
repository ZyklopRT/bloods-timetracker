import { Events, Interaction } from "discord.js";
import { ExtendedClient } from "../types";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    const client = interaction.client as ExtendedClient;

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `❌ No command matching ${interaction.commandName} was found.`
        );
        return;
      }

      try {
        await command.execute(interaction);
        console.log(
          `✅ Executed command: ${interaction.commandName} by ${interaction.user.tag}`
        );
      } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);

        const errorMessage = {
          content: "Es gab einen Fehler beim Ausführen dieses Befehls!",
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
    // Handle button interactions
    else if (interaction.isButton()) {
      try {
        await handleButtonInteraction(interaction);
      } catch (error) {
        console.error("❌ Error handling button interaction:", error);

        const errorMessage = {
          content: "Es gab einen Fehler beim Verarbeiten deiner Anfrage!",
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
  },
};

async function handleButtonInteraction(interaction: any): Promise<void> {
  const { customId, user } = interaction;

  // Import the tracking manager here to avoid circular dependency
  const { TimeTrackingManager } = await import("../utils/trackingManager");
  const trackingManager = new TimeTrackingManager();

  if (customId === "pause_tracking") {
    await trackingManager.pauseTracking(
      user.id,
      interaction.guildId,
      interaction
    );
  } else if (customId === "resume_tracking") {
    await trackingManager.resumeTracking(
      user.id,
      interaction.guildId,
      interaction
    );
  } else if (customId === "stop_tracking") {
    await trackingManager.stopTracking(
      user.id,
      interaction.guildId,
      interaction
    );
  } else {
    await interaction.reply({
      content: "Unbekannte Button-Interaktion!",
      ephemeral: true,
    });
  }
}
