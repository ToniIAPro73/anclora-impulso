import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Catalogue synchronisation that never destroys history (history integrity F1).
 *
 * The catalogue is reconciled by name:
 *  - exercises in the seed list are created or updated, and un-archived;
 *  - exercises absent from the list are ARCHIVED, never deleted;
 *  - duplicates by name keep the oldest row active and archive the rest (references are not merged or moved).
 *
 * Exercises referenced by sessions, personal records, routines or progression state cannot be deleted by the database
 * (foreign keys are NO ACTION), so a plain delete here would fail; archiving keeps every relation intact.
 * Idempotent: a second run over the same list leaves the same ids, names and archive state.
 */
export type CatalogSeed = Prisma.ExerciseCreateInput;

export async function syncExerciseCatalog(
  client: Pick<PrismaClient, 'exercise'>,
  seeds: ReadonlyArray<CatalogSeed>,
  now: Date = new Date(),
): Promise<{ created: number; updated: number; archived: number }> {
  const listed = new Set(seeds.map((seed) => seed.name));
  const existing = await client.exercise.findMany({
    select: { id: true, name: true, archivedAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const canonicalByName = new Map<string, string>();
  const duplicateIds = new Set<string>();
  for (const row of existing) {
    if (canonicalByName.has(row.name)) {
      duplicateIds.add(row.id);
    } else {
      canonicalByName.set(row.name, row.id);
    }
  }

  const toArchive = existing
    .filter((row) => row.archivedAt === null && (duplicateIds.has(row.id) || !listed.has(row.name)))
    .map((row) => row.id);

  if (toArchive.length > 0) {
    await client.exercise.updateMany({ where: { id: { in: toArchive } }, data: { archivedAt: now } });
  }

  let created = 0;
  let updated = 0;
  for (const seed of seeds) {
    const id = canonicalByName.get(seed.name);
    if (id) {
      await client.exercise.update({ where: { id }, data: { ...seed, archivedAt: null } });
      updated += 1;
    } else {
      await client.exercise.create({ data: seed });
      created += 1;
    }
  }

  return { created, updated, archived: toArchive.length };
}
