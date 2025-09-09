import "dotenv/config";
import { DiscordRequest } from "./utils/discordApi.js";

// Define all bot commands
const commands = [
  {
    name: "play",
    description: "Starte die On-Off Zeiterfassung",
    type: 1, // CHAT_INPUT
    integration_types: [0], // GUILD_INSTALL
    contexts: [0], // GUILD
  },
  {
    name: "stop",
    description: "Stoppe die On-Off Zeiterfassung",
    type: 1,
    integration_types: [0],
    contexts: [0],
  },
  {
    name: "status",
    description: "Zeige aktuell aktive On-Off Sessions",
    type: 1,
    integration_types: [0],
    contexts: [0],
  },
  {
    name: "stats",
    description: "Zeige On-Off Statistiken für einen Benutzer",
    type: 1,
    integration_types: [0],
    contexts: [0],
    options: [
      {
        type: 6, // USER
        name: "user",
        description: "Benutzer für den die Statistiken angezeigt werden sollen",
        required: false,
      },
    ],
  },
  {
    name: "leaderboard",
    description: "Zeige das On-Off Leaderboard",
    type: 1,
    integration_types: [0],
    contexts: [0],
  },
  {
    name: "settings",
    description: "Zeiterfassung Bot Einstellungen konfigurieren",
    type: 1,
    integration_types: [0],
    contexts: [0],
    default_member_permissions: "8", // ADMINISTRATOR
    options: [
      {
        type: 1, // SUB_COMMAND
        name: "channel",
        description: "Speziellen Zeiterfassungs-Kanal festlegen",
        options: [
          {
            type: 7, // CHANNEL
            name: "channel",
            description:
              "Kanal für Zeiterfassung (leer lassen um alle Kanäle zu erlauben)",
            required: false,
            channel_types: [0], // GUILD_TEXT
          },
        ],
      },
      {
        type: 1, // SUB_COMMAND
        name: "live-channel",
        description: "Live-Tracking Anzeige-Kanal festlegen",
        options: [
          {
            type: 7, // CHANNEL
            name: "channel",
            description:
              "Kanal für Live-Tracking Anzeige (leer lassen um Live-Tracking zu deaktivieren)",
            required: false,
            channel_types: [0], // GUILD_TEXT
          },
        ],
      },
    ],
  },
];

async function installGlobalCommands() {
  const endpoint = `applications/${process.env.APPLICATION_ID}/commands`;

  try {
    console.log("🚀 Registriere Discord Slash Commands...");
    await DiscordRequest(endpoint, { method: "PUT", body: commands });
    console.log(`✅ ${commands.length} Commands erfolgreich registriert!`);

    commands.forEach((cmd) =>
      console.log(`  - /${cmd.name}: ${cmd.description}`)
    );
  } catch (err) {
    console.error("❌ Fehler beim Registrieren der Commands:", err);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  installGlobalCommands();
}

export { installGlobalCommands, commands };
