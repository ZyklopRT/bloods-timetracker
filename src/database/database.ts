import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { TimeTrackingSession, GuildSettings, UserStats } from "../types";

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Time tracking sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        pausedTime INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Guild settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guildId TEXT PRIMARY KEY,
        trackingChannelId TEXT,
        showOnlineMessages INTEGER DEFAULT 1,
        showOfflineMessages INTEGER DEFAULT 1,
        showTrackingList INTEGER DEFAULT 1,
        trackingListMessageId TEXT,
        botPrefix TEXT DEFAULT '!',
        autoDeleteMessages INTEGER DEFAULT 0,
        messageDeleteDelay INTEGER DEFAULT 30,
        requireTimeMinimum INTEGER DEFAULT 0,
        minimumTimeMinutes INTEGER DEFAULT 5,
        allowSelfTracking INTEGER DEFAULT 1,
        enableLeaderboard INTEGER DEFAULT 1,
        leaderboardUpdateInterval INTEGER DEFAULT 60,
        timezone TEXT DEFAULT 'UTC',
        embedColor TEXT DEFAULT '#0099ff',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // User statistics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_stats (
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        totalTimeMs INTEGER DEFAULT 0,
        sessionsCount INTEGER DEFAULT 0,
        lastSeen TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (userId, guildId)
      )
    `);

    // Pause sessions table for tracking pause periods
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pause_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        pauseStartTime TEXT NOT NULL,
        pauseEndTime TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions (id)
      )
    `);
  }

  // Session methods
  createSession(
    session: Omit<TimeTrackingSession, "createdAt" | "updatedAt">
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, userId, guildId, startTime, endTime, pausedTime, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.userId,
      session.guildId,
      session.startTime.toISOString(),
      session.endTime?.toISOString() || null,
      session.pausedTime || 0,
      session.status,
      now,
      now
    );
  }

  getActiveSession(
    userId: string,
    guildId: string
  ): TimeTrackingSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE userId = ? AND guildId = ? AND status IN ('active', 'paused')
      ORDER BY createdAt DESC
      LIMIT 1
    `);

    const result = stmt.get(userId, guildId) as any;
    if (!result) return null;

    return {
      id: result.id,
      userId: result.userId,
      guildId: result.guildId,
      startTime: new Date(result.startTime),
      endTime: result.endTime ? new Date(result.endTime) : undefined,
      pausedTime: result.pausedTime,
      status: result.status,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    } as TimeTrackingSession;
  }

  updateSession(
    sessionId: string,
    updates: Partial<TimeTrackingSession>
  ): void {
    const fields = [];
    const values = [];

    if (updates.endTime !== undefined) {
      fields.push("endTime = ?");
      values.push(updates.endTime?.toISOString() || null);
    }
    if (updates.pausedTime !== undefined) {
      fields.push("pausedTime = ?");
      values.push(updates.pausedTime);
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }

    fields.push("updatedAt = ?");
    values.push(new Date().toISOString());
    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE sessions SET ${fields.join(", ")} WHERE id = ?
    `);

    stmt.run(...values);
  }

  getAllActiveSessions(guildId: string): TimeTrackingSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE guildId = ? AND status IN ('active', 'paused')
      ORDER BY startTime ASC
    `);

    const results = stmt.all(guildId) as any[];
    return results.map(
      (result) =>
        ({
          id: result.id,
          userId: result.userId,
          guildId: result.guildId,
          startTime: new Date(result.startTime),
          endTime: result.endTime ? new Date(result.endTime) : undefined,
          pausedTime: result.pausedTime,
          status: result.status,
          createdAt: new Date(result.createdAt),
          updatedAt: new Date(result.updatedAt),
        } as TimeTrackingSession)
    );
  }

  // Guild settings methods
  getGuildSettings(guildId: string): GuildSettings | null {
    const stmt = this.db.prepare(
      "SELECT * FROM guild_settings WHERE guildId = ?"
    );
    const result = stmt.get(guildId) as any;

    if (!result) return null;

    return {
      guildId: result.guildId,
      trackingChannelId: result.trackingChannelId,
      showOnlineMessages: Boolean(result.showOnlineMessages),
      showOfflineMessages: Boolean(result.showOfflineMessages),
      showTrackingList: Boolean(result.showTrackingList),
      trackingListMessageId: result.trackingListMessageId,
      botPrefix: result.botPrefix || "!",
      autoDeleteMessages: Boolean(result.autoDeleteMessages),
      messageDeleteDelay: result.messageDeleteDelay || 30,
      requireTimeMinimum: Boolean(result.requireTimeMinimum),
      minimumTimeMinutes: result.minimumTimeMinutes || 5,
      allowSelfTracking: Boolean(result.allowSelfTracking),
      enableLeaderboard: Boolean(result.enableLeaderboard),
      leaderboardUpdateInterval: result.leaderboardUpdateInterval || 60,
      timezone: result.timezone || "UTC",
      embedColor: result.embedColor || "#0099ff",
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  createOrUpdateGuildSettings(
    settings: Omit<GuildSettings, "createdAt" | "updatedAt">
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO guild_settings 
      (guildId, trackingChannelId, showOnlineMessages, showOfflineMessages, showTrackingList, trackingListMessageId,
       botPrefix, autoDeleteMessages, messageDeleteDelay, requireTimeMinimum, minimumTimeMinutes,
       allowSelfTracking, enableLeaderboard, leaderboardUpdateInterval, timezone, embedColor, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
              COALESCE((SELECT createdAt FROM guild_settings WHERE guildId = ?), ?), ?)
    `);

    stmt.run(
      settings.guildId,
      settings.trackingChannelId || null,
      settings.showOnlineMessages ? 1 : 0,
      settings.showOfflineMessages ? 1 : 0,
      settings.showTrackingList ? 1 : 0,
      settings.trackingListMessageId || null,
      settings.botPrefix || "!",
      settings.autoDeleteMessages ? 1 : 0,
      settings.messageDeleteDelay || 30,
      settings.requireTimeMinimum ? 1 : 0,
      settings.minimumTimeMinutes || 5,
      settings.allowSelfTracking ? 1 : 0,
      settings.enableLeaderboard ? 1 : 0,
      settings.leaderboardUpdateInterval || 60,
      settings.timezone || "UTC",
      settings.embedColor || "#0099ff",
      settings.guildId,
      now,
      now
    );
  }

  // User stats methods
  getUserStats(userId: string, guildId: string): UserStats | null {
    const stmt = this.db.prepare(
      "SELECT * FROM user_stats WHERE userId = ? AND guildId = ?"
    );
    const result = stmt.get(userId, guildId) as any;

    if (!result) return null;

    return {
      userId: result.userId,
      guildId: result.guildId,
      totalTimeMs: result.totalTimeMs,
      sessionsCount: result.sessionsCount,
      lastSeen: new Date(result.lastSeen),
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  updateUserStats(
    userId: string,
    guildId: string,
    sessionTimeMs: number
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_stats 
      (userId, guildId, totalTimeMs, sessionsCount, lastSeen, createdAt, updatedAt)
      VALUES (
        ?, ?, 
        COALESCE((SELECT totalTimeMs FROM user_stats WHERE userId = ? AND guildId = ?), 0) + ?,
        COALESCE((SELECT sessionsCount FROM user_stats WHERE userId = ? AND guildId = ?), 0) + 1,
        ?,
        COALESCE((SELECT createdAt FROM user_stats WHERE userId = ? AND guildId = ?), ?),
        ?
      )
    `);

    stmt.run(
      userId,
      guildId,
      userId,
      guildId,
      sessionTimeMs,
      userId,
      guildId,
      now,
      userId,
      guildId,
      now,
      now
    );
  }

  // Pause session methods
  startPause(sessionId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO pause_sessions (sessionId, pauseStartTime)
      VALUES (?, ?)
    `);
    stmt.run(sessionId, new Date().toISOString());
  }

  endPause(sessionId: string): number {
    const now = new Date().toISOString();

    // Get the latest pause session
    const getStmt = this.db.prepare(`
      SELECT * FROM pause_sessions 
      WHERE sessionId = ? AND pauseEndTime IS NULL
      ORDER BY pauseStartTime DESC
      LIMIT 1
    `);
    const pauseSession = getStmt.get(sessionId) as any;

    if (!pauseSession) return 0;

    // Update the pause session
    const updateStmt = this.db.prepare(`
      UPDATE pause_sessions SET pauseEndTime = ? WHERE id = ?
    `);
    updateStmt.run(now, pauseSession.id);

    // Calculate pause duration
    const pauseStart = new Date(pauseSession.pauseStartTime);
    const pauseEnd = new Date(now);
    return pauseEnd.getTime() - pauseStart.getTime();
  }

  close(): void {
    this.db.close();
  }
}

// Initialize database instance
const dbPath = process.env["DATABASE_PATH"] || "./data/timetracker.db";
export const database = new DatabaseManager(dbPath);
