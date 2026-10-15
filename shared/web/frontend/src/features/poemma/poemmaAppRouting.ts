/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 26+: Poemma shell routing catalog, path resolve, and session/role helpers.
 *
 * Invariants:
 * - Team roles do not see owner-only routes (routeAllowedForSession).
 * - Public entry remains PoemmaApp.tsx; this module is shell-internal.
 *
 * Related:
 * - PoemmaApp.tsx, PoemmaRouteBody.tsx
 * - documentation/product/desktop/DESKTOP-API-AND-APPS.md (§ Poemma)
 */
import type { User } from '@/services';
import type { PoemmaDecisionBranchId } from './guide/poemmaDecisionFlow';
import { parsePoemmaGuideBranchParam } from './guide/poemmaDecisionFlow';
import { POEMMA_EXPORT_SOON } from './poemmaUserChromeCopy';
import type { PoemmaUserRole, PoemmaVerdict } from './poemmaDomain';

export type PoemmaRoute =
	| '/'
	| '/onboarding'
	| '/strategy'
	| '/goal'
	| '/segments'
	| '/finance'
	| '/happiness'
	| '/customer-path'
	| '/ideas'
	| '/ideas/:id'
	| '/promo'
	| '/promo/actions/:id'
	| '/promo/utm'
	| '/team'
	| '/period-close'
	| '/guide'
	| '/settings'
	| '/export';

export type PoemmaSession = {
	role: PoemmaUserRole;
	displayName: string;
	roleLabel: string;
};

export type PoemmaPage = {
	path: PoemmaRoute;
	title: string;
	shortTitle: string;
	ownerOnly?: boolean;
	note: string;
};

export const DEV_POEMMA_ROLE_PRESETS: PoemmaSession[] = [
	{
		role: 'owner',
		displayName: 'Собственник',
		roleLabel: 'Собственник',
	},
	{
		role: 'team',
		displayName: 'Команда',
		roleLabel: 'Команда',
	},
	{
		role: 'manager',
		displayName: 'Менеджер',
		roleLabel: 'Менеджер',
	},
];

export const POEMMA_PAGES: PoemmaPage[] = [
	{
		path: '/',
		title: 'Карта бизнеса',
		shortTitle: 'Главная',
		note: '',
	},
	{
		path: '/onboarding',
		title: 'Честная карта бизнеса',
		shortTitle: 'Старт',
		note: '',
	},
	{
		path: '/strategy',
		title: 'Видение и смысл',
		shortTitle: 'Смысл',
		note: '',
	},
	{
		path: '/goal',
		title: 'Цель 90 дней',
		shortTitle: 'Цель',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/segments',
		title: 'Кто покупает',
		shortTitle: 'Кто покупает',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/finance',
		title: 'Цифры',
		shortTitle: 'Цифры',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/happiness',
		title: 'Опыт',
		shortTitle: 'Опыт',
		note: '',
	},
	{
		path: '/customer-path',
		title: 'Путь клиента',
		shortTitle: 'Путь',
		note: '',
	},
	{
		path: '/ideas',
		title: 'Идеи',
		shortTitle: 'Идеи',
		note: '',
	},
	{
		path: '/ideas/:id',
		title: 'Идея',
		shortTitle: 'Идея',
		note: '',
	},
	{
		path: '/promo',
		title: 'Каналы',
		shortTitle: 'Каналы',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/promo/actions/:id',
		title: 'Акция',
		shortTitle: 'Акция',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/promo/utm',
		title: 'Ссылки',
		shortTitle: 'Ссылки',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/team',
		title: 'Команда',
		shortTitle: 'Задачи',
		note: '',
	},
	{
		path: '/period-close',
		title: 'Итоги 90 дней',
		shortTitle: 'Итоги',
		ownerOnly: true,
		note: '',
	},
	{
		path: '/guide',
		title: 'Что делать',
		shortTitle: 'Что делать',
		note: '',
	},
	{
		path: '/settings',
		title: 'Настройки',
		shortTitle: 'Настройки',
		note: '',
	},
	{
		path: '/export',
		title: 'Форматы печати',
		shortTitle: 'Печать',
		ownerOnly: true,
		note: POEMMA_EXPORT_SOON.description,
	},
];

