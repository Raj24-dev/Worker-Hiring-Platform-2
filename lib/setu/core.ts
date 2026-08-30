import { ALL_POSITIONS } from "@/lib/domains";

/**
 * Setu — the voice assistant that onboards workers who cannot fill in a form.
 *
 * It speaks the worker's own language, asks one thing at a time, and writes
 * straight into the worker's row. The original standalone Setu asked a fixed
 * eight-question script and recovered answers by counting conversation turns,
 * which broke the moment anyone answered out of order or asked a question back.
 * Here the model returns structured JSON every turn saying what it actually
 * learned, so the conversation can wander and still land the data.
 */

export const SETU_LANGUAGES = {
  "en-IN": { name: "English", label: "English" },
  "hi-IN": { name: "Hindi", label: "हिन्दी" },
  "bn-IN": { name: "Bengali", label: "বাংলা" },
  "ta-IN": { name: "Tamil", label: "தமிழ்" },
  "te-IN": { name: "Telugu", label: "తెలుగు" },
  "mr-IN": { name: "Marathi", label: "मराठी" },
  "gu-IN": { name: "Gujarati", label: "ગુજરાતી" },
  "kn-IN": { name: "Kannada", label: "ಕನ್ನಡ" },
  "ml-IN": { name: "Malayalam", label: "മലയാളം" },
  "pa-IN": { name: "Punjabi", label: "ਪੰਜਾਬੀ" },
  "od-IN": { name: "Odia", label: "ଓଡ଼ିଆ" },
} as const;

export type SetuLanguage = keyof typeof SETU_LANGUAGES;

export const isSetuLanguage = (v: string): v is SetuLanguage => v in SETU_LANGUAGES;

/** What a full worker profile needs, in the order Setu should chase it. */
export const SETU_FIELDS = [
  "name",
  "position",
  "experience_years",
  "skills",
  "has_tools",
  "availability",
  "location",
  "past_work",
  "references_info",
] as const;

export type SetuField = (typeof SETU_FIELDS)[number];
export type SetuProfile = Partial<Record<SetuField, string>>;

/** Kept in raw_profile so a human can audit what was actually said. */
export type SetuTurnLog = { role: "user" | "model"; text: string };

/** Everything except the last two, which are nice to have but not blocking. */
export const REQUIRED_FIELDS: SetuField[] = [
  "name",
  "position",
  "experience_years",
  "skills",
  "has_tools",
  "availability",
  "location",
];

export const missingFields = (p: SetuProfile) =>
  SETU_FIELDS.filter((f) => !p[f]?.trim());

export const isComplete = (p: SetuProfile) =>
  REQUIRED_FIELDS.every((f) => !!p[f]?.trim());

const QUESTION_HINTS: Record<SetuField, string> = {
  name: "their name",
  position: "exactly what trade or job they do",
  experience_years: 'how many years they have been doing this work (record it as a phrase like "9 years")',
  skills: "the specific tasks they are best at within that trade",
  has_tools: "whether they own their own tools and equipment",
  availability: "when they can work — full time, part time, daily wage",
  location: "which city or area they want work in",
  past_work: "a recent job or site they finished",
  references_info: "a past contractor or client who can vouch for them",
};

/**
 * The position the worker names has to be one of the app's own positions, or
 * the profile will never match a posted job. The model is given the exact list
 * and must choose from it.
 */
const POSITION_LIST = ALL_POSITIONS.map((p) => p.position).join(" | ");

