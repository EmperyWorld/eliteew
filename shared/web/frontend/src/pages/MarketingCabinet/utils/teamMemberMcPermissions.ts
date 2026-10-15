/** Права участника: mc_module:* и can_upload_project_vault (согласовано с api/routers/projects.py). */

import { PROJECT_ENABLED_MODULES } from '../constants';

export const PROJECT_VAULT_UPLOAD_PERMISSION = 'can_upload_project_vault';
/** Совпадает с `MC_MODULE_SLUGS_ALLOWED` на сервере — явно «ни одного» модуля из списка проекта. */
export const MC_MODULE_NONE = '__mc_none__';
const MC_PREFIX = 'mc_module:';

/** Навигационные разделы кабинета (тот же префикс mc_module: на сервере). */
export const MC_CABINET_SHELL = {
	overview: 'cabinet_overview',
	companies: 'cabinet_companies',
	projects: 'cabinet_projects',
} as const;

const SHELL_ORDER = [
	MC_CABINET_SHELL.overview,
	MC_CABINET_SHELL.companies,
	MC_CABINET_SHELL.projects,
] as const;

function sortEnabledModules(
	enabledModules: string[] | undefined | null
): string[] {
	const order = new Map(PROJECT_ENABLED_MODULES.map((k, i) => [k, i]));
	return [...new Set(enabledModules ?? [])].sort(
		(a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999)
	);
}

function isShellSlug(s: string): boolean {
	return (SHELL_ORDER as readonly string[]).includes(s);
}

export type TeamAccessDraft = {
	uploadVault: boolean;
	modules: Record<string, boolean>;
	/** Обзор / Компании / Проекты в боковой панели */
	shell: {
		overview: boolean;
		companies: boolean;
		projects: boolean;
	};
};

export function draftFromPermissions(
	permissions: string[],
	enabledModules: string[] | undefined | null
): TeamAccessDraft {
	const enabled = sortEnabledModules(enabledModules);
	const uploadVault = permissions.includes(PROJECT_VAULT_UPLOAD_PERMISSION);
	const mcSlugs = permissions
		.filter((p) => p.startsWith(MC_PREFIX))
		.map((p) => p.slice(MC_PREFIX.length));

	const cabinetSlugs = mcSlugs.filter(isShellSlug);
	const contentSlugs = mcSlugs.filter(
		(s) => s !== MC_MODULE_NONE && !isShellSlug(s)
	);

	let shell: TeamAccessDraft['shell'] = {
		overview: true,
		companies: true,
		projects: true,
	};
	if (cabinetSlugs.length > 0) {
		shell = {
			overview: cabinetSlugs.includes(MC_CABINET_SHELL.overview),
			companies: cabinetSlugs.includes(MC_CABINET_SHELL.companies),
			projects: cabinetSlugs.includes(MC_CABINET_SHELL.projects),
		};
	} else if (contentSlugs.length > 0) {
		// Наследие: только контентные mc_module:* — три раздела навигации включены
	}

	const modules: Record<string, boolean> = {};
	if (enabled.length === 0) {
		return { uploadVault, modules, shell };
	}
	if (mcSlugs.includes(MC_MODULE_NONE)) {
		for (const m of enabled) modules[m] = false;
		return { uploadVault, modules, shell };
	}
	const hasExplicitContent = contentSlugs.length > 0;
	for (const m of enabled) {
		modules[m] = !hasExplicitContent || contentSlugs.includes(m);
	}
	return { uploadVault, modules, shell };
}

/** Сводка доступа для подписи в списке команды (согласовано с draftFromPermissions). */
export type TeamAccessSummaryScope = 'full' | 'none' | 'partial';

export interface TeamAccessSummaryParts {
	scope: TeamAccessSummaryScope;
	/** Для partial — число включённых модулей из списка проекта */
	moduleCount: number;
	uploadVault: boolean;
	shell: TeamAccessDraft['shell'];
}