export const OWNER_NAV: PoemmaRoute[] = [
	'/',
	'/strategy',
	'/finance',
	'/ideas',
];
export const OWNER_MORE_NAV: PoemmaRoute[] = [
	'/customer-path',
	'/promo',
	'/team',
	'/period-close',
	'/settings',
	'/goal',
	'/segments',
	'/happiness',
	'/guide',
];
export const TEAM_NAV: PoemmaRoute[] = ['/', '/team', '/happiness'];
export const TEAM_MORE_NAV: PoemmaRoute[] = [
	'/customer-path',
	'/ideas',
	'/settings',
];

export type PoemmaResolvedRoute = {
	template: PoemmaRoute;
	ideaId?: string;
	ideaDecision?: PoemmaVerdict;
	promotionId?: string;
	guideBranch?: PoemmaDecisionBranchId;
	strategyView?: 'main' | 'utp';
};

function parsePoemmaDecisionHint(
	value: string | null
): PoemmaVerdict | undefined {
	if (value === 'go' || value === 'iterate' || value === 'stop') {
		return value;
	}
	return undefined;
}

function splitPoemmaPath(rawPath: string): {
	pathname: string;
	queryParams: URLSearchParams;
	hash: string;
} {
	const trimmed = rawPath.trim();
	const [beforeHash, rawHash = ''] = trimmed.split('#', 2);
	const [rawPathname = '', rawQuery = ''] = beforeHash.split('?', 2);
	const normalizedPathname = rawPathname
		? rawPathname.startsWith('/')
			? rawPathname
			: `/${rawPathname}`
		: '/';
	return {
		pathname: normalizedPathname,
		queryParams: new URLSearchParams(rawQuery),
		hash: rawHash.trim().toLowerCase(),
	};
}

export function resolvePoemmaRoute(path: string): PoemmaResolvedRoute {
	const { pathname, queryParams, hash } = splitPoemmaPath(path);

	const ideaMatch = /^\/ideas\/([^/]+)$/.exec(pathname);
	if (ideaMatch?.[1]) {
		return {
			template: '/ideas/:id',
			ideaId: ideaMatch[1],
			ideaDecision: parsePoemmaDecisionHint(queryParams.get('decision')),
		};
	}

	const promoActionMatch = /^\/promo\/actions\/([^/]+)$/.exec(pathname);
	if (promoActionMatch?.[1]) {
		return {
			template: '/promo/actions/:id',
			promotionId: promoActionMatch[1],
		};
	}

	if (pathname === '/promo/utm') {
		const promotionFromQuery = queryParams.get('promotion')?.trim();
		return {
			template: '/promo/utm',
			promotionId: promotionFromQuery || undefined,
		};
	}

	if (pathname === '/guide') {
		return {
			template: '/guide',
			guideBranch: parsePoemmaGuideBranchParam(queryParams.get('branch')),
		};
	}

	if (pathname === '/strategy') {
		const strategyView = queryParams.get('view')?.trim().toLowerCase();
		return {
			template: '/strategy',
			strategyView: strategyView === 'utp' || hash === 'utp' ? 'utp' : 'main',
		};
	}

	const template = POEMMA_PAGES.some((page) => page.path === pathname)
		? (pathname as PoemmaRoute)
		: '/';
	return { template };
}

export function findPoemmaPage(template: PoemmaRoute): PoemmaPage {
	return POEMMA_PAGES.find((page) => page.path === template) ?? POEMMA_PAGES[0];
}

export function isPoemmaNavPathActive(
	navPath: PoemmaRoute,
	currentPath: string,
	template: PoemmaRoute
): boolean {
	if (navPath === '/ideas') {
		return template === '/ideas' || template === '/ideas/:id';
	}
	if (navPath === '/promo') {
		return (
			template === '/promo' ||
			template === '/promo/actions/:id' ||
			template === '/promo/utm'
		);
	}
	return currentPath === navPath;
}

