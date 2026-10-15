/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalizers for expansion shell_state slices (profiles, lists, visual presets).
 *
 * Invariants:
 * - Caps list lengths (profiles/presets ≤24, shortcuts ≤48 in callers).
 *
 * Related:
 * - useDesktopExpansionShellCore.ts
 */

import {
	type DesktopWindowStyle,
	normalizeDesktopFontBody,
	normalizeDesktopFontDisplay,
	normalizeDesktopIconStyle,
	normalizeDesktopSceneDepth,
	normalizeDesktopTaskbarStyle,
	normalizeDesktopWidgetsStyle,
} from '../../../../types/profile';
import type {
	DesktopUserVisualStylePreset,
	DesktopWorkspaceProfile,
} from '../../types/desktopExpansion.types';

export function isObjectRecord(
	value: unknown
): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeWorkspaceProfiles(
	raw: unknown
): DesktopWorkspaceProfile[] {
	const source = isObjectRecord(raw) ? raw.profiles : raw;
	if (!Array.isArray(source)) return [];
	return source
		.filter(isObjectRecord)
		.map((profile) => ({
			id: String(profile.id ?? '').trim(),
			name: String(profile.name ?? '').trim(),
			description:
				typeof profile.description === 'string'
					? profile.description
					: undefined,
			desktopId:
				typeof profile.desktopId === 'string' ? profile.desktopId : undefined,
			wallpaper:
				typeof profile.wallpaper === 'string' ? profile.wallpaper : undefined,
			appIds: Array.isArray(profile.appIds)
				? profile.appIds.filter((x): x is string => typeof x === 'string')
				: [],
			folderItemIds: Array.isArray(profile.folderItemIds)
				? profile.folderItemIds.filter(
						(x): x is string => typeof x === 'string'
					)
				: [],
			widgetIds: Array.isArray(profile.widgetIds)
				? profile.widgetIds.filter((x): x is string => typeof x === 'string')
				: [],
		}))
		.filter((profile) => profile.id && profile.name)
		.slice(0, 24);
}

export function normalizeList<T>(raw: unknown): T[] {
	return Array.isArray(raw) ? (raw.filter(isObjectRecord) as T[]) : [];
}

export function createId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeVisualStylePresets(
	raw: unknown
): DesktopUserVisualStylePreset[] {
	if (!Array.isArray(raw)) return [];
	const out: DesktopUserVisualStylePreset[] = [];
	for (const item of raw.slice(0, 24)) {
		if (!isObjectRecord(item)) continue;
		const id = String(item.id ?? '')
			.trim()
			.slice(0, 120);
		const name = String(item.name ?? '')
			.trim()
			.slice(0, 120);
		if (!id || !name) continue;
		const themeRaw = String(item.theme ?? 'dark').toLowerCase();
		const theme: DesktopUserVisualStylePreset['theme'] =
			themeRaw === 'light' || themeRaw === 'auto' ? themeRaw : 'dark';
		const wi = item.wallpaperIndex;
		const wallpaperIndex =
			typeof wi === 'number' && Number.isFinite(wi) && wi >= 1 && wi <= 199
				? Math.floor(wi)
				: 1;
		const wallpaperRef =
			typeof item.wallpaperRef === 'string'
				? item.wallpaperRef.slice(0, 50_000)
				: undefined;
		const accent =
			typeof item.accent === 'string'
				? item.accent.trim().slice(0, 120)
				: undefined;
		const windowStyle = normalizeDesktopTaskbarStyle(
			String(item.windowStyle ?? '')
		) as DesktopWindowStyle;
		const taskbarStyle = normalizeDesktopTaskbarStyle(
			String(item.taskbarStyle ?? windowStyle)
		);
		const iconStyle = normalizeDesktopIconStyle(
			String(item.iconStyle ?? windowStyle)
		);
		const widgetsStyle = normalizeDesktopWidgetsStyle(
			String(item.widgetsStyle ?? windowStyle)
		);
		let desktopPanelOpacity: number | undefined;
		if (
			typeof item.desktopPanelOpacity === 'number' &&
			Number.isFinite(item.desktopPanelOpacity)
		) {
			desktopPanelOpacity = Math.min(
				1,
				Math.max(0.35, item.desktopPanelOpacity)
			);
		}
		let desktopUiScale: number | undefined;
		if (
			typeof item.desktopUiScale === 'number' &&
			Number.isFinite(item.desktopUiScale)
		) {
			desktopUiScale = Math.min(1.5, Math.max(0.5, item.desktopUiScale));
		}
		const desktopSceneDepth =
			typeof item.desktopSceneDepth === 'string'
				? normalizeDesktopSceneDepth(item.desktopSceneDepth)
				: undefined;
		const desktopFontBody =
			typeof item.desktopFontBody === 'string'
				? normalizeDesktopFontBody(item.desktopFontBody)
				: undefined;
		const desktopFontDisplay =
			typeof item.desktopFontDisplay === 'string'
				? normalizeDesktopFontDisplay(item.desktopFontDisplay)
				: undefined;
		const desktopWallpaperCrossfadeEnabled =
			typeof item.desktopWallpaperCrossfadeEnabled === 'boolean'
				? item.desktopWallpaperCrossfadeEnabled
				: undefined;
		const desktopStyledTooltips =
			typeof item.desktopStyledTooltips === 'boolean'
				? item.desktopStyledTooltips
				: undefined;
		const createdAt =
			typeof item.createdAt === 'string'
				? item.createdAt.slice(0, 80)
				: undefined;
		out.push({
			id,
			name,
			theme,
			accentFollows: item.accentFollows === true,
			wallpaperIndex,
			...(wallpaperRef ? { wallpaperRef } : {}),
			...(accent ? { accent } : {}),
			windowStyle,
			taskbarStyle,
			iconStyle,
			widgetsStyle,
			...(desktopPanelOpacity != null ? { desktopPanelOpacity } : {}),
			...(desktopUiScale != null ? { desktopUiScale } : {}),
			...(desktopSceneDepth != null ? { desktopSceneDepth } : {}),
			...(desktopFontBody != null ? { desktopFontBody } : {}),
			...(desktopFontDisplay != null ? { desktopFontDisplay } : {}),
			...(desktopWallpaperCrossfadeEnabled != null
				? { desktopWallpaperCrossfadeEnabled }
				: {}),
			...(desktopStyledTooltips != null ? { desktopStyledTooltips } : {}),
			...(createdAt ? { createdAt } : {}),
		});
	}
	return out;
}
