/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Re-exports AMKA view helpers from the feature layer so legacy `views/*` imports stay stable.
 *
 * Invariants:
 * - No logic here; canonical implementation is `src/features/amka/amkaViewUtils.ts`.
 *
 * Related:
 * - src/features/amka/amkaViewUtils.ts
 */
export * from '@/features/amka/amkaViewUtils';