export function getTeamAccessSummaryParts(
	permissions: string[],
	enabledSlugs: string[] | undefined | null
): TeamAccessSummaryParts {
	const draft = draftFromPermissions(permissions, enabledSlugs);
	const vault = draft.uploadVault;
	const enabled = sortEnabledModules(enabledSlugs);
	const allShell =
		draft.shell.overview && draft.shell.companies && draft.shell.projects;

	if (enabled.length === 0) {
		return {
			scope: allShell ? 'full' : 'partial',
			moduleCount: 0,
			uploadVault: vault,
			shell: draft.shell,
		};
	}

	const mcSlugs = permissions
		.filter((p) => p.startsWith(MC_PREFIX))
		.map((p) => p.slice(MC_PREFIX.length));
	const contentSlugs = mcSlugs.filter(
		(s) => s !== MC_MODULE_NONE && !isShellSlug(s)
	);

	if (mcSlugs.includes(MC_MODULE_NONE)) {
		const anySection =
			draft.shell.overview || draft.shell.companies || draft.shell.projects;
		return {
			scope: anySection ? 'partial' : 'none',
			moduleCount: 0,
			uploadVault: vault,
			shell: draft.shell,
		};
	}

	const onCount = enabled.filter((m) => draft.modules[m]).length;
	const hasExplicitContent = contentSlugs.length > 0;
	let scope: TeamAccessSummaryScope;
	if (!hasExplicitContent || onCount === enabled.length) {
		scope = 'full';
	} else if (onCount === 0) {
		scope = 'none';
	} else {
		scope = 'partial';
	}
	if (scope === 'full' && !allShell) {
		scope = 'partial';
	}
	if (
		scope === 'none' &&
		onCount === 0 &&
		(draft.shell.overview || draft.shell.companies || draft.shell.projects)
	) {
		scope = 'partial';
	}

	return {
		scope,
		moduleCount: onCount,
		uploadVault: vault,
		shell: draft.shell,
	};
}

export function normalizePermissionList(
	perms: string[] | null | undefined
): string[] {
	return [
		...new Set((perms ?? []).map((p) => p.trim()).filter(Boolean)),
	].sort();
}

export function arePermissionListsEqual(
	a: string[] | null | undefined,
	b: string[] | null | undefined
): boolean {
	const na = normalizePermissionList(a);
	const nb = normalizePermissionList(b);
	if (na.length !== nb.length) return false;
	return na.every((v, i) => v === nb[i]);
}

export function permissionsFromDraft(
	enabledModules: string[] | undefined | null,
	draft: TeamAccessDraft
): string[] {
	const enabled = sortEnabledModules(enabledModules);
	const out: string[] = [];
	if (draft.uploadVault) out.push(PROJECT_VAULT_UPLOAD_PERMISSION);

	const allShellOn =
		draft.shell.overview && draft.shell.companies && draft.shell.projects;
	const emitShellTokens = !allShellOn;

	const appendShell = () => {
		if (!emitShellTokens) return;
		if (draft.shell.overview) {
			out.push(`${MC_PREFIX}${MC_CABINET_SHELL.overview}`);
		}
		if (draft.shell.companies) {
			out.push(`${MC_PREFIX}${MC_CABINET_SHELL.companies}`);
		}
		if (draft.shell.projects) {
			out.push(`${MC_PREFIX}${MC_CABINET_SHELL.projects}`);
		}
	};

	if (enabled.length === 0) {
		appendShell();
		return out;
	}

	const allModsOn = enabled.every((m) => draft.modules[m]);
	const anyModOn = enabled.some((m) => draft.modules[m]);

	if (allModsOn && allShellOn) {
		return out;
	}

	if (!anyModOn) {
		out.push(`${MC_PREFIX}${MC_MODULE_NONE}`);
		appendShell();
		return out;
	}

	if (!allModsOn) {
		for (const m of enabled) {
			if (draft.modules[m]) out.push(`${MC_PREFIX}${m}`);
		}
	}

	appendShell();
	return out;
}
