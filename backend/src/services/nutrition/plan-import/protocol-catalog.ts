import fs from 'node:fs';
import path from 'node:path';

const catalogData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../shared/nutrition-protocols.json'),
    'utf8'
  )
) as { protocols: readonly DietProtocolEntry[] };

export type PublishedDietType =
  | 'ninguna'
  | 'mediterranea'
  | 'dash'
  | 'ayuno_intermitente'
  | 'alta_proteina';

export type CatalogDietProtocolId =
  | PublishedDietType
  | 'low_carb_moderada'
  | 'bajo_indice_glucemico'
  | 'cetogenica_controlada';

export type ProtocolReviewStatus =
  | 'PUBLISHED_LEGACY'
  | 'PENDING_PROFESSIONAL_REVIEW'
  | 'DISABLED_UNSUPPORTED';

export interface DietProtocolEntry {
  id: CatalogDietProtocolId;
  labelEs: string;
  labelEn: string;
  publishedInGenerator: boolean;
  supportedInImport: boolean;
  reviewStatus: ProtocolReviewStatus;
  requiresProfessionalReview: boolean;
}

export const PUBLISHED_DIET_TYPES = [
  'ninguna',
  'mediterranea',
  'dash',
  'ayuno_intermitente',
  'alta_proteina',
] as const;

export const ALL_CATALOG_DIET_PROTOCOL_IDS = [
  ...PUBLISHED_DIET_TYPES,
  'low_carb_moderada',
  'bajo_indice_glucemico',
  'cetogenica_controlada',
] as const;

export const DIET_PROTOCOL_CATALOG: readonly DietProtocolEntry[] =
  catalogData.protocols as readonly DietProtocolEntry[];

const catalogById = new Map<string, DietProtocolEntry>(
  DIET_PROTOCOL_CATALOG.map((entry) => [entry.id, entry])
);

export function getDietProtocol(id: string): DietProtocolEntry | undefined {
  return catalogById.get(id);
}

export function isPublishedDietType(id: string): id is PublishedDietType {
  const entry = catalogById.get(id);
  return Boolean(entry?.publishedInGenerator);
}

export function isImportSupportedDietProtocol(id: string): id is PublishedDietType {
  const entry = catalogById.get(id);
  return Boolean(entry?.supportedInImport);
}