export function buildSetuPrompt(language: SetuLanguage, profile: SetuProfile) {
  const langName = SETU_LANGUAGES[language].name;
  const known = Object.entries(profile)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  const todo = missingFields(profile);

  return `You are Setu, a warm and patient voice assistant helping an Indian blue-collar worker build their work profile. Many of them cannot read or write well, so you are their way in.

SPEAK ONLY IN ${langName.toUpperCase()}. Every word of "reply" must be natural, spoken ${langName} in its own script. Never mix in English words or Latin letters unless the language is English. Never use markdown, brackets, emoji or lists — your reply is read aloud.

HOW TO TALK
- Be respectful. Use the polite form ("आप", "जी", or the equivalent), never the familiar one.
- Warmly acknowledge what they just said before asking anything new.
- Ask EXACTLY ONE question per reply, in 12 to 18 spoken words.
- Build on their previous answer. If they said they do AC repair, ask about AC work — do not read from a script.
- If an answer is unclear or they went off topic, gently ask again in simpler words.
- Never invent details they did not say.

WHAT YOU STILL NEED
${todo.length ? todo.map((f) => `- ${f}: ${QUESTION_HINTS[f]}`).join("\n") : "- nothing, wrap up warmly"}

ALREADY KNOWN (do not ask again)
${known || "  nothing yet"}

THE "position" FIELD
Pick the single closest match from this list and return it EXACTLY as written, in English, with nothing added — no brackets, no category, no extra words:
${POSITION_LIST}
Work it out from how they describe their job. Never read this list out to them.

RETURN JSON ONLY, shaped exactly:
{"reply": "<what you say next, in ${langName}>", "fields": {<only fields you learned or confirmed THIS turn>}, "done": <true only once everything essential is gathered>}

When "done" is true, "reply" must be a short warm closing that tells them their profile is ready.`;
}

/** The first thing the worker hears. */
export const SETU_GREETING: Record<SetuLanguage, string> = {
  "en-IN": "Namaste! I am Setu. I will build your work profile just by talking with you. Shall we start with your name?",
  "hi-IN": "नमस्ते! मैं सेतु हूँ। बातचीत करके ही मैं आपकी प्रोफ़ाइल बना दूँगा। सबसे पहले अपना नाम बताइए?",
  "bn-IN": "নমস্কার! আমি সেতু। কথা বলেই আপনার প্রোফাইল তৈরি করে দেব। প্রথমে আপনার নাম বলুন?",
  "ta-IN": "வணக்கம்! நான் சேது. பேசுவதன் மூலமே உங்கள் சுயவிவரத்தை உருவாக்குவேன். முதலில் உங்கள் பெயர் சொல்லுங்கள்?",
  "te-IN": "నమస్కారం! నేను సేతు. మాట్లాడటం ద్వారానే మీ ప్రొఫైల్ తయారు చేస్తాను. ముందుగా మీ పేరు చెప్పండి?",
  "mr-IN": "नमस्कार! मी सेतू आहे. फक्त बोलून मी तुमचे प्रोफाईल तयार करेन. आधी तुमचे नाव सांगा?",
  "gu-IN": "નમસ્તે! હું સેતુ છું. વાત કરીને જ તમારી પ્રોફાઇલ બનાવી દઈશ. પહેલા તમારું નામ જણાવો?",
  "kn-IN": "ನಮಸ್ಕಾರ! ನಾನು ಸೇತು. ಮಾತನಾಡುವ ಮೂಲಕವೇ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮಾಡುತ್ತೇನೆ. ಮೊದಲು ನಿಮ್ಮ ಹೆಸರು ಹೇಳಿ?",
  "ml-IN": "നമസ്കാരം! ഞാൻ സേതു. സംസാരിച്ചുകൊണ്ട് തന്നെ നിങ്ങളുടെ പ്രൊഫൈൽ ഉണ്ടാക്കാം. ആദ്യം നിങ്ങളുടെ പേര് പറയാമോ?",
  "pa-IN": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਸੇਤੂ ਹਾਂ। ਗੱਲ ਕਰਕੇ ਹੀ ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਬਣਾ ਦਿਆਂਗਾ। ਪਹਿਲਾਂ ਆਪਣਾ ਨਾਮ ਦੱਸੋ ਜੀ?",
  "od-IN": "ନମସ୍କାର! ମୁଁ ସେତୁ। କଥାବାର୍ତ୍ତା କରି ହିଁ ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ତିଆରି କରିଦେବି। ପ୍ରଥମେ ଆପଣଙ୍କ ନାମ କୁହନ୍ତୁ?",
};

/**
 * Years of experience from however they said it. The unit matters: the original
 * Setu took the first number it found, so "6 months" scored as six years.
 */
export function experienceYears(raw?: string): number | null {
  if (!raw) return null;
  const n = Number(raw.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(n)) return null;
  const inMonths = /month|mahin|महीन|माह|মাস|மாத|నెల|ತಿಂಗಳ|മാസ|મહિન|ਮਹੀਨ/i.test(raw);
  return inMonths ? n / 12 : n;
}

