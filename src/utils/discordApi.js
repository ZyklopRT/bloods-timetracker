import "dotenv/config";

export async function DiscordRequest(endpoint, options = {}) {
  const url = "https://discord.com/api/v10/" + endpoint;

  if (options.body) {
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.TOKEN}`,
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "BloodeTimeTracker/1.0.0",
    },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json();
    console.error("Discord API Error:", res.status, data);
    throw new Error(JSON.stringify(data));
  }

  return res;
}

export async function sendFollowupMessage(
  applicationId,
  interactionToken,
  content
) {
  const endpoint = `webhooks/${applicationId}/${interactionToken}`;

  try {
    await DiscordRequest(endpoint, {
      method: "POST",
      body: content,
    });
  } catch (error) {
    console.error("Error sending followup message:", error);
  }
}

export async function editOriginalMessage(
  applicationId,
  interactionToken,
  content
) {
  const endpoint = `webhooks/${applicationId}/${interactionToken}/messages/@original`;

  try {
    await DiscordRequest(endpoint, {
      method: "PATCH",
      body: content,
    });
  } catch (error) {
    console.error("Error editing original message:", error);
  }
}

/**
 * Send a message to a specific channel
 * @param {string} channelId - Channel ID to send message to
 * @param {Object} messageContent - Message content object
 * @returns {Promise<Object>} Message object
 */
export async function sendChannelMessage(channelId, messageContent) {
  const endpoint = `channels/${channelId}/messages`;

  try {
    const response = await DiscordRequest(endpoint, {
      method: "POST",
      body: messageContent,
    });
    const messageData = await response.json();
    return messageData;
  } catch (error) {
    console.error("Error sending channel message:", error);
    throw error;
  }
}

/**
 * Edit a specific message in a channel
 * @param {string} channelId - Channel ID
 * @param {string} messageId - Message ID to edit
 * @param {Object} messageContent - New message content
 */
export async function editChannelMessage(channelId, messageId, messageContent) {
  const endpoint = `channels/${channelId}/messages/${messageId}`;

  try {
    await DiscordRequest(endpoint, {
      method: "PATCH",
      body: messageContent,
    });
  } catch (error) {
    console.error("Error editing channel message:", error);
    throw error;
  }
}

/**
 * Get Discord user information
 * @param {string} userId - Discord user ID
 * @returns {Object|null} User object or null if not found
 */
export async function getDiscordUser(userId) {
  try {
    const response = await DiscordRequest(`users/${userId}`, {
      method: "GET",
    });

    const user = await response.json();
    return user;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    return null;
  }
}

/**
 * Get multiple Discord users
 * @param {string[]} userIds - Array of Discord user IDs
 * @returns {Object} Map of userId -> user object
 */
export async function getDiscordUsers(userIds) {
  const users = {};

  // Fetch users in parallel for better performance
  const promises = userIds.map(async (userId) => {
    const user = await getDiscordUser(userId);
    if (user) {
      users[userId] = user;
    }
    return { userId, user };
  });

  await Promise.all(promises);
  return users;
}

/**
 * Format Discord user display name
 * @param {Object|null} user - Discord user object
 * @param {string} fallbackId - Fallback user ID if user not found
 * @returns {string} Formatted display name
 */
export function formatUserDisplayName(user, fallbackId) {
  if (!user) {
    return `User ${fallbackId.slice(0, 8)}...`;
  }

  // Use global_name if available (new Discord display names), otherwise username
  const displayName = user.global_name || user.username;
  return displayName;
}
