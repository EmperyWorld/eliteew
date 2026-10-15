/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for hotspot-driven Visual Studio live preview controls.
 * Implementation lives in `./desktopVisualStudioPreviewInteractive/*` (P37 atomization).
 *
 * Invariants:
 * - All public symbols remain importable from this path (zero consumer changes).
 *
 * Related:
 * - `DesktopVisualStudioPreview.tsx`, `DesktopSettingsVisualStudioSection.tsx`
 * - `documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md`
 */

export type { DesktopVisualStudioPreviewInteractiveProps } from './desktopVisualStudioPreviewInteractive/types';

export { DesktopVisualStudioPreviewInteractive } from './desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive';
