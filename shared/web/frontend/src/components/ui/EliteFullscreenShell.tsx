/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen gradient shell shared by recovery waiting states and branded preloaders.
 *
 * Invariants:
 * - Visual language matches ElitePreloaderPanel glass-card family.
 *
 * Related:
 * - `EliteRecoveryScreen.tsx`
 * - `ElitePreloaderPanel.tsx`
 */

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type EliteFullscreenShellProps = {
	children: ReactNode;
	fullScreen?: boolean;
	className?: string;
	style?: CSSProperties;
	role?: 'status' | 'alert';
	ariaLive?: 'off' | 'polite' | 'assertive';
};

export function EliteFullscreenShell({
	children,
	fullScreen = true,
	className,
	style,
	role = 'status',
	ariaLive = 'polite',
}: EliteFullscreenShellProps): React.JSX.Element {
	return (
		<section
			className={cn(
				'relative isolate flex min-h-full items-center justify-center overflow-hidden p-5 text-white',
				fullScreen && 'min-h-screen',
				className
			)}
			style={style}
			role={role}
			aria-live={ariaLive}
		>
			<div
				className="elite-shell-aura pointer-events-none absolute inset-0"
				aria-hidden
			/>
			<div className="relative z-10 w-full max-w-md">{children}</div>
		</section>
	);
}
