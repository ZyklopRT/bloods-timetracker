const Database = require("better-sqlite3");
const path = require("path");

// Connect to the database
const db = new Database(path.join(__dirname, "data/timetracker.db"));

try {
  // Show current active sessions
  console.log("Current active sessions:");
  const activeSessions = db
    .prepare(
      `
        SELECT id, userId, guildId, startTime, status 
        FROM sessions 
        WHERE status IN ('active', 'paused')
    `
    )
    .all();

  console.log(activeSessions);

  if (activeSessions.length > 0) {
    console.log("\nClearing all active sessions...");

    // Update all active/paused sessions to stopped
    const result = db
      .prepare(
        `
            UPDATE sessions 
            SET status = 'stopped', endTime = datetime('now') 
            WHERE status IN ('active', 'paused')
        `
      )
      .run();

    console.log(`Cleared ${result.changes} sessions.`);
  } else {
    console.log("No active sessions found.");
  }
} catch (error) {
  console.error("Error:", error);
} finally {
  db.close();
}
