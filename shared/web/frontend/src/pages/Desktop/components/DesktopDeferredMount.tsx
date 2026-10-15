/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Additive Suspense gate for Desktop deferred layers so critical shell can commit
 * without downloading widgets, GAF tray, notification details, or tour chrome.
 *
 * Invariants:
 * - Renders nothing until `active`; never remounts siblings.
 * - Fallback is empty so critical wallpaper/icons/taskbar stay the only first paint.
 * - Local errors stay inside this gate; they must not replace `#desktop-main`.
 *
 * Related:
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 * - DesktopWorkspaceCanvas.tsx, TaskbarRightToolbar.tsx
 */

import {
	Component,
	Suspense,
	type ErrorInfo,
	type ReactElement,
	type ReactNode,
} from 'react';
import { log } from '@/utils/logger';

class DesktopDeferredSilentErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };

	static getDerivedStateFromError(): { hasError: boolean } {
		return { hasError: true };
	}

	componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
		log.warn(
			'DesktopDeferredMount',
			`[STEP] desktop_deferred_skip ${error.message}`
		);
	}

	render(): ReactNode {
		if (this.state.hasError) {
			return null;
		}
		return this.props.children;
	}
}

export function DesktopDeferredMount({
	active,
	children,
}: {
	active: boolean;
	children: ReactNode;
}): ReactElement | null {
	if (!active) {
		return null;
	}
	return (
		<DesktopDeferredSilentErrorBoundary>
			<Suspense fallback={null}>{children}</Suspense>
		</DesktopDeferredSilentErrorBoundary>
	);
}
