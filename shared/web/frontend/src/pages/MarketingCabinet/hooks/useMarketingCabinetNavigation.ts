/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet routing state — URL `mc_*` sync, desktop deep-link bootstrap, localStorage selection.
 *
 * Invariants:
 * - Desktop window suppresses URL writes; company/project persist in localStorage instead.
 * - Explicit `mc_company` / `mc_project` or desktop payload override stored selection.
 *
 * Related:
 * - marketingCabinetPageHelpers.ts
 * - MarketingCabinetPage.tsx
 */
import { useEffect, useMemo, useState } from 'react';
import { MODULE_ORDER, type MarketingView } from '../constants';
import {
	mergeMarketingCabinetStateWithPersistedSelection,
	writeMarketingCabinetPersistedSelection,
} from '../marketingCabinetPageHelpers';

const VIEW_PARAM = 'mc_view';
const COMPANY_PARAM = 'mc_company';
const PROJECT_PARAM = 'mc_project';
const ENTITY_PARAM = 'mc_entity';
const CONTENT_PARAM = 'mc_content';

const MC_URL_KEYS = [
	VIEW_PARAM,
	COMPANY_PARAM,
	PROJECT_PARAM,
	ENTITY_PARAM,
	CONTENT_PARAM,
] as const;

function isMarketingView(value: string | null): value is MarketingView {
	return MODULE_ORDER.some((item) => item.id === value);
}

/** Старые ссылки `mc_view=setup` ведём в раздел компаний. */
function normalizeMarketingViewParam(
	value: string | null | undefined
): MarketingView {
	const v = typeof value === 'string' ? value.trim() : '';
	if (v === 'setup') return 'companies';
	if (isMarketingView(v)) return v;
	return 'overview';
}

function normalizeMarketingViewUnknown(value: unknown): MarketingView {
	return normalizeMarketingViewParam(typeof value === 'string' ? value : null);
}

function normalizeSearchForParams(search: string): string {
	return search.startsWith('?') ? search.slice(1) : search;
}

/** True if URL query contains a non-empty marketing-cabinet routing param. */
export function hasMarketingCabinetDeepLink(search: string): boolean {
	const params = new URLSearchParams(normalizeSearchForParams(search));
	return MC_URL_KEYS.some((key) => Boolean(params.get(key)?.trim()));
}

export type MarketingCabinetDeepLinkState = {
	activeView: MarketingView;
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
	focusedEntityId: string | null;
	selectedContentId: string | null;
};

function emptyMarketingState(): MarketingCabinetDeepLinkState {
	return {
		activeView: 'overview',
		selectedCompanyId: null,
		selectedProjectId: null,
		focusedEntityId: null,
		selectedContentId: null,
	};
}

/**
 * Parsed mc_* state when at least one param is present (see {@link hasMarketingCabinetDeepLink}).
 */
export function parseMarketingCabinetDeepLinkState(
	search: string
): MarketingCabinetDeepLinkState | null {
	if (!hasMarketingCabinetDeepLink(search)) return null;
	const params = new URLSearchParams(normalizeSearchForParams(search));
	const view = params.get(VIEW_PARAM);
	return {
		activeView: normalizeMarketingViewParam(view),
		selectedCompanyId: params.get(COMPANY_PARAM),
		selectedProjectId: params.get(PROJECT_PARAM),
		focusedEntityId: params.get(ENTITY_PARAM),
		selectedContentId: params.get(CONTENT_PARAM),
	};
}

/** Removes mc_* keys from the current location (keeps path, hash, other query params). */
export function stripMarketingCabinetParamsFromCurrentUrl(): void {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	let changed = false;
	for (const key of MC_URL_KEYS) {
		if (url.searchParams.has(key)) {
			url.searchParams.delete(key);
			changed = true;
		}
	}
	if (!changed) return;
	const qs = url.searchParams.toString();
	const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
	window.history.replaceState({}, '', next);
}

function readInitialParams(): MarketingCabinetDeepLinkState {
	if (typeof window === 'undefined') {
		return emptyMarketingState();
	}
	const fromUrl =
		parseMarketingCabinetDeepLinkState(window.location.search) ??
		emptyMarketingState();
	return mergeMarketingCabinetStateWithPersistedSelection(fromUrl);
}

function replaceParam(url: URL, key: string, value: string | null) {
	if (value?.trim()) {
		url.searchParams.set(key, value);
	} else {
		url.searchParams.delete(key);
	}
}

/**
 * Ключ для sessionStorage скролла основной колонки: совпадает с тем, что пишет replaceState.
 * pathname берём из текущего окна (страница кабинета не меняет path при смене mc_view).
 */
export function buildMarketingCabinetMainColumnScrollKey(
	state: MarketingCabinetDeepLinkState
): string {
	if (typeof window === 'undefined') return '';
	const url = new URL(window.location.href);
	replaceParam(url, VIEW_PARAM, state.activeView);
	replaceParam(url, COMPANY_PARAM, state.selectedCompanyId);
	replaceParam(url, PROJECT_PARAM, state.selectedProjectId);
	replaceParam(url, ENTITY_PARAM, state.focusedEntityId);
	replaceParam(url, CONTENT_PARAM, state.selectedContentId);
	return `${url.pathname}${url.search}`;
}

