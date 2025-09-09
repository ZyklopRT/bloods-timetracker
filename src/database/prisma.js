import { PrismaClient } from "@prisma/client";

class PrismaService {
  constructor() {
    this.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["error"],
    });

    console.log(`✅ Prisma connected to PostgreSQL`);
  }

  /**
   * Start a new tracking session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} startTime - Session start time
   * @returns {Promise<string>} Session ID
   */
  async startSession(userId, guildId, startTime) {
    const session = await this.prisma.session.create({
      data: {
        userId,
        guildId,
        status: "ACTIVE",
        events: {
          create: {
            eventType: "START",
            timestamp: startTime,
          },
        },
      },
    });

    return session.id;
  }

  /**
   * Stop an active session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} endTime - Session end time
   */
  async stopSession(userId, guildId, endTime) {
    const activeSession = await this.getActiveSession(userId, guildId);
    if (!activeSession) {
      throw new Error("No active session found");
    }

    await this.prisma.$transaction([
      // Add stop event
      this.prisma.sessionEvent.create({
        data: {
          sessionId: activeSession.id,
          eventType: "STOP",
          timestamp: endTime,
        },
      }),
      // Update session status
      this.prisma.session.update({
        where: { id: activeSession.id },
        data: { status: "COMPLETED" },
      }),
    ]);
  }

  /**
   * Pause an active session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} pauseTime - Pause timestamp
   */
  async pauseSession(userId, guildId, pauseTime) {
    const activeSession = await this.getActiveSession(userId, guildId);
    if (!activeSession) {
      throw new Error("No active session found");
    }

    await this.prisma.$transaction([
      // Add pause event
      this.prisma.sessionEvent.create({
        data: {
          sessionId: activeSession.id,
          eventType: "PAUSE",
          timestamp: pauseTime,
        },
      }),
      // Update session status
      this.prisma.session.update({
        where: { id: activeSession.id },
        data: { status: "PAUSED" },
      }),
    ]);
  }

  /**
   * Resume a paused session
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @param {Date} resumeTime - Resume time
   */
  async resumeSession(userId, guildId, resumeTime) {
    const activeSession = await this.getActiveSession(userId, guildId);
    if (!activeSession) {
      throw new Error("No active session found");
    }

    await this.prisma.$transaction([
      // Add resume event
      this.prisma.sessionEvent.create({
        data: {
          sessionId: activeSession.id,
          eventType: "RESUME",
          timestamp: resumeTime,
        },
      }),
      // Update session status
      this.prisma.session.update({
        where: { id: activeSession.id },
        data: { status: "ACTIVE" },
      }),
    ]);
  }

  /**
   * Get active session for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object|null>} Active session or null
   */
  async getActiveSession(userId, guildId) {
    const session = await this.prisma.session.findFirst({
      where: {
        userId,
        guildId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (session) {
      // Add compatibility fields
      const startEvent = session.events.find((e) => e.eventType === "START");
      if (startEvent) {
        session.startTime = startEvent.timestamp;
      }
    }

    return session;
  }

  /**
   * Get all active sessions for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of active sessions
   */
  async getAllActiveSessions(guildId) {
    const sessions = await this.prisma.session.findMany({
      where: {
        guildId,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return sessions.map((session) => {
      // Add compatibility fields
      const startEvent = session.events.find((e) => e.eventType === "START");
      if (startEvent) {
        session.startTime = startEvent.timestamp;
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
        case "START":
        case "RESUME":
          lastActiveStart = timestamp;
          break;

        case "PAUSE":
          if (lastActiveStart) {
            totalDuration += timestamp.getTime() - lastActiveStart.getTime();
            lastActiveStart = null;
          }
          break;

        case "STOP":
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
   * @returns {Promise<Object>} User stats
   */
  async getUserStats(userId, guildId) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, guildId },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    let totalTimeMs = 0;
    let lastSeen = null;

    // Calculate total time from all sessions using events
    for (const session of sessions) {
      const sessionDuration = this.calculateSessionDuration(session.events);
      totalTimeMs += sessionDuration;

      // Find the latest event timestamp
      if (session.events.length > 0) {
        const latestEvent = session.events[session.events.length - 1];
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
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getLeaderboard(guildId, limit = 10) {
    // Get all users who have sessions
    const users = await this.prisma.session.findMany({
      where: { guildId },
      select: { userId: true },
      distinct: ["userId"],
    });

    const leaderboard = [];

    // Calculate total time for each user
    for (const { userId } of users) {
      const userStats = await this.getUserStats(userId, guildId);
      if (userStats.totalTimeMs > 0) {
        leaderboard.push({
          userId,
          sessionsCount: userStats.sessionsCount,
          totalTimeMs: userStats.totalTimeMs,
        });
      }
    }

    // Sort by total time descending and limit results
    return leaderboard
      .sort((a, b) => b.totalTimeMs - a.totalTimeMs)
      .slice(0, limit);
  }

  /**
   * Get guild settings
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object|null>} Guild settings or null
   */
  async getGuildSettings(guildId) {
    return await this.prisma.guildSettings.findUnique({
      where: { guildId },
    });
  }

  /**
   * Set guild settings
   * @param {string} guildId - Discord guild ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async setGuildSettings(guildId, settings) {
    return await this.prisma.guildSettings.upsert({
      where: { guildId },
      update: settings,
      create: {
        guildId,
        ...settings,
      },
    });
  }

  /**
   * Close database connection
   */
  async close() {
    await this.prisma.$disconnect();
    console.log("🔌 Prisma disconnected");
  }
}

export default PrismaService;
