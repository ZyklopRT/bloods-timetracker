import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from "discord-interactions";
import { DatabaseManager } from "./database/database.js";
import { TimeTrackingManager } from "./utils/trackingManager.js";
import {
  createUserStatsEmbed,
  formatTime,
  validateTrackingChannel,
} from "./utils/helpers.js";

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const database = new DatabaseManager();

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
        if (custom_id === "pause_tracking") {
          return await handlePauseCommand(res, userId, guildId);
        } else if (custom_id === "resume_tracking") {
          return await handleResumeCommand(res, userId, guildId);
        } else if (custom_id === "stop_tracking") {
          return await handleStopCommand(res, userId, guildId, channelId);
        }
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
  const trackingManager = new TimeTrackingManager();
  const result = await trackingManager.stopTracking(userId, guildId, channelId);

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: result,
  });
}

async function handlePauseCommand(res, userId, guildId) {
  const trackingManager = new TimeTrackingManager();
  const result = await trackingManager.pauseTracking(userId, guildId);

  return res.send({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: result,
  });
}

async function handleResumeCommand(res, userId, guildId) {
  const trackingManager = new TimeTrackingManager();
  const result = await trackingManager.resumeTracking(userId, guildId);

  return res.send({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: result,
  });
}

async function handleStatusCommand(res, guildId) {
  const activeSessions = database.getAllActiveSessions(guildId);

  if (activeSessions.length === 0) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          {
            title: "⏰ Aktueller On-Off Status",
            description: "🔕 Aktuell werden keine Benutzer erfasst.",
            color: 0x00ae86,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });
  }

  const statusEntries = activeSessions.map((session) => {
    const adjustedTime =
      session.status === "active"
        ? Date.now() - session.startTime.getTime() + (session.pausedTime || 0)
        : session.pausedTime || 0;

    const statusEmoji = session.status === "active" ? "🟢" : "⏸️";
    const statusText = session.status === "active" ? "Aktiv" : "Pausiert";

    return (
      `${statusEmoji} **User ${session.userId.slice(
        0,
        8
      )}...** - ${statusText}\n` +
      `⏱️ Aktuelle Session: ${formatTime(adjustedTime)}\n` +
      `🕐 Gestartet: <t:${Math.floor(session.startTime.getTime() / 1000)}:R>\n`
    );
  });

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "⏰ Aktueller On-Off Status",
          description: statusEntries.join("\n"),
          color: 0x00ae86,
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
}

async function handleStatsCommand(res, targetUserId, guildId) {
  const userStats = database.getUserStats(targetUserId, guildId);

  if (!userStats || userStats.sessionsCount === 0) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `📊 User hat noch keine On-Off-Sessions abgeschlossen.`,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: `📊 Statistiken für User ${targetUserId.slice(0, 8)}...`,
          fields: [
            {
              name: "⏱️ Gesamtzeit",
              value: formatTime(userStats.totalTimeMs),
              inline: true,
            },
            {
              name: "📈 Sessions",
              value: userStats.sessionsCount.toString(),
              inline: true,
            },
            {
              name: "📅 Durchschnitt/Session",
              value: formatTime(
                Math.round(userStats.totalTimeMs / userStats.sessionsCount)
              ),
              inline: true,
            },
          ],
          color: 0x00ae86,
          timestamp: new Date().toISOString(),
        },
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}

async function handleLeaderboardCommand(res, guildId) {
  const leaderboard = database.getLeaderboard(guildId, 10);

  if (leaderboard.length === 0) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "📊 Noch keine On-Off-Daten verfügbar.",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  const leaderboardText = leaderboard
    .map((entry, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `${index + 1}.`;
      return `${medal} User ${entry.userId.slice(0, 8)}... - ${formatTime(
        entry.totalTimeMs
      )} (${entry.sessionsCount} Sessions)`;
    })
    .join("\n");

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [
        {
          title: "🏆 On-Off Leaderboard",
          description: leaderboardText,
          color: 0xffd700,
          timestamp: new Date().toISOString(),
        },
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
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

    database.updateGuildSettings(guildId, { trackingChannelId: channelId });

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

    database.updateGuildSettings(guildId, { liveChannelId: channelId });

    const message = channelId
      ? `✅ Live-Tracking in <#${channelId}> aktiviert.`
      : `✅ Live-Tracking deaktiviert.`;

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
process.on("SIGINT", () => {
  console.log("🛑 Shutting down gracefully...");
  database.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  database.close();
  process.exit(0);
});

