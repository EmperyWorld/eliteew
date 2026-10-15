/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve built-in desktop app catalog display copy. Store/API (`desktop_app_catalog`)
 * is SSOT when a non-empty name/description is present; i18n is offline/empty fallback only.
 *
 * Invariants:
 * - Runs after legacy snapshot normalization; never changes app ids or appComponent values.
 * - Non-empty store/API fallback text is never overwritten by appStore.defaultApps i18n.
 * - Unknown or custom labels keep normalized fallback text when no catalog key exists.
 *
 * Related:
 * - constants/index.ts DEFAULT_APPS
 * - desktopDefaultAppUserFacingCopy.ts
 * - documentation/product/desktop/DESKTOP-API-AND-APPS.md
 */
import type { TFunction } from 'i18next';
import i18n from 'i18next';
import { DEFAULT_APPS } from '../constants';
import type { DesktopItem } from '../types/desktop.types';
import {
	normalizeDefaultDesktopAppUserFacingCopy,
	normalizeDefaultDesktopStoreAppUserFacingCopy,
	normalizeDefaultDesktopWindowTitleUserFacingCopy,
} from './desktopDefaultAppUserFacingCopy';

const DEFAULT_APP_IDS = new Set(
	DEFAULT_APPS.filter((item) => item.type === 'app').map((item) => item.id)
);

type StoreAppCopyLike = {
	app_id: string;
	name: string;
	description?: string | null;
};

function resolveTranslator(t?: TFunction<'appStore'>): TFunction<'appStore'> {
	return t ?? i18n.getFixedT(null, 'appStore');
}

export function localizeDefaultDesktopAppCatalogName(
	appId: string,
	fallbackName: string,
	t?: TFunction<'appStore'>
): string {
	// DB / store SSOT: non-empty catalog/API name wins over locale pack.
	if (fallbackName.trim().length > 0) return fallbackName;
	if (!DEFAULT_APP_IDS.has(appId)) return fallbackName;
	return resolveTranslator(t)(`defaultApps.${appId}.name`, {
		defaultValue: fallbackName,
	});
}

export function localizeDefaultDesktopAppCatalogDescription(
	appId: string,
	fallbackDescription: string | undefined,
	t?: TFunction<'appStore'>
): string | undefined {
	// DB / store SSOT: non-empty catalog/API description wins over locale pack.
	if (fallbackDescription?.trim()) {
		return fallbackDescription;
	}
	if (!DEFAULT_APP_IDS.has(appId)) {
		return fallbackDescription;
	}
	const fromI18n = resolveTranslator(t)(`defaultApps.${appId}.description`, {
		defaultValue: '',
	});
	const trimmed = fromI18n.trim();
	return trimmed.length > 0 ? fromI18n : fallbackDescription;
}

export function localizeDefaultDesktopAppCatalogItem(
	item: DesktopItem,
	t?: TFunction<'appStore'>
): DesktopItem {
	const normalized = normalizeDefaultDesktopAppUserFacingCopy(item);
	if (normalized.type !== 'app' || !DEFAULT_APP_IDS.has(normalized.id)) {
		return normalized;
	}
	const name = localizeDefaultDesktopAppCatalogName(
		normalized.id,
		normalized.name,
		t
	);
	const description = localizeDefaultDesktopAppCatalogDescription(
		normalized.id,
		normalized.description,
		t
	);
	if (name === normalized.name && description === normalized.description) {
		return normalized;
	}
	return { ...normalized, name, description };
}

export function localizeDefaultDesktopAppCatalogItems(
	items: readonly DesktopItem[],
	t?: TFunction<'appStore'>
): DesktopItem[] {
	let changed = false;
	const next = items.map((item) => {
		const localized = localizeDefaultDesktopAppCatalogItem(item, t);
		if (localized !== item) changed = true;
		return localized;
	});
	return changed ? next : (items as DesktopItem[]);
}

export function localizeDefaultDesktopStoreAppCatalogRow<
	T extends StoreAppCopyLike,
>(app: T, t?: TFunction<'appStore'>): T {
	const normalized = normalizeDefaultDesktopStoreAppUserFacingCopy(app);
	const name = localizeDefaultDesktopAppCatalogName(
		normalized.app_id,
		normalized.name,
		t
	);
	const description = localizeDefaultDesktopAppCatalogDescription(
		normalized.app_id,
		normalized.description ?? undefined,
		t
	);
	if (name === normalized.name && description === normalized.description) {
		return normalized;
	}
	return { ...normalized, name, description };
}

export function localizeDefaultDesktopWindowCatalogTitle(
	params: {
		appId?: string | null;
		appComponent?: string | null;
		title: string;
	},
	t?: TFunction<'appStore'>
): string {
	const normalizedTitle =
		normalizeDefaultDesktopWindowTitleUserFacingCopy(params);
	const appId =
		typeof params.appId === 'string' && params.appId.trim()
			? params.appId.trim()
			: undefined;
	if (!appId || !DEFAULT_APP_IDS.has(appId)) {
		return normalizedTitle;
	}
	return localizeDefaultDesktopAppCatalogName(appId, normalizedTitle, t);
}
