/**
 * Hash-маршрутизация shell: `currentPage`/`ShellPageType`, алиасы, OAuth hash, desktop-only coercion (`navigateDesktopShell`).
 * Вложенные React Router маршруты (например admin в site-studio) — отдельные деревья; не дублировать правила здесь без согласования.
 * См. `documentation/product/FRONTEND-DEVELOPER-ENTRY.md`.
 */
import {
	INTENDED_PAGE_SESSION_KEY,
	LAST_VISITED_PAGE_LOCAL_KEY,
} from '../constants/storageKeys';
import { SYSTEM_FULL_PAGE_ROUTES } from '../pages/Desktop/utils/desktopOnlyLegacyRoutes';
import {
	coercePageToDesktopShell,
	replaceHashWithDesktop,
} from '../pages/Desktop/utils/desktopOnlyNavigation';

const VALID_PAGES = new Set([
	'desktop',
	'dashboard',
	'elite-dashboard-v3',
	'creative-studio',
	'ai-hub',
	'ai-business',
	'business-intelligence',
	'agents',
	'simple-chat',
	'document-editor',
	'presentations',
	'presentations-archive',
	'ewrp',
	'unified-content',
	'configuration',
	'user-profile',
	'ugs',
	'ugs-hub',
	'ugs-admin',
	'ugs-analytics',
	'voice-center-settings',
	'voice-radio',
	'content-stats',
	'content-filters',
	'content-grid',
	'content-list',
	'desktop/store',
	'desktop-admin',
	'admin',
	'login',
	'mobile-app-download',
	'mobile-ewa-companion',
	'mobile-handbook',
	'mobile-social-hub',
	'mobile-feedback-hub',
	'mobile-notifications',
	'mobile-content-manager',
	'mobile-ewdesk',
	'mobile-professional-worlds',
	'mobile-app-store',
	'mobile-desktop-settings',
	'empery-nexus',
	'voice-studio',
	'video-studio',
	'live-voice',
	'audio-transcription',
]) as Set<string>;

const PAGE_ALIASES: Record<string, string> = {
	'empery-nexus-chronicle': 'empery-nexus',
	'elite-chat': 'desktop',
	'elite-chat-v3': 'desktop',
	'elite-chat-v4': 'desktop',
	'presentation-generator': 'ewrp',
	presentations: 'ewrp',
	'presentations-archive': 'ewrp',
	'document-workflow': 'document-editor',
	'elite-document-editor': 'document-editor',
	'ai-editor': 'document-editor',
	'table-editor': 'document-editor',
	'professional-editor': 'document-editor',
	'unified-editor': 'document-editor',
	'ultimate-doc-editor': 'document-editor',
	/** Old folder / recent-files links used #/content — map to real route if hash is opened outside desktop handler */
	content: 'unified-content',
};

export const DEFAULT_PAGE = 'desktop';

