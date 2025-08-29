import { Events, Interaction } from "discord.js";
import { ExtendedClient } from "../types";
import { validateTrackingChannel } from "../utils/helpers";

// List of commands that require tracking channel validation
const TRACKING_COMMANDS = ["play", "stop", "stats", "status", "leaderboard"];

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

      // Global channel validation for tracking commands
      if (TRACKING_COMMANDS.includes(interaction.commandName)) {
        if (!(await validateTrackingChannel(interaction))) {
          return;
        }
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
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      try {
        await handleModalSubmitInteraction(interaction);
      } catch (error) {
        console.error("❌ Error handling modal submission:", error);

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
    // Handle string select menu interactions
    else if (interaction.isStringSelectMenu()) {
      try {
        await handleStringSelectMenuInteraction(interaction);
      } catch (error) {
        console.error("❌ Error handling string select menu:", error);

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
    // Handle channel select menu interactions
    else if (interaction.isChannelSelectMenu()) {
      try {
        await handleChannelSelectMenuInteraction(interaction);
      } catch (error) {
        console.error("❌ Error handling channel select menu:", error);

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

  // Handle tracking-related buttons
  if (
    customId === "pause_tracking" ||
    customId === "resume_tracking" ||
    customId === "stop_tracking"
  ) {
    // Import the tracking manager here to avoid circular dependency
    const { TimeTrackingManager } = await import("../utils/trackingManager");
    const trackingManager = new TimeTrackingManager(interaction.client);

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
    }
  }

  // Unknown button
  else {
    await interaction.reply({
      content: "Unbekannte Button-Interaktion!",
      ephemeral: true,
    });
  }
}

async function handleModalSubmitInteraction(interaction: any): Promise<void> {
  await interaction.reply({
    content: "Unbekannte Modal-Interaktion!",
    ephemeral: true,
  });
}

async function handleStringSelectMenuInteraction(
  interaction: any
): Promise<void> {
  await interaction.reply({
    content: "Unbekannte Select-Menu-Interaktion!",
    ephemeral: true,
  });
}

async function handleChannelSelectMenuInteraction(
  interaction: any
): Promise<void> {
  await interaction.reply({
    content: "Unbekannte Channel-Select-Interaktion!",
    ephemeral: true,
  });
}