export function resolvePoemmaErrorMessage(error: unknown): string {
	if (!error || typeof error !== 'object') {
		return 'Сервис временно недоступен. Повторите ещё раз.';
	}
	const responseData = (
		error as { response?: { data?: { detail?: unknown; error?: unknown } } }
	).response?.data;
	if (
		typeof responseData?.detail === 'string' &&
		responseData.detail.trim().length > 0
	) {
		return responseData.detail.trim();
	}
	if (
		typeof responseData?.error === 'string' &&
		responseData.error.trim().length > 0
	) {
		return responseData.error.trim();
	}
	const message = (error as { message?: unknown }).message;
	if (typeof message === 'string' && message.trim().length > 0) {
		return message.trim();
	}
	return 'Сервис временно недоступен. Повторите ещё раз.';
}

function resolvePoemmaDisplayName(input: {
	displayName?: string;
	username: string;
	email: string;
}): string {
	const fromProfile = input.displayName?.trim();
	if (fromProfile) {
		return fromProfile;
	}
	const fromUsername = input.username?.trim();
	if (fromUsername) {
		return fromUsername;
	}
	return input.email.split('@')[0] || 'Пользователь';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parsePoemmaRoleCandidate(value: unknown): PoemmaUserRole | null {
	if (typeof value !== 'string') {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	switch (normalized) {
		case 'owner':
		case 'team':
		case 'manager':
		case 'smm':
		case 'production':
			return normalized;
		default:
			return null;
	}
}

function resolvePoemmaRoleFromPreferences(
	preferences: Record<string, unknown> | undefined
): PoemmaUserRole | null {
	if (!preferences) {
		return null;
	}
	const nestedPoemma = isRecord(preferences.poemma)
		? parsePoemmaRoleCandidate(preferences.poemma.role)
		: null;
	return (
		nestedPoemma ??
		parsePoemmaRoleCandidate(preferences.poemma_role) ??
		parsePoemmaRoleCandidate(preferences.poemmaRole) ??
		parsePoemmaRoleCandidate(preferences.poemmaUserRole)
	);
}

function resolvePoemmaRoleFromPermissions(
	permissions: string[] | undefined
): PoemmaUserRole | null {
	if (!permissions?.length) {
		return null;
	}
	const normalizedPermissions = new Set(
		permissions.map((permission) => permission.trim().toLowerCase())
	);
	if (normalizedPermissions.has('poemma:owner')) {
		return 'owner';
	}
	if (normalizedPermissions.has('poemma:manager')) {
		return 'manager';
	}
	if (normalizedPermissions.has('poemma:team')) {
		return 'team';
	}
	if (normalizedPermissions.has('poemma:smm')) {
		return 'smm';
	}
	if (normalizedPermissions.has('poemma:production')) {
		return 'production';
	}
	return null;
}

export function poemmaRoleLabel(role: PoemmaUserRole): string {
	switch (role) {
		case 'owner':
			return 'Собственник';
		case 'team':
			return 'Команда';
		case 'manager':
			return 'Менеджер';
		case 'smm':
			return 'Маркетинг';
		case 'production':
			return 'Производство';
		default:
			return 'Команда';
	}
}

export function resolvePoemmaSession(user: User): PoemmaSession {
	const profilePreferences = isRecord(user.profile?.preferences)
		? user.profile.preferences
		: undefined;
	const roleFromPreferences =
		resolvePoemmaRoleFromPreferences(profilePreferences);
	const roleFromPermissions = resolvePoemmaRoleFromPermissions(
		user.permissions
	);
	const roleFromPlatform =
		user.role === 'admin' || user.role === 'emperyworld_admin'
			? 'owner'
			: user.role === 'ai_agent'
				? 'manager'
				: 'team';
	const role = roleFromPreferences ?? roleFromPermissions ?? roleFromPlatform;
	return {
		role,
		displayName: resolvePoemmaDisplayName({
			displayName: user.profile?.display_name,
			username: user.username,
			email: user.email,
		}),
		roleLabel: poemmaRoleLabel(role),
	};
}

export function routeAllowedForSession(
	page: PoemmaPage,
	session: PoemmaSession
): boolean {
	return !page.ownerOnly || session.role === 'owner';
}
