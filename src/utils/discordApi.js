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
