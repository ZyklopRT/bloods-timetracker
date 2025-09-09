import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseManager {
  constructor() {
    // Use environment variable for database path, fallback to relative path
    const dbPath =
      process.env.DATABASE_PATH ||
      path.join(__dirname, "../../data/timetracker.db");

    // Ensure directory exists synchronously
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeTables();

    console.log(`✅ Database connected: ${dbPath}`);
  }

  initializeTables() {
    // Check if we need to migrate from old schema
    const needsMigration = this.checkIfMigrationNeeded();

    if (needsMigration) {
      this.performMigration();
    } else {
      // Create new tables (fresh installation)
      this.createNewTables();
    }

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

    this.createIndexes();
  }

  /**
   * Create database indexes for better performance
   */
  createIndexes() {
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_guild ON sessions(userId, guildId)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_sessions_guild_status ON sessions(guildId, status)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(sessionId)"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_session_events_type_time ON session_events(eventType, timestamp)"
    );
  }

  /**
   * Check if database needs migration from old schema
   */
  checkIfMigrationNeeded() {
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(sessions)").all();
      return tableInfo.some((col) => col.name === "startTime");
    } catch (error) {
      return false;
    }
  }

  /**
   * Create new table structure for fresh installations
   */
  createNewTables() {
    // Create sessions table (simplified for event-based tracking)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create session events table for timestamp tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_events (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        sessionId TEXT NOT NULL,
        eventType TEXT NOT NULL, -- 'start', 'pause', 'resume', 'stop'
        timestamp TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions (id)
      )
    `);

    // Create indexes
    this.createIndexes();
  }

  /**
   * Perform migration from old schema to new event-based schema
   */
  performMigration() {
    console.log("📦 Migrating to event-based session tracking...");

    // Create new tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions_new (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_events (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        sessionId TEXT NOT NULL,
        eventType TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions_new (id)
      )
    `);

    // Migrate data from old sessions table
    const oldSessions = this.db.prepare(`SELECT * FROM sessions`).all();

    for (const session of oldSessions) {
      // Insert into new sessions table
      const newSessionStmt = this.db.prepare(`
        INSERT INTO sessions_new (id, userId, guildId, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      newSessionStmt.run(
        session.id,
        session.userId,
        session.guildId,
        session.status,
        session.createdAt,
        session.updatedAt
      );

      // Create events for this session
      if (session.startTime) {
        this.addSessionEventDirect(
          session.id,
          "start",
          new Date(session.startTime)
        );
      }

      if (
        session.pausedTime &&
        session.pausedTime > 0 &&
        session.status === "paused"
      ) {
        const pauseTime = new Date(
          new Date(session.startTime).getTime() + (session.pausedTime || 0)
        );
        this.addSessionEventDirect(session.id, "pause", pauseTime);
      }

      if (session.endTime) {
        this.addSessionEventDirect(
          session.id,
          "stop",
          new Date(session.endTime)
        );
      }
    }

    // Replace old table with new one
    this.db.exec(`DROP TABLE sessions`);
    this.db.exec(`ALTER TABLE sessions_new RENAME TO sessions`);

    // Create indexes after migration
    this.createIndexes();

    console.log("✅ Migration to event-based tracking completed");
  }

  /**
   * Add session event directly (used during migration)
   */
  addSessionEventDirect(sessionId, eventType, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO session_events (sessionId, eventType, timestamp)
      VALUES (?, ?, ?)
    `);

    stmt.run(sessionId, eventType, timestamp.toISOString());
  }

  /**
   * Start a new tracking session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} startTime - Session start time
   * @returns {string} Session ID
   */
  startSession(userId, guildId, startTime) {
    const sessionStmt = this.db.prepare(`
      INSERT INTO sessions (userId, guildId, status)
      VALUES (?, ?, 'active')
    `);

    const result = sessionStmt.run(userId, guildId);
    const sessionId = this.db
      .prepare("SELECT last_insert_rowid() as id")
      .get().id;

    // Get the actual session ID (hex format)
    const session = this.db
      .prepare("SELECT id FROM sessions WHERE rowid = ?")
      .get(sessionId);
    const actualSessionId = session.id;

    // Add start event
    this.addSessionEvent(actualSessionId, "start", startTime);

    return actualSessionId;
  }

  /**
   * Add a session event
   * @param {string} sessionId - Session ID
   * @param {string} eventType - Event type ('start', 'pause', 'resume', 'stop')
   * @param {Date} timestamp - Event timestamp
   */
  addSessionEvent(sessionId, eventType, timestamp) {
    const stmt = this.db.prepare(`
      INSERT INTO session_events (sessionId, eventType, timestamp)
      VALUES (?, ?, ?)
    `);

    stmt.run(sessionId, eventType, timestamp.toISOString());
  }

  /**
   * Stop an active session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} endTime - Session end time
   */
  stopSession(userId, guildId, endTime) {
    const activeSession = this.getActiveSession(userId, guildId);
    if (!activeSession) {
      throw new Error("No active session found");
    }

    // Add stop event
    this.addSessionEvent(activeSession.id, "stop", endTime);

    // Update session status
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'completed', updatedAt = datetime('now')
      WHERE id = ?
    `);

    stmt.run(activeSession.id);
  }

  /**
   * Pause an active session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} pauseTime - Pause timestamp
   */
  pauseSession(userId, guildId, pauseTime) {
    const activeSession = this.getActiveSession(userId, guildId);
    if (!activeSession) {
      throw new Error("No active session found");
    }

    // Add pause event
    this.addSessionEvent(activeSession.id, "pause", pauseTime);

    // Update session status
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'paused', updatedAt = datetime('now')
      WHERE id = ?
    `);

    stmt.run(activeSession.id);
  }

  /**
   * Resume a paused session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} resumeTime - Resume time
   */
  resumeSession(userId, guildId, resumeTime) {
    const activeSession = this.getActiveSession(userId, guildId);
    if (!activeSession) {
      throw new Error("No active session found");
    }

    // Add resume event
    this.addSessionEvent(activeSession.id, "resume", resumeTime);

    // Update session status
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = 'active', updatedAt = datetime('now')
      WHERE id = ?
    `);

    stmt.run(activeSession.id);
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
      // Get session events
      session.events = this.getSessionEvents(session.id);

      // Add calculated fields for compatibility
      if (session.events.length > 0) {
        const startEvent = session.events.find((e) => e.eventType === "start");
        if (startEvent) {
          session.startTime = new Date(startEvent.timestamp);
        }
      }
    }

    return session;
  }

  /**
   * Get all events for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Array of session events
   */
  getSessionEvents(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM session_events 
      WHERE sessionId = ? 
      ORDER BY timestamp ASC
    `);

    return stmt.all(sessionId).map((event) => ({
      ...event,
      timestamp: new Date(event.timestamp),
    }));
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
      ORDER BY createdAt ASC
    `);

    const sessions = stmt.all(guildId);
    return sessions.map((session) => {
      // Get session events
      session.events = this.getSessionEvents(session.id);

      // Add calculated fields for compatibility
      if (session.events.length > 0) {
        const startEvent = session.events.find((e) => e.eventType === "start");
        if (startEvent) {
          session.startTime = new Date(startEvent.timestamp);
        }
      }

      return session;
    });
  }

  /**
   * Calculate session duration from events
   * @param {Array} events - Array of session events
   * @param {Date} currentTime - Current time (for active sessions)
   * @returns {number} Duration in milliseconds
   */
  calculateSessionDuration(events, currentTime = new Date()) {
    if (!events || events.length === 0) return 0;

    let totalDuration = 0;
    let lastActiveStart = null;

    for (const event of events) {
      const timestamp = new Date(event.timestamp);

      switch (event.eventType) {
        case "start":
        case "resume":
          lastActiveStart = timestamp;
          break;

        case "pause":
          if (lastActiveStart) {
            totalDuration += timestamp.getTime() - lastActiveStart.getTime();
            lastActiveStart = null;
          }
          break;

        case "stop":
          if (lastActiveStart) {
            totalDuration += timestamp.getTime() - lastActiveStart.getTime();
            lastActiveStart = null;
          }
          break;
      }
    }

    // If session is still active (no stop event and has active start)
    if (lastActiveStart) {
      totalDuration += currentTime.getTime() - lastActiveStart.getTime();
    }

    return totalDuration;
  }

  /**
   * Get user statistics
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Object} User stats
   */
  getUserStats(userId, guildId) {
    // Get all sessions for the user
    const sessionsStmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE userId = ? AND guildId = ?
    `);

    const sessions = sessionsStmt.all(userId, guildId);

    let totalTimeMs = 0;
    let lastSeen = null;

    // Calculate total time from all sessions using events
    for (const session of sessions) {
      const events = this.getSessionEvents(session.id);
      const sessionDuration = this.calculateSessionDuration(events);
      totalTimeMs += sessionDuration;

      // Find the latest event timestamp
      if (events.length > 0) {
        const latestEvent = events[events.length - 1];
        if (!lastSeen || latestEvent.timestamp > lastSeen) {
          lastSeen = latestEvent.timestamp;
        }
      }
    }

    return {
      sessionsCount: sessions.length,
      totalTimeMs: Math.round(totalTimeMs),
      lastSeen: lastSeen,
    };
  }

  /**
   * Get leaderboard for a guild
   * @param {string} guildId - Discord guild ID
   * @param {number} limit - Number of entries to return
   * @returns {Array} Leaderboard entries
   */
  getLeaderboard(guildId, limit = 10) {
    // Get all users who have sessions
    const usersStmt = this.db.prepare(`
      SELECT DISTINCT userId FROM sessions WHERE guildId = ?
    `);

    const users = usersStmt.all(guildId);
    const leaderboard = [];

    // Calculate total time for each user
    users.forEach(({ userId }) => {
      const userStats = this.getUserStats(userId, guildId);
      if (userStats.totalTimeMs > 0) {
        leaderboard.push({
          userId,
          sessionsCount: userStats.sessionsCount,
          totalTimeMs: userStats.totalTimeMs,
        });
      }
    });

    // Sort by total time descending and limit results
    return leaderboard
      .sort((a, b) => b.totalTimeMs - a.totalTimeMs)
      .slice(0, limit);
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