/**
 * Добавляет запись в историю браузера с актуальными `?mc_*` (A.2: вход на full dashboard
 * с рабочим «Назад»; A.10: выход на обзор карточек с тем же проектом — `activeView: 'overview'`).
 * После вызова состояние React нужно синхронизировать через сеттеры хука.
 */
export function pushMarketingCabinetSearchFromState(
	state: MarketingCabinetDeepLinkState
): void {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	replaceParam(url, VIEW_PARAM, state.activeView);
	replaceParam(url, COMPANY_PARAM, state.selectedCompanyId);
	replaceParam(url, PROJECT_PARAM, state.selectedProjectId);
	replaceParam(url, ENTITY_PARAM, state.focusedEntityId);
	replaceParam(url, CONTENT_PARAM, state.selectedContentId);
	window.history.pushState({}, '', url.toString());
}

/**
 * @param desktopConsumedDeepLink — состояние из `?mc_*`, уже «съеденное» десктопом и переданное в окно;
 * для такого окна не пишем mc_* в URL (иначе после F5 дескотп снова авто-откроет кабинет).
 */
export function useMarketingCabinetNavigation(
	desktopConsumedDeepLink?: MarketingCabinetDeepLinkState | null
) {
	const suppressUrlSync = desktopConsumedDeepLink != null;
	const initial = useMemo(() => {
		if (desktopConsumedDeepLink != null) {
			return mergeMarketingCabinetStateWithPersistedSelection({
				...desktopConsumedDeepLink,
				activeView: normalizeMarketingViewUnknown(
					desktopConsumedDeepLink.activeView
				),
			});
		}
		return readInitialParams();
	}, [desktopConsumedDeepLink]);
	const [activeView, setActiveView] = useState<MarketingView>(
		initial.activeView
	);
	const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
		initial.selectedCompanyId
	);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		initial.selectedProjectId
	);
	const [focusedEntityId, setFocusedEntityId] = useState<string | null>(
		initial.focusedEntityId
	);
	const [selectedContentId, setSelectedContentId] = useState<string | null>(
		initial.selectedContentId
	);
	/** Инкремент на `popstate` — родитель восстанавливает скролл основной колонки (A.2 бэклога). */
	const [popStateGeneration, setPopStateGeneration] = useState(0);

	/** Browser back/forward: keep React state aligned with `?mc_*` in the URL. */
	useEffect(() => {
		if (typeof window === 'undefined' || suppressUrlSync) return;

		const applyFromLocation = (): void => {
			const parsed = parseMarketingCabinetDeepLinkState(window.location.search);
			if (parsed) {
				setActiveView(parsed.activeView);
				setSelectedCompanyId(parsed.selectedCompanyId);
				setSelectedProjectId(parsed.selectedProjectId);
				setFocusedEntityId(parsed.focusedEntityId);
				setSelectedContentId(parsed.selectedContentId);
			} else {
				const restored = mergeMarketingCabinetStateWithPersistedSelection(
					emptyMarketingState()
				);
				setActiveView(restored.activeView);
				setSelectedCompanyId(restored.selectedCompanyId);
				setSelectedProjectId(restored.selectedProjectId);
				setFocusedEntityId(restored.focusedEntityId);
				setSelectedContentId(restored.selectedContentId);
			}
			setPopStateGeneration((g) => g + 1);
		};

		window.addEventListener('popstate', applyFromLocation);
		return () => window.removeEventListener('popstate', applyFromLocation);
	}, [suppressUrlSync]);

	useEffect(() => {
		writeMarketingCabinetPersistedSelection(
			selectedCompanyId,
			selectedProjectId
		);
	}, [selectedCompanyId, selectedProjectId]);

	useEffect(() => {
		if (typeof window === 'undefined' || suppressUrlSync) return;
		const url = new URL(window.location.href);
		replaceParam(url, VIEW_PARAM, activeView);
		replaceParam(url, COMPANY_PARAM, selectedCompanyId);
		replaceParam(url, PROJECT_PARAM, selectedProjectId);
		replaceParam(url, ENTITY_PARAM, focusedEntityId);
		replaceParam(url, CONTENT_PARAM, selectedContentId);
		window.history.replaceState({}, '', url.toString());
	}, [
		suppressUrlSync,
		activeView,
		selectedCompanyId,
		selectedProjectId,
		focusedEntityId,
		selectedContentId,
	]);

	return {
		activeView,
		setActiveView,
		selectedCompanyId,
		setSelectedCompanyId,
		selectedProjectId,
		setSelectedProjectId,
		focusedEntityId,
		setFocusedEntityId,
		selectedContentId,
		setSelectedContentId,
		popStateGeneration,
	};
}
