/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Logical HTTP bases for native desktop-client (enroll vs app). Wave 1 placeholders only.
 *
 * Invariants:
 * - This stage: both over private path (WG-portal / SG); no open-Internet enroll host.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

export type DesktopClientBases = {
  enrollBase: string;
  appBase: string;
};

/** Defaults match private connected stage (tunnel or SG to app). */
export function getDesktopClientBases(): DesktopClientBases {
  const enroll =
    import.meta.env.VITE_DESKTOP_CLIENT_ENROLL_BASE?.trim() ||
    "https://app.eliteew.ru";
  const app =
    import.meta.env.VITE_DESKTOP_CLIENT_APP_BASE?.trim() || enroll;
  return { enrollBase: enroll, appBase: app };
}
