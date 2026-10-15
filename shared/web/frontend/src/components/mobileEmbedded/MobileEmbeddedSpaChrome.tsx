/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional SPA top chrome for `#/mobile-*` when native toolbar is unavailable.
 *
 * Invariants:
 * - Hidden by default; native Android toolbar is canonical for close/title.
 *
 * Related:
 * - utils/mobileEmbeddedNativeBridge.ts, MobileEmbeddedShell.tsx, mobileEmbeddedTheme.css
 */

import { ChevronLeftIcon } from '@heroicons/react/24/outline';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { closeMobileEmbeddedSpa } from '@/utils/mobileEmbeddedNativeBridge';
import { cn } from '@/utils/cn';

/** Fallback header — enable with `showSpaChrome` when testing outside native host. */
export function MobileEmbeddedSpaChrome({
	title,
	showSpaChrome = false,
}: {
	title: string;
	showSpaChrome?: boolean;
}): React.JSX.Element | null {
	if (!isEmbeddedEliteEWClient() || !showSpaChrome) {
		return null;
	}

	return (
		<header
			className={cn(
				'flex shrink-0 items-center gap-2.5 border-b border-(--me-border-faint)',
				'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--me-surface)_98%,transparent)_0%,var(--me-bg)_100%)]',
				'px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]'
			)}
			data-mobile-embedded-chrome="1"
		>
			<button
				type="button"
				className={cn(
					'inline-flex min-h-11 items-center gap-0.5 rounded-[14px] border border-(--me-border-subtle) px-3 py-2 text-sm font-semibold',
					'text-(--me-accent) active:bg-white/5',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => closeMobileEmbeddedSpa()}
				aria-label="Вернуться в приложение"
			>
				<ChevronLeftIcon aria-hidden className="h-5 w-5" strokeWidth={2} />
				<span>Назад</span>
			</button>
			<h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-(--me-text-primary)">
				{title}
			</h1>
		</header>
	);
}
