/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App visual glyph registry and lookup for desktop icon identities.
 *
 * Invariants:
 * - App component visual identities remain stable for persisted desktop items.
 * - Every DesktopWindowStyle key keeps a distinct premium look; no backdrop-filter / chameleon motion.
 * - No infinite CSS animation on window, taskbar, or widget chrome.
 * - Chrome gradient tokens (`--desktop-chrome-*-bg`) use `[background-image:var(--…)]`,
 *   never Tailwind `bg-(--…)` (that emits `background-color`, which drops gradients).
 *
 * Related:
 * - `pages/Desktop/utils/desktopVisualSystem.tsx` (public barrel)
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import {
	BellIcon,
	BriefcaseIcon,
	BuildingStorefrontIcon,
	CalendarDaysIcon,
	ChatBubbleLeftRightIcon,
	CircleStackIcon,
	ClipboardDocumentListIcon,
	ClipboardIcon,
	Cog6ToothIcon,
	CpuChipIcon,
	DocumentTextIcon,
	FolderIcon,
	GlobeAltIcon,
	MegaphoneIcon,
	MicrophoneIcon,
	MagnifyingGlassIcon,
	MusicalNoteIcon,
	NewspaperIcon,
	PhotoIcon,
	PresentationChartBarIcon,
	RectangleStackIcon,
	ShieldCheckIcon,
	SparklesIcon,
	Squares2X2Icon,
	StarIcon,
	UserGroupIcon,
	UserIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

export type DesktopAppMotif =
	| 'spark'
	| 'beam'
	| 'wave'
	| 'grid'
	| 'orbit'
	| 'chat'
	| 'bars'
	| 'pulse';

/** Outline Heroicon (or compatible SVG icon component). */
export type DesktopAppGlyphIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface DesktopAppVisualPreset {
	glyph: DesktopAppGlyphIcon;
	primary: string;
	secondary: string;
	tertiary: string;
	glow: string;
	motif: DesktopAppMotif;
}

const DEFAULT_APP_VISUAL: DesktopAppVisualPreset = {
	glyph: SparklesIcon,
	primary: '#1d4ed8',
	secondary: '#7c3aed',
	tertiary: '#0f172a',
	glow: 'rgba(59, 130, 246, 0.28)',
	motif: 'spark',
};

/** Warm folder tile for glass/accent presets (desktop grid folders). */
export const FOLDER_TILE_VISUAL: DesktopAppVisualPreset = {
	glyph: FolderIcon,
	primary: '#f59e0b',
	secondary: '#fbbf24',
	tertiary: '#78350f',
	glow: 'rgba(245, 158, 11, 0.32)',
	motif: 'spark',
};

const DESKTOP_APP_VISUALS: Record<string, DesktopAppVisualPreset> = {
	AppStore: {
		glyph: BuildingStorefrontIcon,
		primary: '#4f46e5',
		secondary: '#8b5cf6',
		tertiary: '#1e1b4b',
		glow: 'rgba(99, 102, 241, 0.3)',
		motif: 'grid',
	},
	DesktopShellSettings: {
		glyph: Cog6ToothIcon,
		primary: '#7c3aed',
		secondary: '#a78bfa',
		tertiary: '#1e1b4b',
		glow: 'rgba(124, 58, 237, 0.26)',
		motif: 'grid',
	},
	UnifiedAdminApp: {
		glyph: ShieldCheckIcon,
		primary: '#7c3aed',
		secondary: '#a78bfa',
		tertiary: '#1e1b4b',
		glow: 'rgba(124, 58, 237, 0.28)',
		motif: 'grid',
	},
	SiteManagerOps: {
		glyph: ShieldCheckIcon,
		primary: '#0ea5e9',
		secondary: '#7c3aed',
		tertiary: '#082f49',
		glow: 'rgba(14, 165, 233, 0.28)',
		motif: 'grid',
	},
	ContentManagerPro: {
		glyph: CircleStackIcon,
		primary: '#06b6d4',
		secondary: '#2563eb',
		tertiary: '#0f172a',
		glow: 'rgba(6, 182, 212, 0.28)',
		motif: 'bars',
	},
	UGS: {
		glyph: SparklesIcon,
		primary: '#a1a1aa',
		secondary: '#71717a',
		tertiary: '#18181b',
		glow: 'rgba(161, 161, 170, 0.22)',
		motif: 'spark',
	},
	UGSHubApp: {
		glyph: Squares2X2Icon,
		primary: '#22d3ee',
		secondary: '#64748b',
		tertiary: '#0f172a',
		glow: 'rgba(34, 211, 238, 0.24)',
		motif: 'grid',
	},
	EWRP: {
		glyph: PresentationChartBarIcon,
		primary: '#06b6d4',
		secondary: '#14b8a6',
		tertiary: '#083344',
		glow: 'rgba(6, 182, 212, 0.28)',
		motif: 'beam',
	},
	StudioGU: {
		glyph: MicrophoneIcon,
		primary: '#10b981',
		secondary: '#14b8a6',
		tertiary: '#052e2b',
		glow: 'rgba(16, 185, 129, 0.28)',
		motif: 'wave',
	},
	DocEditor: {
		glyph: DocumentTextIcon,
		primary: '#f59e0b',
		secondary: '#facc15',
		tertiary: '#422006',
		glow: 'rgba(245, 158, 11, 0.28)',
		motif: 'beam',
	},
	DocEditorV2: {
		glyph: DocumentTextIcon,
		primary: '#f59e0b',
		secondary: '#38bdf8',
		tertiary: '#0f172a',
		glow: 'rgba(56, 189, 248, 0.24)',
		motif: 'beam',
	},
	ImageStudio: {
		glyph: PhotoIcon,
		primary: '#7c3aed',
		secondary: '#d946ef',
		tertiary: '#312e81',
		glow: 'rgba(124, 58, 237, 0.3)',
		motif: 'orbit',
	},
	VideoStudio: {
		glyph: VideoCameraIcon,
		primary: '#6366f1',
		secondary: '#ec4899',
		tertiary: '#312e81',
		glow: 'rgba(99, 102, 241, 0.28)',
		motif: 'beam',
	},
	// GAF Chat: follows desktop chrome — ACCENT_COLORS default purple, slate panels,
	// framed surface + communication family (DesktopAppChrome). Badges/bubbles use rgb(var(--desktop-accent-rgb)).
	GAFChatApp: {
		glyph: ChatBubbleLeftRightIcon,
		primary: '#a855f7',
		secondary: '#6366f1',
		tertiary: '#1e1b4b',
		glow: 'rgba(168, 85, 247, 0.3)',
		motif: 'chat',
	},
	VideoCallApp: {
		glyph: VideoCameraIcon,
		primary: '#38bdf8',
		secondary: '#6366f1',
		tertiary: '#0f172a',
		glow: 'rgba(56, 189, 248, 0.28)',
		motif: 'beam',
	},
	DesktopAiChatApp: {
		glyph: SparklesIcon,
		primary: '#8b5cf6',
		secondary: '#38bdf8',
		tertiary: '#1e1b4b',
		glow: 'rgba(139, 92, 246, 0.32)',
		motif: 'orbit',
	},
	AssistantApp: {
		glyph: CpuChipIcon,
		primary: '#6366f1',
		secondary: '#818cf8',
		tertiary: '#1e1b4b',
		glow: 'rgba(99, 102, 241, 0.28)',
		motif: 'orbit',
	},
	FriendsApp: {
		glyph: UserGroupIcon,
		primary: '#22c55e',
		secondary: '#06b6d4',
		tertiary: '#052e16',
		glow: 'rgba(34, 197, 94, 0.28)',
		motif: 'chat',
	},
	SocialHubApp: {
		glyph: UserGroupIcon,
		primary: '#22c55e',
		secondary: '#06b6d4',
		tertiary: '#052e16',
		glow: 'rgba(34, 197, 94, 0.28)',
		motif: 'chat',
	},
	MusicGenerator: {
		glyph: MusicalNoteIcon,
		primary: '#8b5cf6',
		secondary: '#d946ef',
		tertiary: '#3b0764',
		glow: 'rgba(168, 85, 247, 0.3)',
		motif: 'wave',
	},
	MusicEvolutionApp: {
		glyph: SparklesIcon,
		primary: '#d946ef',
		secondary: '#f59e0b',
		tertiary: '#064e3b',
		glow: 'rgba(217, 70, 239, 0.32)',
		motif: 'wave',
	},
	MusicForgeApp: {
		glyph: MusicalNoteIcon,
		primary: '#f59e0b',
		secondary: '#d946ef',
		tertiary: '#020617',
		glow: 'rgba(245, 158, 11, 0.3)',
		motif: 'wave',
	},
	PoemmaApp: {
		glyph: BuildingStorefrontIcon,
		primary: '#059669',
		secondary: '#d97706',
		tertiary: '#292524',
		glow: 'rgba(5, 150, 105, 0.28)',
		motif: 'grid',
	},
	ProjectAboutApp: {
		glyph: PresentationChartBarIcon,
		primary: '#8b5cf6',
		secondary: '#22d3ee',
		tertiary: '#1e1b4b',
		glow: 'rgba(139, 92, 246, 0.3)',
		motif: 'orbit',
	},
	KursorinaApp: {
		glyph: MagnifyingGlassIcon,
		primary: '#38bdf8',
		secondary: '#a78bfa',
		tertiary: '#0f172a',
		glow: 'rgba(56, 189, 248, 0.3)',
		motif: 'beam',
	},
	EmperyNexusChronicleApp: {
		glyph: SparklesIcon,
		primary: '#c9a227',
		secondary: '#7eb8c9',
		tertiary: '#0a1018',
		glow: 'rgba(201, 162, 39, 0.32)',
		motif: 'orbit',
	},
	MusicPlayer: {
		glyph: MusicalNoteIcon,
		primary: '#6366f1',
		secondary: '#8b5cf6',
		tertiary: '#312e81',
		glow: 'rgba(99, 102, 241, 0.28)',
		motif: 'wave',
	},
	NotificationsApp: {
		glyph: BellIcon,
		primary: '#6366f1',
		secondary: '#38bdf8',
		tertiary: '#1e1b4b',
		glow: 'rgba(99, 102, 241, 0.28)',
		motif: 'orbit',
	},
	CalendarApp: {
		glyph: CalendarDaysIcon,
		primary: '#0ea5e9',
		secondary: '#6366f1',
		tertiary: '#0f172a',
		glow: 'rgba(14, 165, 233, 0.28)',
		motif: 'grid',
	},
	DesktopWidgetShelfApp: {
		glyph: ClipboardDocumentListIcon,
		primary: '#f59e0b',
		secondary: '#f97316',
		tertiary: '#78350f',
		glow: 'rgba(245, 158, 11, 0.26)',
		motif: 'grid',
	},
	DesktopDashboardFavoritesApp: {
		glyph: StarIcon,
		primary: '#ec4899',
		secondary: '#f43f5e',
		tertiary: '#831843',
		glow: 'rgba(236, 72, 153, 0.26)',
		motif: 'orbit',
	},
	EWDeskApp: {
		glyph: NewspaperIcon,
		primary: '#38bdf8',
		secondary: '#6366f1',
		tertiary: '#0f172a',
		glow: 'rgba(56, 189, 248, 0.26)',
		motif: 'grid',
	},
	SurveyHubApp: {
		glyph: PresentationChartBarIcon,
		primary: '#6366f1',
		secondary: '#8b5cf6',
		tertiary: '#1e1b4b',
		glow: 'rgba(99, 102, 241, 0.28)',
		motif: 'beam',
	},
	ClipboardManager: {
		glyph: ClipboardIcon,
		primary: '#f59e0b',
		secondary: '#f97316',
		tertiary: '#431407',
		glow: 'rgba(249, 115, 22, 0.28)',
		motif: 'grid',
	},
	UserProfile: {
		glyph: UserIcon,
		primary: '#64748b',
		secondary: '#cbd5e1',
		tertiary: '#0f172a',
		glow: 'rgba(148, 163, 184, 0.22)',
		motif: 'orbit',
	},
	MarketingCabinet: {
		glyph: MegaphoneIcon,
		primary: '#f59e0b',
		secondary: '#f97316',
		tertiary: '#431407',
		glow: 'rgba(249, 115, 22, 0.28)',
		motif: 'beam',
	},
	EwaApp: {
		glyph: ClipboardDocumentListIcon,
		primary: '#6366f1',
		secondary: '#8b5cf6',
		tertiary: '#1e1b4b',
		glow: 'rgba(99, 102, 241, 0.3)',
		motif: 'orbit',
	},
	CustomerCabinet: {
		glyph: BriefcaseIcon,
		primary: '#0d9488',
		secondary: '#14b8a6',
		tertiary: '#042f2e',
		glow: 'rgba(20, 184, 166, 0.26)',
		motif: 'beam',
	},
	UserSiteStudio: {
		glyph: GlobeAltIcon,
		primary: '#0ea5e9',
		secondary: '#6366f1',
		tertiary: '#082f49',
		glow: 'rgba(14, 165, 233, 0.28)',
		motif: 'beam',
	},
	KirsCuration: {
		glyph: RectangleStackIcon,
		primary: '#7c3aed',
		secondary: '#4f46e5',
		tertiary: '#1e1b4b',
		glow: 'rgba(124, 58, 237, 0.28)',
		motif: 'beam',
	},
	KirsClientSite: {
		glyph: GlobeAltIcon,
		primary: '#64748b',
		secondary: '#52525b',
		tertiary: '#18181b',
		glow: 'rgba(100, 116, 139, 0.24)',
		motif: 'beam',
	},
	Presentations: {
		glyph: PresentationChartBarIcon,
		primary: '#06b6d4',
		secondary: '#14b8a6',
		tertiary: '#083344',
		glow: 'rgba(6, 182, 212, 0.28)',
		motif: 'beam',
	},
	PresentationsArchive: {
		glyph: PresentationChartBarIcon,
		primary: '#0891b2',
		secondary: '#2563eb',
		tertiary: '#082f49',
		glow: 'rgba(37, 99, 235, 0.28)',
		motif: 'bars',
	},
};

export function getDesktopAppVisual(
	appComponent?: string | null
): DesktopAppVisualPreset {
	if (!appComponent) {
		return DEFAULT_APP_VISUAL;
	}
	return DESKTOP_APP_VISUALS[appComponent] ?? DEFAULT_APP_VISUAL;
}
