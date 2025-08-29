import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  Collection,
} from "discord.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
}

export interface TimeTrackingSession {
  id: string;
  userId: string;
  guildId: string;
  startTime: Date;
  endTime?: Date;
  pausedTime?: number; // Total paused time in milliseconds
  status: "active" | "paused" | "stopped";
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildSettings {
  guildId: string;
  trackingChannelId?: string;
  showOnlineMessages: boolean;
  showOfflineMessages: boolean;
  showTrackingList: boolean;
  trackingListMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  userId: string;
  guildId: string;
  totalTimeMs: number; // Total time tracked in milliseconds
  sessionsCount: number;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PauseSession {
  sessionId: string;
  pauseStartTime: Date;
  pauseEndTime?: Date;
}

export interface TrackingListUser {
  userId: string;
  username: string;
  startTime: Date;
  status: "active" | "paused";
}
