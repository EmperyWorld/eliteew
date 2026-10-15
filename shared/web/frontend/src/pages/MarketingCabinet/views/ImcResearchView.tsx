/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy-import facade for Marketing Cabinet IMC Research view;
 * implementation lives under views/imcResearch/.
 *
 * Invariants:
 * - Named export `ImcResearchView` preserved for marketingCabinetPageLazyImports:
 *   import('.../views/ImcResearchView').then(m => ({ default: m.ImcResearchView }))
 *
 * Related:
 * - imcResearch/ImcResearchView.tsx
 * - marketingCabinetPage/marketingCabinetPageLazyImports.ts
 */

export { ImcResearchView } from '@/pages/MarketingCabinet/views/imcResearch/ImcResearchView';
export type { ImcResearchViewProps } from '@/pages/MarketingCabinet/views/imcResearch/imcResearchTypes';
