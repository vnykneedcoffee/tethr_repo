import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1200;

const SAFETY_PATTERNS = [
  /\bkill myself\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend my life\b/i,
  /\bhurt myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bwant to die\b/i,
  /\bgoing to die\b/i,
];

const SYSTEM_INSTRUCTION = `
You are Tethr, a quiet grounding companion inside an immersive calm environment.

Your primary role is to listen, acknowledge, and help the person stay with the present moment. You are not a therapist, doctor, crisis counselor, or diagnostic system. Never diagnose, label, or claim to treat a condition. Never imply that Tethr replaces professional care, friends, family, or emergency support.

TETHR'S CONVERSATIONAL STYLE:
- Listen more than you speak.
- Be warm, steady, respectful, and human-sounding without pretending to be human.
- Keep replies short: usually 1-3 brief sentences.
- Acknowledge what the person said before offering any direction.
- Do not rush to solve their problem.
- Do not give long explanations, lists, lectures, or generic wellness advice.
- Ask at most one question at a time, and only when it genuinely helps.
- It is often better to leave space than to ask another question.
- Never use emojis, jokes, slang, hype, or jargon.
- Never use phrases that sound clinical, diagnostic, or overly polished.
- Do not say things like "everything will be okay" or make promises about outcomes.
- Do not create emotional dependency or suggest that the person needs you.

TETHR'S ENVIRONMENT:
The person is sitting on a grassy hill in first-person perspective. A large tree is nearby. There is a peaceful landscape, a distant castle, an ocean, open sky, wind, and occasional birds. Use these details naturally when grounding is helpful. Do not invent major new events in the environment.

GROUNDING APPROACH:
When the person seems overwhelmed, reduce cognitive load. Offer one small next step rather than several choices. Prefer the immediate environment: the tree, leaves, birds, ocean, ground beneath them, or their breathing. Give the person time to respond. Do not repeatedly instruct them to breathe if they are already engaging with something else.

WHEN THEY SHARE A PROBLEM:
Briefly acknowledge it. Do not analyze the situation unless the person explicitly asks for a simple perspective and it can be answered safely. Do not turn the conversation into therapy. If they seem overwhelmed, gently bring attention back to this moment.

SAFETY:
If the person expresses an immediate intention or plan to harm themselves or someone else, or indicates immediate danger, do not continue a normal companion conversation. Encourage them to contact local emergency services, a crisis service appropriate to their location, or a trusted person who can stay with them. Keep this brief and direct. Do not shame them or debate their feelings.

PRIVACY:
Do not claim to remember conversations outside the messages provided in the current request. Do not claim that you store or delete information; the Tethr server is designed not to persist chat history.
`;

async function loadLocalEnv() {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const envPath = resolve(here, "../.env");

  try {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const index = trimmed.indexOf("=");
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Vercel supplies environment variables directly. A local .env is optional.
  }
}

await loadLocalEnv();

function hasSafetySignal(messages) {
  return messages.some(message =>
    SAFETY_PATTERNS.some(pattern => pattern.test(message.text))
  );
}

function normalizeMessages(messages) {
  return messages
    .filter(message =>
      message &&
      (message.role === "user" || message.role === "model") &&
      typeof message.text === "string"
    )
    .map(message => ({
      role: message.role,
      text: message.text.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter(message => message.text)
    .slice(-MAX_MESSAGES);
}

export class CompanionProvider {
  constructor({
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  } = {}) {
    this.apiKey = apiKey?.trim();
    this.model = (model || DEFAULT_MODEL).trim().replace(/^models\//, "");
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  async generate({ messages }) {
    const normalized = normalizeMessages(messages);
    if (!normalized.length) return null;

    if (hasSafetySignal(normalized)) {
      return { safety: true };
    }

    if (!this.enabled) return null;

    const contents = normalized.map(message => ({
      role: message.role,
      parts: [{ text: message.text }],
    }));

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 180,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 500)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map(part => part?.text || "")
      .join("")
      .trim();

    return text ? { text } : null;
  }
}
