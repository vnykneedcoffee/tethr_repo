import { CompanionProvider } from "../server/provider.mjs";

const provider = new CompanionProvider();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});

    // The AI companion is intentionally available only from Level 3.
    if (body.level !== 3) {
      return res.status(403).json({ error: "The companion is available only in Level 3." });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages." });
    }

    const result = await provider.generate({ messages: body.messages });

    if (result?.safety) {
      return res.status(200).json({ safety: true });
    }

    if (!result?.text) {
      return res.status(503).json({ error: "Companion unavailable." });
    }

    return res.status(200).json({ text: result.text });
  } catch (error) {
    console.error("Tethr companion error:", error?.message || error);
    return res.status(500).json({ error: "Companion unavailable." });
  }
}
