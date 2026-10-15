/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy-import facade for Marketing Cabinet OverviewView; implementation lives in overview/.
 *
 * Invariants:
 * - Named export `OverviewView` preserved for marketingCabinetPageLazyImports lazy path:
 *   import(.../views/OverviewView).then(m => ({ default: m.OverviewView }))
 *
 * Related:
 * - overview/OverviewView.tsx
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

export { OverviewView } from '@/pages/MarketingCabinet/views/overview/OverviewView';
export type { OverviewViewProps } from '@/pages/MarketingCabinet/views/overview/overviewViewTypes';
