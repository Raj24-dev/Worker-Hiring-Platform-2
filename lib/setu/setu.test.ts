/**
 * The pure parts of Setu — the ones that would quietly write the wrong thing
 * into a worker's profile if they broke.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "vitest";

import {
  REQUIRED_FIELDS,
  buildSetuPrompt,
  computeTrustScore,
  domainForPosition,
  experienceYears,
  isComplete,
  missingFields,
  normaliseTools,
  skillChips,
  type SetuProfile,
} from "@/lib/setu/core";

const FULL: SetuProfile = {
  name: "Suresh Yadav",
  position: "Electrician",
  experience_years: "9 years",
  skills: "AC repair, house wiring",
  has_tools: "Yes, I have my own tools",
  availability: "Full time",
  location: "Andheri, Mumbai",
  references_info: "Contractor Rakesh, 9812345678",
};

test("a spoken trade maps onto the app's own taxonomy", () => {
  // If this drifts, a voice-built profile never matches a posted job.
  assert.equal(domainForPosition("Electrician")?.domain, "construction");
  assert.equal(domainForPosition("Cook")?.domain, "household");
  assert.equal(domainForPosition("Truck driver")?.domain, "driving");

  // The model has been known to echo the list formatting back.
  assert.equal(domainForPosition("Electrician (Construction)")?.position, "Electrician");
  assert.equal(domainForPosition("electrician")?.position, "Electrician");

  assert.equal(domainForPosition("Astronaut"), null);
  assert.equal(domainForPosition(undefined), null);
});

test("tools collapse to the yes/no the rest of the app reads", () => {
  assert.equal(normaliseTools("Yes, I have my own tools"), "yes");
  assert.equal(normaliseTools("हाँ, मेरे पास अपने औज़ार हैं"), "yes");
  assert.equal(normaliseTools("No, I borrow them"), "no");
  assert.equal(normaliseTools("नहीं"), "no");
  assert.equal(normaliseTools(undefined), null);
  // Whole-word matching: "know" must not read as "no".
  assert.equal(normaliseTools("I know this work well"), "yes");
});

test("skills become short chips, never a paragraph", () => {
  assert.equal(skillChips("Electrician", "AC repair, house wiring"), "Electrician, AC repair, house wiring");
  // The position is never duplicated.
  assert.equal(skillChips("Electrician", "Electrician, wiring"), "Electrician, wiring");
  // A rambling sentence is dropped rather than rendered as one giant tag.
  const rambling = "I do all kinds of electrical work in houses and also shops and sometimes factories";
  assert.equal(skillChips("Electrician", rambling), "Electrician");
  assert.equal(skillChips(null, ""), null);
});

test("trust score follows the published formula", () => {
  // 70 base + 15 experience + 10 tools + 5 reference
  assert.equal(computeTrustScore(FULL).score, 100);

  assert.equal(computeTrustScore({}).score, 70, "an empty profile stays at the base");
  assert.equal(computeTrustScore({ experience_years: "9 years" }).score, 85);
  assert.equal(computeTrustScore({ experience_years: "1 year" }).score, 80);

  // Months are not years. The original Setu took the first number it saw, so
  // "6 months" scored the same as six years of experience.
  assert.equal(computeTrustScore({ experience_years: "6 months" }).score, 76);
  assert.equal(computeTrustScore({ experience_years: "6 महीने" }).score, 76);
  assert.equal(experienceYears("6 months"), 0.5);
  assert.equal(experienceYears("9 years"), 9);
  assert.equal(experienceYears("9 साल"), 9);
  // Only digits are read. The prompt asks the model to record a phrase like
  // "9 years", so a spelled-out number never reaches here.
  assert.equal(experienceYears("many years"), null);
  assert.equal(experienceYears(undefined), null);

  // Saying no to tools must not earn the points for owning them.
  assert.equal(computeTrustScore({ has_tools: "no" }).tools, 0);
  assert.equal(computeTrustScore({ has_tools: "नहीं" }).tools, 0);
  assert.equal(computeTrustScore({ has_tools: "yes" }).tools, 10);

  assert.equal(computeTrustScore({ references_info: "no one" }).reference, 0);
  assert.equal(computeTrustScore({ references_info: "Rakesh 98123" }).reference, 5);

  assert.ok(computeTrustScore(FULL).score <= 100, "never above 100");
});

test("completeness tracks only what a usable profile needs", () => {
  assert.equal(isComplete(FULL), true);
  assert.equal(isComplete({}), false);

  // past_work and references are welcome but must not block finishing.
  const withoutExtras = { ...FULL };
  delete withoutExtras.references_info;
  assert.equal(isComplete(withoutExtras), true);

  const noLocation = { ...FULL };
  delete noLocation.location;
  assert.equal(isComplete(noLocation), false);

  assert.deepEqual(missingFields({}).slice(0, 2), ["name", "position"]);
  assert.equal(REQUIRED_FIELDS.includes("position"), true);
});

test("the prompt tells the model what is left and what is already known", () => {
  const prompt = buildSetuPrompt("hi-IN", { name: "Suresh Yadav" });

  assert.match(prompt, /HINDI/, "the language is stated in capitals");
  assert.match(prompt, /name: Suresh Yadav/, "known values are listed");
  assert.doesNotMatch(
    prompt.split("ALREADY KNOWN")[0],
    /- name:/,
    "a field already known is not still being chased",
  );
  assert.match(prompt, /- position:/, "a missing field is still being chased");
  assert.match(prompt, /Electrician/, "the position list is offered to choose from");

  // Once every field is in — including the optional ones — the model is told
  // to wrap up rather than keep asking.
  const everything = { ...FULL, past_work: "2BHK rewiring in Andheri West" };
  assert.match(buildSetuPrompt("en-IN", everything), /wrap up warmly/);
});
