const DEFAULT_MODEL = "gemini-3.6-flash";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim().replace(/^models\//, "");

  return res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model,
  });
}