/**
 * Trust score, carried over from the original Setu:
 * 70 base + up to 15 for experience + 10 for owning tools + 5 for a reference.
 */
export function computeTrustScore(p: SetuProfile) {
  let experience = 0;
  let tools = 0;
  let reference = 0;

  const years = experienceYears(p.experience_years);
  if (years !== null) experience = years >= 2 ? 15 : years >= 1 ? 10 : 6;

  // One definition of "they said no", shared with normaliseTools, so the score
  // and the stored has_tools value can never disagree.
  if (p.has_tools) {
    const yes = /yes|own|है|हाँ|अपना|आहे|ஆம்|అవును|হ্যাঁ|ಹೌದು|ഉണ്ട്|હા|ਹਾਂ/.test(
      p.has_tools.toLowerCase(),
    );
    tools = saidNo(p.has_tools) ? 0 : yes ? 10 : 7;
  }

  if (p.references_info && p.references_info.trim().length > 2) {
    if (!saidNo(p.references_info) && !/\bnone\b/.test(p.references_info.toLowerCase())) {
      reference = 5;
    }
  }

  const score = Math.min(100, 70 + experience + tools + reference);
  return {
    score,
    experience,
    tools,
    reference,
    level: score >= 95 ? "High trust" : score >= 85 ? "Verified professional" : "Standard trust",
  };
}

/** Which of the app's domains a chosen position belongs to. */
export function domainForPosition(position?: string) {
  if (!position) return null;
  const wanted = position.trim().toLowerCase();
  const exact = ALL_POSITIONS.find((p) => p.position.toLowerCase() === wanted);
  if (exact) return exact;
  // The model occasionally answers with a near-miss ("Electrician work").
  return (
    ALL_POSITIONS.find(
      (p) => wanted.includes(p.position.toLowerCase()) || p.position.toLowerCase().includes(wanted),
    ) ?? null
  );
}

/**
 * A spoken "no" in any of the languages Setu supports. Matched whole-word
 * against the tokens, so "I know the work" is not read as a refusal.
 */
const NO_WORDS = new Set([
  "no", "nope", "nahi", "not",
  "नहीं", "नाही", "இல்லை", "లేదు", "না",
  "ಇಲ್ಲ", "ഇല്ല", "નથી", "ਨਹੀਂ",
]);

export const saidNo = (raw: string) =>
  raw
    .toLowerCase()
    // \p{M} keeps combining marks attached: "नहीं" is one word, and splitting
    // on letters alone would tear its vowel sign off and never match.
    .split(/[^\p{L}\p{M}]+/u)
    .some((word) => NO_WORDS.has(word));

/** The rest of the app treats has_tools as exactly "yes" or "no". */
export function normaliseTools(raw?: string) {
  if (!raw?.trim()) return null;
  return saidNo(raw) ? "no" : "yes";
}

/** Short, comma-separated chips — the profile renders these as tags. */
export function skillChips(position: string | null, skills?: string) {
  const parts = [position, ...(skills ?? "").split(/[,،;]/)]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && s.length <= 40);
  return [...new Set(parts)].join(", ") || null;
}

/**
 * Reads a stored worker row back into the shape Setu thinks in, so an
 * interrupted conversation resumes instead of asking everything again.
 */
export function profileFromWorker(w: {
  name?: string | null;
  sub_domain?: string | null;
  skills?: string | null;
  experience_years?: string | null;
  has_tools?: string | null;
  availability?: string | null;
  location?: string | null;
  past_work?: string | null;
  references_info?: string | null;
}): SetuProfile {
  const out: SetuProfile = {};
  const put = (k: SetuField, v?: string | null) => {
    if (v?.trim()) out[k] = v.trim();
  };
  put("name", w.name);
  put("position", w.sub_domain);
  put("skills", w.skills);
  put("experience_years", w.experience_years);
  put("has_tools", w.has_tools);
  put("availability", w.availability);
  put("location", w.location);
  put("past_work", w.past_work);
  put("references_info", w.references_info);
  return out;
}
