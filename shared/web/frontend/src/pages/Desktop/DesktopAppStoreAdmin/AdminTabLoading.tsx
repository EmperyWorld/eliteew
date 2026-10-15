/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store admin tab loading skeleton (a11y status).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - `documentation/product/desktop/DESKTOP-APP-STORE-ADMIN-INTERFACE-AUDIT-NOTE.md`
 */
import { DesktopAppSkeleton } from '../components/DesktopAppChrome';

export function AdminTabLoading({
	label,
}: {
	label: string;
}): React.ReactElement {
	return (
		<div
			className="flex flex-col gap-2 py-8"
			role="status"
			aria-busy="true"
			aria-label={label}
		>
			<DesktopAppSkeleton className="h-9 w-full" />
			<DesktopAppSkeleton className="h-9 w-4/5" />
			<DesktopAppSkeleton className="h-64 w-full" />
		</div>
	);
}
