/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact loading state for `#/mobile-*` routes inside native WebView (no full-screen boot overlay).
 *
 * Invariants:
 * - Fills `MobileEmbeddedShell` only; native Android toolbar stays visible above WebView.
 *
 * Related:
 * - MobileEmbeddedShell.tsx, MobileSocialHubPage.tsx, AppRouter.tsx
 */

import { ElitePreloaderPanel } from '@/components/ui/ElitePreloaderPanel';

import {
	MobileEmbeddedShell,
	MobileEmbeddedShellBody,
} from './MobileEmbeddedShell';

export function MobileEmbeddedRouteLoading({
	message = 'Загрузка…',
}: {
	message?: string;
}): React.JSX.Element {
	return (
		<MobileEmbeddedShell>
			<MobileEmbeddedShellBody className="items-center justify-center gap-4 p-6">
				<ElitePreloaderPanel className="relative scale-90" />
				<p className="max-w-xs text-center text-sm text-(--me-text-muted)">
					{message}
				</p>
			</MobileEmbeddedShellBody>
		</MobileEmbeddedShell>
	);
}
