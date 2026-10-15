/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared field helpers and chrome for MusicForge Config editor tab panels.
 *
 * Invariants:
 * - asRecord / *Field never throw on unknown JSON shapes from admin bundle.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/musicForge/MusicForgeConfigEditor.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type * as React from 'react';
import { adminUiFieldClass } from '../ui';

/** @deprecated Prefer `adminUiFieldClass` directly; kept for existing panel imports. */
export const musicForgeConfigInputClass = adminUiFieldClass;

export { adminUiFieldClass };

export const adminUiMetaClass =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';

export function asRecord(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

export function strField(
	row: Record<string, unknown>,
	key: string,
	fallback = ''
): string {
	const v = row[key];
	return typeof v === 'string' ? v : fallback;
}

export function numField(
	row: Record<string, unknown>,
	key: string,
	fallback = 0
): number {
	const v = row[key];
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function boolField(row: Record<string, unknown>, key: string): boolean {
	return Boolean(row[key]);
}

export function FieldLabel({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return <div className={`mb-1 ${adminUiMetaClass}`}>{children}</div>;
}
