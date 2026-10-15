/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Match catalog `module_key` values to vertical assignment rows (legacy hyphen vs underscore drift).
 *
 * Invariants:
 * - Comparison normalizes only for equality checks; API calls use the catalog key from the row.
 * - `is_enabled` coercion accepts boolean JSON and legacy string forms from intermediaries.
 *
 * Related:
 * - tabs/ModulesTab.tsx
 * - ProfessionalWorldsAdminSection.tsx
 */

import type {
	ProfessionalVerticalModule,
	ProfessionalWorldsAdminSnapshot,
} from './types';

/** Normalize module keys for comparison (not for URL paths). */
export function normalizeModuleKeyForMatch(value: string): string {
	return value.trim().toLowerCase().replace(/_/g, '-');
}

export function moduleKeysMatch(left: string, right: string): boolean {
	const a = normalizeModuleKeyForMatch(left);
	const b = normalizeModuleKeyForMatch(right);
	return a.length > 0 && a === b;
}

export function coerceAssignmentEnabled(value: unknown): boolean {
	if (value === true || value === 1) {
		return true;
	}
	if (value === false || value === 0 || value === null || value === undefined) {
		return false;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		return (
			normalized === 'true' ||
			normalized === 't' ||
			normalized === '1' ||
			normalized === 'yes'
		);
	}
	return Boolean(value);
}

export function findVerticalModuleAssignment(
	assignments: readonly ProfessionalVerticalModule[],
	moduleKey: string
): ProfessionalVerticalModule | undefined {
	return assignments.find((item) =>
		moduleKeysMatch(item.module_key, moduleKey)
	);
}

export function isModuleEnabledForVertical(
	assignments: readonly ProfessionalVerticalModule[],
	moduleKey: string
): boolean {
	const row = findVerticalModuleAssignment(assignments, moduleKey);
	return row ? coerceAssignmentEnabled(row.is_enabled) : false;
}

export function upsertAssignmentInSnapshot(
	snapshot: ProfessionalWorldsAdminSnapshot,
	assignment: ProfessionalVerticalModule
): ProfessionalWorldsAdminSnapshot {
	const assignments = [...snapshot.assignments];
	const index = assignments.findIndex((item) =>
		moduleKeysMatch(item.module_key, assignment.module_key)
	);
	if (index >= 0) {
		assignments[index] = assignment;
	} else {
		assignments.push(assignment);
	}
	return { ...snapshot, assignments };
}

export function setAssignmentEnabledInSnapshot(
	snapshot: ProfessionalWorldsAdminSnapshot,
	moduleKey: string,
	enabled: boolean
): ProfessionalWorldsAdminSnapshot {
	const assignments = snapshot.assignments.map((item) =>
		moduleKeysMatch(item.module_key, moduleKey)
			? { ...item, is_enabled: enabled }
			: item
	);
	return { ...snapshot, assignments };
}
