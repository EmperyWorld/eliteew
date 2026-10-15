/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for desktop window app content — stable public import path.
 *
 * Invariants:
 * - Heavy apps remain lazy-loaded via `desktopWindowAppContent/lazyImports.ts`.
 * - Public API: `getDesktopWindowAppContent`, `DesktopWindowAppCallbacks`.
 *
 * Related:
 * - desktopWindowAppContent/renderDesktopWindowAppContent.tsx
 * - desktopWindowAppContent/mounts.tsx
 * - desktopWindowAppContent/lazyImports.ts
 * - utils/desktopAppRegistry.ts
 */

export type { DesktopWindowAppCallbacks } from './desktopWindowAppContent/types';
export { getDesktopWindowAppContent } from './desktopWindowAppContent/renderDesktopWindowAppContent';
