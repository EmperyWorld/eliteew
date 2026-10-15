/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public barrel for Desktop App Store admin — re-exports only; implementation in DesktopAppStoreAdmin/*.
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - `documentation/product/desktop/DESKTOP-APP-STORE-ADMIN-INTERFACE-AUDIT-NOTE.md`
 */
export { AdminTabLoading } from './DesktopAppStoreAdmin/AdminTabLoading';
export { DesktopAppStoreAdminPage } from './DesktopAppStoreAdmin/DesktopAppStoreAdminPage';
export type {
	DesktopAppStoreAdminPageProps,
	DesktopAppStoreAdminTabId,
} from './DesktopAppStoreAdmin/types';
