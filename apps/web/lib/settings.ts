import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { paths } from "@coach/lib";

export const SettingsSchema = z.object({
  situation_prompt: z.string().default(""),
  rest_timer_default: z.number().int().min(30).max(600).default(120),
});

export type Settings = z.infer<typeof SettingsSchema>;

const settingsPath = () => path.join(paths.data(), "settings.json");

export async function readSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf-8");
    return SettingsSchema.parse(JSON.parse(raw));
  } catch {
    return SettingsSchema.parse({});
  }
}

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readSettings();
  const next = SettingsSchema.parse({ ...current, ...patch });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}
