import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { adaptSkillOutputToMealPlanImport } from '../../src/services/nutrition/plan-import/skill-adapter';

async function main() {
  const fileArg = process.argv.slice(2).find((arg) => arg !== '--');
  if (!fileArg) {
    console.error('Uso: pnpm run nutrition:validate-plan -- <ruta-al-json>');
    process.exit(2);
  }

  const resolved = path.resolve(process.cwd(), fileArg);
  const raw = await fs.readFile(resolved, 'utf8');
  const result = adaptSkillOutputToMealPlanImport({ rawPayload: raw });

  console.log(
    JSON.stringify(
      {
        file: path.relative(process.cwd(), resolved),
        status: result.status,
        errors: result.errors,
        warnings: result.warnings,
        missingData: result.missingData,
        safetyFlags: result.safetyFlags,
      },
      null,
      2
    )
  );

  if (result.status === 'REJECTED') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
