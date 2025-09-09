import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseManager {
  constructor() {
    // Use environment variable for database path, fallback to relative path
    const dbPath =
      process.env.DATABASE_PATH ||
      path.join(__dirname, "../../data/timetracker.db");

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    import("fs").then((fs) => {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeTables();

    console.log(`✅ Database connected: ${dbPath}`);
  }

  initializeTables() {
    // Create sessions table (compatible with existing structure)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        pausedTime INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create guild settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        tracking_channel_id TEXT,
        live_channel_id TEXT,
        live_message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_guild ON sessions(userId, guildId)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_sessions_guild_status ON sessions(guildId, status)"
    );
  }

  /**
   * Start a new tracking session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} startTime - Session start time
   */
  startSession(userId, guildId, startTime) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (userId, guildId, startTime, status)
      VALUES (?, ?, ?, 'active')
    `);

    stmt.run(userId, guildId, startTime.toISOString());
  }

  /**
   * Stop an active session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} endTime - Session end time
   */
  stopSession(userId, guildId, endTime) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET endTime = ?, status = 'completed', updatedAt = datetime('now')
      WHERE userId = ? AND guildId = ? AND status IN ('active', 'paused')
    `);

    stmt.run(endTime.toISOString(), userId, guildId);
  }

  /**
   * Pause an active session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {number} pausedTime - Accumulated time in milliseconds
   */
  pauseSession(userId, guildId, pausedTime) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'paused', pausedTime = ?, updatedAt = datetime('now')
      WHERE userId = ? AND guildId = ? AND status = 'active'
    `);

    stmt.run(pausedTime, userId, guildId);
  }

  /**
   * Resume a paused session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} resumeTime - Resume time
   */
  resumeSession(userId, guildId, resumeTime) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'active', startTime = ?, updatedAt = datetime('now')
      WHERE userId = ? AND guildId = ? AND status = 'paused'
    `);

    stmt.run(resumeTime.toISOString(), userId, guildId);
  }

  /**
   * Get active session for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Object|null} Active session or null
   */
  getActiveSession(userId, guildId) {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE userId = ? AND guildId = ? AND status IN ('active', 'paused')
    `);

    const session = stmt.get(userId, guildId);
    if (session) {
      session.startTime = new Date(session.startTime);
      if (session.endTime) {
        session.endTime = new Date(session.endTime);
      }
    }

    return session;
  }

  /**
   * Get all active sessions for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Array} Array of active sessions
   */
  getAllActiveSessions(guildId) {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE guildId = ? AND status IN ('active', 'paused')
      ORDER BY startTime ASC
    `);

    const sessions = stmt.all(guildId);
    return sessions.map((session) => {
      session.startTime = new Date(session.startTime);
      if (session.endTime) {
        session.endTime = new Date(session.endTime);
      }
      return session;
    });
  }

  /**
   * Get user statistics
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Object} User stats
   */
  getUserStats(userId, guildId) {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as sessionsCount,
        SUM(
          CASE 
            WHEN status = 'completed' THEN 
              (julianday(endTime) - julianday(startTime)) * 24 * 60 * 60 * 1000
            WHEN status IN ('active', 'paused') THEN pausedTime
            ELSE 0
          END
        ) as totalTimeMs,
        MAX(
          CASE 
            WHEN status = 'completed' THEN endTime
            ELSE startTime
          END
        ) as lastSeen
      FROM sessions 
      WHERE userId = ? AND guildId = ?
    `);

    const stats = stmt.get(userId, guildId);
    if (stats && stats.lastSeen) {
      stats.lastSeen = new Date(stats.lastSeen);
    }

    return {
      sessionsCount: stats.sessionsCount || 0,
      totalTimeMs: Math.round(stats.totalTimeMs || 0),
      lastSeen: stats.lastSeen,
    };
  }

  /**
   * Get leaderboard for a guild
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of entries to return
   * @returns {Array} Leaderboard entries
   */
  getLeaderboard(guildId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT 
        userId,
        COUNT(*) as sessionsCount,
        SUM(
          CASE 
            WHEN status = 'completed' THEN 
              (julianday(endTime) - julianday(startTime)) * 24 * 60 * 60 * 1000
            WHEN status IN ('active', 'paused') THEN pausedTime
            ELSE 0
          END
        ) as totalTimeMs
      FROM sessions 
      WHERE guildId = ?
      GROUP BY userId 
      HAVING totalTimeMs > 0
      ORDER BY totalTimeMs DESC
      LIMIT ?
    `);

    const leaderboard = stmt.all(guildId, limit);
    return leaderboard.map((entry) => ({
      ...entry,
      totalTimeMs: Math.round(entry.totalTimeMs || 0),
    }));
  }

  /**
   * Get guild settings
   * @param {string} guildId - Discord guild ID
   * @returns {Object|null} Guild settings or null
   */
  getGuildSettings(guildId) {
    const stmt = this.db.prepare(`
      SELECT * FROM guild_settings WHERE guild_id = ?
    `);

    return stmt.get(guildId);
  }

  /**
   * Update guild settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} settings - Settings to update
   */
  updateGuildSettings(guildId, settings) {
    const existingSettings = this.getGuildSettings(guildId);

    if (existingSettings) {
      // Update existing settings
      const fields = [];
      const values = [];

      if (settings.trackingChannelId !== undefined) {
        fields.push("tracking_channel_id = ?");
        values.push(settings.trackingChannelId);
      }

      if (settings.liveChannelId !== undefined) {
        fields.push("live_channel_id = ?");
        values.push(settings.liveChannelId);
      }

      if (settings.liveMessageId !== undefined) {
        fields.push("live_message_id = ?");
        values.push(settings.liveMessageId);
      }

      if (fields.length > 0) {
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(guildId);

        const stmt = this.db.prepare(`
          UPDATE guild_settings 
          SET ${fields.join(", ")} 
          WHERE guild_id = ?
        `);

        stmt.run(...values);
      }
    } else {
      // Create new settings
      const stmt = this.db.prepare(`
        INSERT INTO guild_settings (guild_id, tracking_channel_id, live_channel_id, live_message_id)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        guildId,
        settings.trackingChannelId || null,
        settings.liveChannelId || null,
        settings.liveMessageId || null
      );
    }
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
    console.log("🔌 Database connection closed");
  }
}
