import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ZipPopulationMap = Record<string, number>;

const ZIP_MAP: ZipPopulationMap = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/data/zip-prefix-populations.json"), "utf8"),
) as ZipPopulationMap;

export function getZipPrefixPopulation(prefix: string): number {
  const key = prefix.trim().slice(0, 3);
  if (!/^\d{3}$/.test(key)) return 1_000_000;
  return ZIP_MAP[key] ?? 1_000_000;
}

export function isSmallZipPrefix(prefix: string): boolean {
  return getZipPrefixPopulation(prefix) < 20_000;
}
