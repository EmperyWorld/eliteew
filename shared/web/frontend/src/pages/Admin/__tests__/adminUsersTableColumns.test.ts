/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin users table column visibility helpers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ADMIN_USERS_TOGGLEABLE_COLUMN_IDS,
	ADMIN_USERS_TABLE_COLUMN_LABELS,
	ADMIN_USERS_TABLE_COLUMNS_KEY,
	COMPACT_ADMIN_USERS_TABLE_COLUMNS,
	countVisibleTableColumns,
	DEFAULT_ADMIN_USERS_TABLE_COLUMNS,
	loadAdminUsersTableColumns,
	normalizeAdminUsersTableColumns,
	tableColumnsEqual,
	toggleAdminUsersTableColumn,
} from '../adminUsersTableColumns';

function createMemoryStorage(): Storage {
	let store: Record<string, string> = {};
	return {
		get length() {
			return Object.keys(store).length;
		},
		clear() {
			store = {};
		},
		getItem(key: string) {
			return store[key] ?? null;
		},
		setItem(key: string, value: string) {
			store[key] = String(value);
		},
		removeItem(key: string) {
			delete store[key];
		},
		key(index: number) {
			return Object.keys(store)[index] ?? null;
		},
	};
}

describe('adminUsersTableColumns', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('counts full preset columns', () => {
		expect(countVisibleTableColumns(DEFAULT_ADMIN_USERS_TABLE_COLUMNS)).toBe(
			11
		);
	});

	it('counts compact preset columns', () => {
		expect(countVisibleTableColumns(COMPACT_ADMIN_USERS_TABLE_COLUMNS)).toBe(6);
	});

	it('normalizes partial storage', () => {
		const cols = normalizeAdminUsersTableColumns({ email: false });
		expect(cols.email).toBe(false);
		expect(cols.created_at).toBe(true);
	});

	it('toggles a single column', () => {
		const next = toggleAdminUsersTableColumn(
			DEFAULT_ADMIN_USERS_TABLE_COLUMNS,
			'email'
		);
		expect(next.email).toBe(false);
	});

	it('toggleable column ids match labels map (filters panel)', () => {
		expect(ADMIN_USERS_TOGGLEABLE_COLUMN_IDS.length).toBe(6);
		for (const id of ADMIN_USERS_TOGGLEABLE_COLUMN_IDS) {
			expect(ADMIN_USERS_TABLE_COLUMN_LABELS[id]).toBeTruthy();
		}
	});

	it('loads compact preset when storage is empty', () => {
		localStorage.removeItem(ADMIN_USERS_TABLE_COLUMNS_KEY);
		expect(
			tableColumnsEqual(
				loadAdminUsersTableColumns(),
				COMPACT_ADMIN_USERS_TABLE_COLUMNS
			)
		).toBe(true);
	});
});
