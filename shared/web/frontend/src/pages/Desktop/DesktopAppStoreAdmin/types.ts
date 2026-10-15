/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop App Store admin tab ids and page props.
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - `documentation/product/desktop/DESKTOP-APP-STORE-ADMIN-INTERFACE-AUDIT-NOTE.md`
 */

export type CatalogSortField =
	| 'app_id'
	| 'name'
	| 'category'
	| 'is_system'
	| 'is_factory'
	| 'group';

export type DesktopAppStoreAdminTabId =
	| 'catalog'
	| 'groups'
	| 'storefront'
	| 'maintenance';

export interface DesktopAppStoreAdminPageProps {
	/** Встроенный режим: без шапки «Назад», для единой админки */
	embedded?: boolean;
	/** Стартовая вкладка */
	initialTab?: DesktopAppStoreAdminTabId;
}
