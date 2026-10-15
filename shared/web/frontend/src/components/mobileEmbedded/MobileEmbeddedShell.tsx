/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind shell for MobileAndroid embedded SPA routes (`#/mobile-*`).
 *
 * Invariants:
 * - Native `EmperyMobileEmbeddedSpaWebViewActivity` toolbar provides close + title.
 * - SPA chrome header stays hidden unless explicitly enabled later.
 *
 * Related:
 * - mobileEmbeddedLayoutTokens.ts, pages/MobileSocialHub/MobileSocialHubPage.tsx
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import {
	MOBILE_EMBEDDED_BODY_CLASS,
	MOBILE_EMBEDDED_SHELL_CLASS,
} from './mobileEmbeddedLayoutTokens';
import './mobileEmbeddedTheme.css';

export function MobileEmbeddedShell({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}): React.JSX.Element {
	return (
		<div
			className={cn(MOBILE_EMBEDDED_SHELL_CLASS, className)}
			data-embedded="1"
			data-mobile-embedded-shell="1"
		>
			{children}
		</div>
	);
}

export function MobileEmbeddedShellBody({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}): React.JSX.Element {
	return (
		<div className={cn(MOBILE_EMBEDDED_BODY_CLASS, className)}>{children}</div>
	);
}
