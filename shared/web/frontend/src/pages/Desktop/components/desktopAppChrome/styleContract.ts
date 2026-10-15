/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app chrome style tokens, family maps, and surface-mode resolution.
 *
 * Invariants:
 * - Public focus ring contract must stay keyboard-visible.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';

/** Single inset focus ring for desktop chrome — avoids ring-offset double outlines */
export const DESKTOP_CHROME_FOCUS_VISIBLE =
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]';

export const DESKTOP_APP_STYLE_CONTRACT = {
	/** Transparent in desktop windows so framed/content chrome shows; full-page routes may override. */
	shell: 'bg-transparent text-(--desktop-text-primary)',
	panel:
		'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)',
	panelStrong:
		'rounded-(--desktop-radius-xl) border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong)',
	softCard:
		'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
	toolbar:
		'flex min-w-0 items-center gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 shrink-0',
	sectionLabel: cn(
		DESKTOP_TYPOGRAPHY.captionInherit,
		'uppercase tracking-[0.18em] text-(--desktop-text-secondary)'
	),
	/** Dense tiles (e.g. dashboard KPI) — same voice as sectionLabel, one step smaller */
	sectionLabelCompact: DESKTOP_TYPOGRAPHY.sectionPill,
	counterBadge:
		'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium',
	listRow: cn(
		'w-full text-left rounded-(--desktop-radius) px-3 py-3 transition-colors duration-200 motion-reduce:transition-none',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
	searchField:
		'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors duration-200 motion-reduce:transition-none scheme-dark',
	helperText: DESKTOP_TYPOGRAPHY.caption,
	emptyIcon:
		'flex h-16 w-16 items-center justify-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
	modalBackdrop: cn(
		'fixed inset-0 flex items-center justify-center',
		DESKTOP_OVERLAY.backdrop
	),
} as const;

export type DesktopAppFamily =
	| 'shell'
	| 'docs'
	| 'media'
	| 'ai'
	| 'communication'
	| 'productivity'
	| 'system'
	| 'iframe';

export type DesktopAppSurfaceMode = 'standard' | 'framed' | 'passthrough';

export const DESKTOP_APP_FAMILY_BY_COMPONENT: Record<string, DesktopAppFamily> =
	{
		AppStore: 'shell',
		DesktopShellSettings: 'shell',
		MarketingCabinet: 'shell',
		EwaApp: 'ai',
		CustomerCabinet: 'shell',
		UserSiteStudio: 'shell',
		KirsCuration: 'shell',
		KirsClientSite: 'shell',
		ContentManagerPro: 'docs',
		DocEditor: 'docs',
		DocEditorV2: 'docs',
		MusicPlayer: 'media',
		MusicGenerator: 'media',
		MusicEvolutionApp: 'media',
		MusicForgeApp: 'media',
		PoemmaApp: 'productivity',
		ProjectAboutApp: 'iframe',
		KursorinaApp: 'productivity',
		EmperyNexusChronicleApp: 'productivity',
		StudioGU: 'media',
		ImageStudio: 'media',
		VideoStudio: 'media',
		UGS: 'ai',
		UGSHubApp: 'ai',
		GAFChatApp: 'communication',
		VideoCallApp: 'communication',
		DesktopAiChatApp: 'productivity',
		FriendsApp: 'communication',
		SocialHubApp: 'communication',
		UserProfile: 'system',
		ClipboardManager: 'system',
		NotificationsApp: 'communication',
		CalendarApp: 'productivity',
		DesktopWidgetShelfApp: 'productivity',
		DesktopDashboardFavoritesApp: 'productivity',
		FeedbackHubApp: 'communication',
		AssistantApp: 'communication',
		EWDeskApp: 'communication',
		ProfessionalWorlds: 'shell',
	};

const FAMILY_SURFACE_MODE: Record<DesktopAppFamily, DesktopAppSurfaceMode> = {
	shell: 'framed',
	docs: 'framed',
	media: 'framed',
	ai: 'passthrough',
	communication: 'framed',
	productivity: 'framed',
	system: 'passthrough',
	iframe: 'passthrough',
};

const COMPONENT_SURFACE_MODE_OVERRIDES: Partial<
	Record<string, DesktopAppSurfaceMode>
> = {
	FriendsApp: 'passthrough',
	SocialHubApp: 'passthrough',
	MusicPlayer: 'framed',
	MusicGenerator: 'framed',
	MusicEvolutionApp: 'framed',
	MusicForgeApp: 'framed',
	PoemmaApp: 'framed',
	ProjectAboutApp: 'passthrough',
	EmperyNexusChronicleApp: 'passthrough',
	ImageStudio: 'framed',
	VideoStudio: 'framed',
	/** Окно с полосой контента как у других приложений (`getDesktopShellPanelClassName` strong). */
	DocEditor: 'standard',
	DocEditorV2: 'standard',
	ContentManagerPro: 'standard',
	StudioGU: 'framed',
	UGS: 'framed',
	UGSHubApp: 'framed',
	EwaApp: 'standard',
	UserProfile: 'passthrough',
};

export function getDesktopAppFamily(
	appComponent?: string | null
): DesktopAppFamily {
	if (!appComponent) return 'shell';
	return DESKTOP_APP_FAMILY_BY_COMPONENT[appComponent] ?? 'system';
}

export function getDesktopAppSurfaceMode(
	appComponent?: string | null
): DesktopAppSurfaceMode {
	if (!appComponent) return 'framed';
	return (
		COMPONENT_SURFACE_MODE_OVERRIDES[appComponent] ??
		FAMILY_SURFACE_MODE[getDesktopAppFamily(appComponent)]
	);
}

/** Context menus: graphite shell — menu-specific border + theme-aware surface tint.
 *  Используем `border-[var(--…)]`, а не `border-(--…)` — иначе утилита может не попасть в CSS (JIT).
 */
export const MENU_SURFACE =
	'rounded-(--desktop-radius-lg) border border-[var(--desktop-border-menu)] bg-(--desktop-surface-panel-strong)';