export const isOAuthCallbackHash = (
	value: string | null | undefined
): boolean => {
	const normalized = (value ?? '').replace(/^#/, '');
	const parts =
		normalized
			.split('?')[0]
			?.split('&')
			.map((part) => part.trim())
			.filter(Boolean) ?? [];
	const firstPart = parts[0] ?? '';
	const firstPartIsOAuthParam = /^(state|code|session_state|iss)=/.test(
		firstPart
	);
	return (
		firstPartIsOAuthParam ||
		normalized.includes('?code=') ||
		normalized.includes('?state=')
	);
};

export const normalizePageCandidate = (
	value: string | null | undefined
): string | null => {
	if (!value) return null;

	const cleaned = value.replace(/^#/, '').split('?')[0]?.trim();
	if (!cleaned) {
		return null;
	}

	const hashParts = cleaned
		.split('&')
		.map((part) => part.trim())
		.filter(Boolean);
	/** Поддержка ссылок вида `#/desktop` (ведущий слэш после `#`). */
	const candidate = (hashParts[0] ?? '').replace(/^\/+/, '');
	if (!candidate || isOAuthCallbackHash(candidate)) {
		return null;
	}

	if (candidate.startsWith('desktop/store')) {
		return 'desktop/store';
	}

	const normalized = PAGE_ALIASES[candidate] ?? candidate;
	return VALID_PAGES.has(normalized) ? normalized : null;
};

/**
 * Канонический id shell-страницы из `location.hash` для `INTENDED_PAGE_SESSION_KEY`.
 * `null` — пустой hash или OAuth-фрагмент.
 */
export function getShellPageIdForIntendedStorage(): string | null {
	if (typeof window === 'undefined') return null;
	return normalizePageCandidate(window.location.hash);
}

/**
 * Параметр `return` в hash (например `#/login?return=desktop`): целевая shell-страница для «назад».
 * Только страницы из {@link VALID_PAGES}; иначе `null`.
 */
export function getShellReturnPageFromHash(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const raw = window.location.hash.replace(/^#/, '').trim();
	const qIdx = raw.indexOf('?');
	if (qIdx < 0) {
		return null;
	}
	const qs = raw.slice(qIdx + 1);
	const ret = new URLSearchParams(qs).get('return')?.trim();
	if (!ret) {
		return null;
	}
	return (
		normalizePageCandidate(`#${ret}`) ?? normalizePageCandidate(ret) ?? null
	);
}

export const readStoredPreferredPage = (): string | null => {
	try {
		const intendedPage = normalizePageCandidate(
			sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)
		);
		if (intendedPage) {
			return intendedPage;
		}
	} catch {
		// ignore storage failures
	}

	try {
		return normalizePageCandidate(
			localStorage.getItem(LAST_VISITED_PAGE_LOCAL_KEY)
		);
	} catch {
		return null;
	}
};

export const consumeIntendedPage = (): string | null => {
	try {
		const intendedPage = normalizePageCandidate(
			sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)
		);
		if (intendedPage) {
			sessionStorage.removeItem(INTENDED_PAGE_SESSION_KEY);
		}
		return intendedPage;
	} catch {
		return null;
	}
};

/**
 * Programmatic navigation: coerce legacy full-page routes to desktop shell + pending window.
 */
export function applyNavigationCoercion(requestedPage: string): string {
	const rawHash =
		typeof window !== 'undefined'
			? window.location.hash.replace(/^#/, '').trim()
			: '';
	const { page, pending } = coercePageToDesktopShell(
		requestedPage,
		rawHash || requestedPage
	);
	if (pending) {
		replaceHashWithDesktop();
		return page;
	}
	if (page === 'desktop' && rawHash) {
		const hashPage = normalizePageCandidate(`#${rawHash}`);
		if (
			hashPage &&
			hashPage !== 'desktop' &&
			!SYSTEM_FULL_PAGE_ROUTES.has(hashPage)
		) {
			replaceHashWithDesktop();
		}
	}
	return page;
}

/** Предпочтительное имя для импорта: то же, что {@link applyNavigationCoercion} (редьюсер `useAppState`, тесты, UI). */
export const navigateDesktopShell = applyNavigationCoercion;

export const resolveInitialPage = (): string => {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.get('token')) {
		return DEFAULT_PAGE;
	}

	const rawHash = window.location.hash.replace(/^#/, '').trim();
	const fromHash = normalizePageCandidate(window.location.hash);
	const fromStorage = readStoredPreferredPage();
	const normalized = fromHash ?? fromStorage ?? null;

	if (!normalized) {
		return DEFAULT_PAGE;
	}

	const { page: coerced, pending } = coercePageToDesktopShell(
		normalized,
		rawHash || normalized
	);
	if (pending) {
		replaceHashWithDesktop();
	}
	return coerced;
};

/**
 * Выравнивает `location.hash` с каноническим маршрутом shell (и с полным hash для `desktop/store/...`).
 * Вызывать после `setCurrentPage`, если навигация обходит `App.handlePageChange`.
 * Для `comparePathOnly` сравниваются только сегменты до `?`, чтобы не затирать query на том же маршруте.
 */
export function syncLocationHashToPage(
	page: string,
	rawHash?: string,
	opts?: { comparePathOnly?: boolean }
): void {
	if (typeof window === 'undefined') return;
	const currentHash = window.location.hash.slice(1);
	const nextHash =
		page === 'desktop/store' && rawHash?.startsWith('desktop/store')
			? rawHash
			: page;
	const cur = opts?.comparePathOnly ? currentHash.split('?')[0] : currentHash;
	const next = opts?.comparePathOnly ? nextHash.split('?')[0] : nextHash;
	if (cur !== next) {
		window.location.hash = nextHash;
	}
}

/**
 * Fallback-навигация для виджетов без `onNavigate`: нормализует сегмент hash и вызывает {@link syncLocationHashToPage}.
 */
export function applyWidgetHashNavigation(rawRoute: string): void {
	const stripped = String(rawRoute).replace(/^#/, '').trim();
	if (!stripped) {
		syncLocationHashToPage(DEFAULT_PAGE);
		return;
	}
	const normalized =
		normalizePageCandidate(stripped) ??
		normalizePageCandidate(`#${stripped}`) ??
		DEFAULT_PAGE;
	syncLocationHashToPage(normalized, stripped);
}
