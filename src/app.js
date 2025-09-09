import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from "discord-interactions";
import PrismaService from "./database/prisma.js";
import { SessionManager } from "./utils/sessionManager.js";

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const database = new PrismaService();
const sessionManager = new SessionManager();

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verify incoming requests using discord-interactions package
 */
app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async function (req, res) {
    const {
      id,
      type,
      data,
      member,
      user,
      guild_id: guildId,
      channel_id: channelId,
    } = req.body;

    console.log("Received interaction:", { type, data: data?.name });

    /**
     * Handle verification requests
     */
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    /**
     * Handle slash command requests
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
      const { name, options } = data;
      const userId = user?.id || member?.user?.id;

      try {
        switch (name) {
          case "play":
            return await handleStartCommand(res, userId, guildId, channelId);

          case "stop":
            return await handleStopCommand(res, userId, guildId, channelId);

          case "status":
            return await handleStatusCommand(res, guildId);

          case "stats":
            const targetUserId =
              options?.find((opt) => opt.name === "user")?.value || userId;
            return await handleStatsCommand(res, targetUserId, guildId);

          case "leaderboard":
            return await handleLeaderboardCommand(res, guildId);

          case "settings":
            if (!member?.permissions || !(parseInt(member.permissions) & 0x8)) {
              // Administrator permission
              return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content:
                    "❌ Du benötigst Administrator-Berechtigung um diesen Befehl zu verwenden.",
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              });
            }
            return await handleSettingsCommand(res, data.options, guildId);

          default:
            console.error(`Unknown command: ${name}`);
            return res.status(400).json({ error: "unknown command" });
        }
      } catch (error) {
        console.error("Error handling command:", error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }

    /**
     * Handle button interactions
     */
    if (type === InteractionType.MESSAGE_COMPONENT) {
      const { custom_id } = data;
      const userId = user?.id || member?.user?.id;

      try {
        let result;
        switch (custom_id) {
          case "pause_session":
            result = await sessionManager.pauseSession(userId, guildId);
            break;
          case "resume_session":
            result = await sessionManager.resumeSession(userId, guildId);
            break;
          case "stop_session":
            result = await sessionManager.stopSession(userId, guildId);
            break;
          default:
            console.error(`Unknown component interaction: ${custom_id}`);
            return res.status(400).json({ error: "Unknown interaction" });
        }

        return res.send({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: result,
        });
      } catch (error) {
        console.error("Error handling button interaction:", error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Ein Fehler ist aufgetreten.",
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }

    console.error("Unknown interaction type", type);
    return res.status(400).json({ error: "unknown interaction type" });
  }
);

// Command handlers
async function handleStartCommand(res, userId, guildId, channelId) {
  const trackingManager = new TimeTrackingManager();
  const result = await trackingManager.startTracking(
    userId,
    guildId,
    channelId
  );

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: result,
  });
}

async function handleStopCommand(res, userId, guildId, channelId) {
  const result = await sessionManager.stopSession(userId, guildId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: result,
  });
}

// Button interactions are now handled directly in the MESSAGE_COMPONENT section

async function handleStatusCommand(res, guildId) {
  const activeSessions = await database.getAllActiveSessions(guildId);
  const content = sessionManager.createOnlineListContent(activeSessions);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

async function handleStatsCommand(res, targetUserId, guildId) {
  const content = await sessionManager.getUserStats(targetUserId, guildId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

async function handleLeaderboardCommand(res, guildId) {
  const content = await sessionManager.getLeaderboard(guildId, 10);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
    },
  });
}

async function handleSettingsCommand(res, options, guildId) {
  const subcommand = options?.[0];

  if (!subcommand) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Subcommand fehlt.",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  if (subcommand.name === "channel") {
    const channelOption = subcommand.options?.find(
      (opt) => opt.name === "channel"
    );
    const channelId = channelOption?.value || null;

    await database.setGuildSettings(guildId, { trackingChannelId: channelId });

    const message = channelId
      ? `✅ Zeiterfassung auf <#${channelId}> beschränkt.`
      : `✅ Zeiterfassung in allen Kanälen erlaubt.`;

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  if (subcommand.name === "live-channel") {
    const channelOption = subcommand.options?.find(
      (opt) => opt.name === "channel"
    );
    const channelId = channelOption?.value || null;

    await database.setGuildSettings(guildId, {
      liveChannelId: channelId,
      liveMessageId: null, // Reset message ID when changing channel
    });

    if (channelId) {
      // Update the online list for the new channel
      await sessionManager.updateOnlineList(guildId);
    }

    const message = channelId
      ? `✅ Online-Liste in <#${channelId}> aktiviert.`
      : `✅ Online-Liste deaktiviert.`;

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "❌ Unbekannter Subcommand.",
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Discord Interactions Server listening on port ${PORT}`);
  console.log(`📊 Database initialized`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down gracefully...");
  await database.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Shutting down gracefully...");
  await database.close();
  process.exit(0);
});
