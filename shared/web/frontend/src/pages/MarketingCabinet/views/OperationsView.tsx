/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy-import facade for Marketing Cabinet Operations view;
 * implementation lives under views/operations/.
 *
 * Invariants:
 * - Named export `OperationsView` preserved for marketingCabinetPageLazyImports:
 *   import('.../views/OperationsView').then(m => ({ default: m.OperationsView }))
 *
 * Related:
 * - operations/OperationsView.tsx
 * - marketingCabinetPage/marketingCabinetPageLazyImports.ts
 */

export { OperationsView } from '@/pages/MarketingCabinet/views/operations/OperationsView';
export type { OperationsViewProps } from '@/pages/MarketingCabinet/views/operations/operationsTypes';
