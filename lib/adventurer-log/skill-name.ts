import { SKILLS } from "@/lib/skills/icons";

/**
 * A skill by the name the engine's level-up text uses (lowercase), pulled out
 * of `body.ts` so code that only needs this - the timeline's level-up
 * grouping, which runs in the browser - is not pulled into importing the
 * item tables `body.ts` also needs (`@/lib/items/names`, `@/lib/items/objects`),
 * which are large and server-side only in spirit.
 *
 * `lib/skills/icons.ts` is already tiny and safe in client code.
 */

const SKILLS_BY_NAME = new Map(
  SKILLS.map((skill) => [skill.name.toLowerCase(), skill]),
);
// the hiscores say Runecrafting; the stats tab and the engine say Runecraft
SKILLS_BY_NAME.set("runecrafting", SKILLS_BY_NAME.get("runecraft")!);

export function skillByName(name: string) {
  return SKILLS_BY_NAME.get(name.toLowerCase()) ?? null;
}
