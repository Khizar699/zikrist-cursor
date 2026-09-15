export interface InstalledPack { language: string; lastUsedAt: number }
export function packsToEvict(packs: InstalledPack[], active: string, limit = 2): string[] {
  if (limit < 1) throw new Error('At least one language must be retained.');
  const unique = new Map(packs.map((pack) => [pack.language, pack]));
  return [...unique.values()].filter((pack) => pack.language !== active)
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
    .slice(0, Math.max(0, unique.size - limit)).map((pack) => pack.language);
}
