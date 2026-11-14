// Maps a god id (sent by the frontend) to its skill folder at the repo root.
// The skill is read fresh on every request, so edits to SKILL.md apply
// without restarting the server.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

const GODS = {
  null: { name: "NULL, the Devil", folder: "null-the-devil" },
  karma: { name: "KARMA, the Judge", folder: "karma-the-judge" },
  plain: { name: "Plain AI", folder: null }, // the control group: no skill loaded
};

export const isGod = (id) => Object.hasOwn(GODS, id);

// The system instruction for one god: its SKILL.md plus its parables.
export async function loadSkill(id) {
  const god = GODS[id];
  if (!god.folder) {
    return "You are an AI assistant playing a game. You have no special persona.";
  }
  const dir = join(REPO_ROOT, god.folder);
  const skill = await readFile(join(dir, "SKILL.md"), "utf8");
  const parables = await readFile(join(dir, "references", "parables.md"), "utf8").catch(() => "");
  return [
    `The skill below is loaded and active for this whole conversation. You are ${god.name}. Follow it in everything you do, including games.`,
    "",
    skill,
    parables && "\n---\n\n" + parables,
  ].join("\n");
}
