import "dotenv/config";
import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";

const commands = [];

// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts"));

// Load all commands
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const command = require(filePath);
    const commandObj = "default" in command ? command.default : command;

    if (commandObj && "data" in commandObj && "execute" in commandObj) {
      commands.push(commandObj.data.toJSON());
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
  process.exit(1);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env["TOKEN"]!);

// Deploy commands
(async (): Promise<void> => {
  try {
    console.log(
      `🚀 Started refreshing ${commands.length} application (/) commands.`
    );

    let data: any;

    // Deploy globally or to a specific guild
    if (process.env["GUILD_ID"]) {
      // Deploy to specific guild (faster for development)
      data = await rest.put(
        Routes.applicationGuildCommands(
          process.env["APPLICATION_ID"]!,
          process.env["GUILD_ID"]
        ),
        { body: commands }
      );
      console.log(
        `✅ Successfully reloaded ${data.length} guild application (/) commands.`
      );
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      data = await rest.put(
        Routes.applicationCommands(process.env["APPLICATION_ID"]!),
        { body: commands }
      );
      console.log(
        `✅ Successfully reloaded ${data.length} global application (/) commands.`
      );
      console.log(
        "ℹ️  Global commands may take up to 1 hour to appear in all servers."
      );
    }
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
    process.exit(1);
  }
})();
