import { describe, expect, it } from 'vitest';
import {
	MC_CABINET_SHELL,
	MC_MODULE_NONE,
	PROJECT_VAULT_UPLOAD_PERMISSION,
	arePermissionListsEqual,
	draftFromPermissions,
	getTeamAccessSummaryParts,
	normalizePermissionList,
	permissionsFromDraft,
	type TeamAccessDraft,
} from '../utils/teamMemberMcPermissions';

const MOD_A = 'jtbd';
const MOD_B = 'swot';

describe('draftFromPermissions', () => {
	it('with no mc_module:* grants all enabled modules and default full shell', () => {
		const d = draftFromPermissions([], [MOD_A, MOD_B]);
		expect(d.uploadVault).toBe(false);
		expect(d.modules[MOD_A]).toBe(true);
		expect(d.modules[MOD_B]).toBe(true);
		expect(d.shell).toEqual({
			overview: true,
			companies: true,
			projects: true,
		});
	});

	it('sets uploadVault from can_upload_project_vault', () => {
		const d = draftFromPermissions([PROJECT_VAULT_UPLOAD_PERMISSION], [MOD_A]);
		expect(d.uploadVault).toBe(true);
		expect(d.modules[MOD_A]).toBe(true);
	});

	it('mc_module:__mc_none__ turns off every listed module', () => {
		const d = draftFromPermissions(
			[`mc_module:${MC_MODULE_NONE}`],
			[MOD_A, MOD_B]
		);
		expect(d.modules[MOD_A]).toBe(false);
		expect(d.modules[MOD_B]).toBe(false);
	});

	it('legacy: only content mc_module:* keeps shell navigation fully on', () => {
		const d = draftFromPermissions([`mc_module:${MOD_A}`], [MOD_A, MOD_B]);
		expect(d.shell.overview && d.shell.companies && d.shell.projects).toBe(
			true
		);
		expect(d.modules[MOD_A]).toBe(true);
		expect(d.modules[MOD_B]).toBe(false);
	});

	it('explicit cabinet shell slugs restrict shell flags', () => {
		const d = draftFromPermissions(
			[`mc_module:${MC_CABINET_SHELL.overview}`],
			[MOD_A]
		);
		expect(d.shell).toEqual({
			overview: true,
			companies: false,
			projects: false,
		});
		expect(d.modules[MOD_A]).toBe(true);
	});

	it('dedupes and sorts enabled modules by PROJECT_ENABLED_MODULES order', () => {
		const d = draftFromPermissions([], ['swot', 'jtbd', 'jtbd']);
		expect(Object.keys(d.modules).sort()).toEqual([MOD_A, MOD_B]);
	});
});

describe('getTeamAccessSummaryParts', () => {
	it('full scope when all modules on and shell complete', () => {
		const p = getTeamAccessSummaryParts([], [MOD_A, MOD_B]);
		expect(p.scope).toBe('full');
		expect(p.moduleCount).toBe(2);
		expect(p.uploadVault).toBe(false);
	});

	it('partial when only one explicit content module is granted', () => {
		const p = getTeamAccessSummaryParts([`mc_module:${MOD_A}`], [MOD_A, MOD_B]);
		expect(p.scope).toBe('partial');
		expect(p.moduleCount).toBe(1);
	});

	it('full when every enabled module has explicit mc_module:*', () => {
		const p = getTeamAccessSummaryParts(
			[`mc_module:${MOD_A}`, `mc_module:${MOD_B}`],
			[MOD_A, MOD_B]
		);
		expect(p.scope).toBe('full');
		expect(p.moduleCount).toBe(2);
	});

	it('__mc_none__ yields partial if any shell section remains', () => {
		const p = getTeamAccessSummaryParts(
			[`mc_module:${MC_MODULE_NONE}`, `mc_module:${MC_CABINET_SHELL.projects}`],
			[MOD_A]
		);
		expect(p.scope).toBe('partial');
		expect(p.moduleCount).toBe(0);
	});
});

describe('normalizePermissionList & arePermissionListsEqual', () => {
	it('trims, dedupes, sorts', () => {
		expect(normalizePermissionList([' b ', 'a', 'a'])).toEqual(['a', 'b']);
		expect(normalizePermissionList(null)).toEqual([]);
	});

	it('compares normalized lists (dedupes duplicates)', () => {
		expect(arePermissionListsEqual(['x', 'y'], ['y', 'x'])).toBe(true);
		expect(arePermissionListsEqual(['x'], ['x', 'x'])).toBe(true);
		expect(arePermissionListsEqual(undefined, null)).toBe(true);
	});
});

describe('permissionsFromDraft', () => {
	const fullShell: TeamAccessDraft['shell'] = {
		overview: true,
		companies: true,
		projects: true,
	};

	it('all modules on and full shell with no vault yields empty list', () => {
		const draft: TeamAccessDraft = {
			uploadVault: false,
			modules: { [MOD_A]: true, [MOD_B]: true },
			shell: fullShell,
		};
		expect(permissionsFromDraft([MOD_A, MOD_B], draft)).toEqual([]);
	});

	it('adds vault permission when draft says so', () => {
		const draft: TeamAccessDraft = {
			uploadVault: true,
			modules: { [MOD_A]: true, [MOD_B]: true },
			shell: fullShell,
		};
		expect(permissionsFromDraft([MOD_A, MOD_B], draft)).toEqual([
			PROJECT_VAULT_UPLOAD_PERMISSION,
		]);
	});

	it('emits __mc_none__ and partial shell tokens when all modules off', () => {
		const draft: TeamAccessDraft = {
			uploadVault: false,
			modules: { [MOD_A]: false, [MOD_B]: false },
			shell: { ...fullShell, overview: false },
		};
		const perms = permissionsFromDraft([MOD_A, MOD_B], draft);
		expect(perms).toContain(`mc_module:${MC_MODULE_NONE}`);
		expect(perms).toContain(`mc_module:${MC_CABINET_SHELL.companies}`);
		expect(perms).toContain(`mc_module:${MC_CABINET_SHELL.projects}`);
		expect(perms).not.toContain(`mc_module:${MC_CABINET_SHELL.overview}`);
	});

	it('emits explicit mc_module:* for subset when mixed', () => {
		const draft: TeamAccessDraft = {
			uploadVault: false,
			modules: { [MOD_A]: true, [MOD_B]: false },
			shell: fullShell,
		};
		const perms = permissionsFromDraft([MOD_A, MOD_B], draft);
		expect(perms).toEqual([`mc_module:${MOD_A}`]);
	});

	it('round-trips explicit single-module grant', () => {
		const enabled = [MOD_A, MOD_B];
		const original = [`mc_module:${MOD_A}`];
		const draft = draftFromPermissions(original, enabled);
		const back = permissionsFromDraft(enabled, draft);
		expect(arePermissionListsEqual(original, back)).toBe(true);
	});
});
