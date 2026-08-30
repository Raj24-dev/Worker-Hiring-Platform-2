import "server-only";
import {
  SETU_FIELDS,
  buildSetuPrompt,
  type SetuLanguage,
  type SetuProfile,
} from "./core";

/**
 * Gemini and Sarvam over plain fetch — no SDKs. Both are simple REST calls and
 * a serverless function starts faster without the extra dependency.
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Tried in order; the free tier rate-limits, so a fallback matters. */
const MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"];

const key = (name: "GEMINI_API_KEY" | "SARVAM_API_KEY") => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

export type SetuTurn = { role: "user" | "model"; text: string };

export type SetuReply = { reply: string; fields: SetuProfile; done: boolean };

/** Only string fields, all optional — the model reports what it actually learned. */
const FIELD_SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries(SETU_FIELDS.map((f) => [f, { type: "STRING" }])),
};

async function callGemini(body: unknown) {
  let lastError = "";
  for (const model of MODELS) {
    try {
      const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${key("GEMINI_API_KEY")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text as string;
      lastError = `${model}: empty response`;
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : "failed"}`;
    }
  }
  throw new Error(lastError || "Gemini unavailable");
}

/** One conversational turn. History travels with the request, so this is stateless. */
export async function setuTurn(
  language: SetuLanguage,
  profile: SetuProfile,
  history: SetuTurn[],
  message: string,
): Promise<SetuReply> {
  const raw = await callGemini({
    systemInstruction: { parts: [{ text: buildSetuPrompt(language, profile) }] },
    contents: [
      ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      { role: "user", parts: [{ text: message }] },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 900,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          reply: { type: "STRING" },
          fields: FIELD_SCHEMA,
          done: { type: "BOOLEAN" },
        },
        required: ["reply", "fields", "done"],
      },
    },
  });

  const parsed = JSON.parse(raw) as SetuReply;
  return {
    reply: String(parsed.reply ?? "").trim(),
    fields: parsed.fields ?? {},
    done: !!parsed.done,
  };
}

/**
 * The remarks shown on the profile, written in the worker's own voice — the
 * profile should read as if they wrote it themselves.
 */
export async function writeRemarks(profile: SetuProfile, trade: string) {
  const facts = Object.entries(profile)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const fallback = [
    `I am a ${trade.toLowerCase()}`,
    profile.experience_years ? `with ${profile.experience_years} of experience` : null,
    profile.skills ? `working mainly on ${profile.skills.toLowerCase()}` : null,
    profile.location ? `in ${profile.location}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .concat(".");

  try {
    const text = await callGemini({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Write this worker's profile summary in ENGLISH, in FIRST PERSON, as if the worker wrote it themselves.

Trade: ${trade}
${facts}

Rules:
- Start with "I am" or "I have".
- 25 to 45 words, one paragraph, plain everyday English.
- Only state what the facts above support. Invent nothing.
- No markdown, no quotes, no bullet points.

Example of the tone: "I am an electrician with 9 years of experience in AC repair and house wiring. I have my own tools and take daily wage work around Andheri."`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    });
    return text.trim().replace(/^["']|["']$/g, "") || fallback;
  } catch {
    return fallback;
  }
}

/** Sarvam speech-to-text. Detects the Indian language on its own. */
export async function transcribe(audio: Blob, language?: SetuLanguage) {
  const form = new FormData();
  form.append("file", audio, "speech.wav");
  form.append("model", "saarika:v2.5");
  // "unknown" lets Sarvam identify the language, so nobody picks from a dropdown.
  form.append("language_code", language ?? "unknown");

  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": key("SARVAM_API_KEY") },
    body: form,
  });
  if (!res.ok) throw new Error(`Sarvam STT ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as {
    transcript?: string;
    language_code?: string;
    language_probability?: number;
  };
  return {
    transcript: (data.transcript ?? "").trim(),
    language: data.language_code ?? null,
    confidence: data.language_probability ?? null,
  };
}

/** Sarvam text-to-speech. Returns base64 WAV. */
export async function speak(text: string, language: SetuLanguage) {
  const clean = text.replace(/[*_`#\[\]{}]/g, "").trim().slice(0, 500);
  if (!clean) return null;

  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": key("SARVAM_API_KEY"),
    },
    body: JSON.stringify({
      inputs: [clean],
      target_language_code: language,
      speaker: "shubh",
      model: "bulbul:v3",
      enable_preprocessing: true,
      speech_sample_rate: 22050,
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { audios?: string[] };
  return data.audios?.[0] ?? null;
}
