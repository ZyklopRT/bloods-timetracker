import "dotenv/config";
import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import fs from "fs";
import path from "path";
import { ExtendedClient, Command } from "./types";
import { database } from "./database/database";
import { LiveTrackingManager } from "./utils/liveTrackingManager";

// Create Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
}) as ExtendedClient;

// Initialize commands collection
client.commands = new Collection();

// Load commands dynamically
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath) as { default?: Command } | Command;
      const commandObj = "default" in command ? command.default : command;

      if (commandObj && "data" in commandObj && "execute" in commandObj) {
        client.commands.set(commandObj.data.name, commandObj);
        console.log(`✅ Loaded command: ${commandObj.data.name}`);
      } else {
        console.log(
          `⚠️  [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    } catch (error) {
      console.error(`❌ Error loading command ${file}:`, error);
    }
  }
}

// Load events dynamically
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      const eventObj = "default" in event ? event.default : event;

      if (eventObj && "name" in eventObj && "execute" in eventObj) {
        if (eventObj.once) {
          client.once(eventObj.name, (...args) => eventObj.execute(...args));
        } else {
          client.on(eventObj.name, (...args) => eventObj.execute(...args));
        }
        console.log(`✅ Loaded event: ${eventObj.name}`);
      } else {
        console.log(
          `⚠️  [WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`
        );
      }
    } catch (error) {
      console.error(`❌ Error loading event ${file}:`, error);
    }
  }
}

// Ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🚀 Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Connected to ${readyClient.guilds.cache.size} server(s)`);

  // Set bot status
  readyClient.user.setActivity("GTA Roleplay Time Tracking", { type: 3 }); // Type 3 = Watching

  // Initialize live tracking manager and set up periodic updates
  const liveTrackingManager = new LiveTrackingManager(readyClient);

  // Update live messages every 30 seconds
  setInterval(async () => {
    try {
      await liveTrackingManager.updateAllLiveMessages();
    } catch (error) {
      console.error("Error during periodic live message update:", error);
    }
  }, 30000); // 30 seconds

  console.log("✅ Live tracking periodic updates started (every 30 seconds)");
});

// Error handling
client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("SIGINT", () => {
  console.log("🛑 Shutting down gracefully...");
  database.close();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  database.close();
  client.destroy();
  process.exit(0);
});

// Validate required environment variables (updated to match Discord developer docs)
const requiredEnvVars = ["TOKEN", "APPLICATION_ID"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingVars.join(", ")
  );
  console.error(
    "Please check your .env file and ensure all required variables are set."
  );
  console.error("Required: TOKEN (bot token), APPLICATION_ID (application ID)");
  console.error("Optional: PUBLIC_KEY (for interaction verification)");
  process.exit(1);
}

// Login to Discord
client.login(process.env["TOKEN"]).catch((error) => {
  console.error("❌ Failed to login to Discord:", error);
  process.exit(1);
});
