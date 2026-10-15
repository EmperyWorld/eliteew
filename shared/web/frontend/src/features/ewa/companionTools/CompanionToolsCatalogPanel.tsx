/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Instruments catalog — anchored popover above composer (desktop) or bottom sheet (mobile).
 *
 * Invariants:
 * - Built-in tools only in catalog; user phrases stay in «Мои фразы».
 * - «Попробовать» sends preset prompt; «В чат» inserts text into composer without submit.
 * - Self-portaled sheet/backdrop/body host use ``CompanionToolsCatalogPortal`` (shell CSS vars).
 *
 * Related:
 * - src/features/ewa/companionTools/companionToolsCatalogUi.ts
 * - src/features/ewa/companionTools/CompanionToolsCatalogPortal.tsx
 */

import type { TFunction } from 'i18next';
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import {
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionToolsCatalogPortal } from '@/features/ewa/companionTools/CompanionToolsCatalogPortal';

import {
	COMPANION_TOOL_CATEGORY_ORDER,
	buildCompanionToolCatalogEntries,
	filterCompanionToolCatalogEntries,
	groupCompanionToolCatalogByCategory,
	type CompanionToolCatalogEntry,
	type CompanionToolAvailability,
} from '@/features/ewa/companionTools/companionToolsCatalogUi';
import type { CompanionToolAccessChannel } from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import {
	COMPANION_TOOL_CATALOG_BODY_SHEET_CLASS,
	COMPANION_TOOL_CATALOG_HEADER_CLASS,
	COMPANION_TOOL_CATALOG_HINT_CLASS,
	COMPANION_TOOL_CATALOG_INSERT_ACTION_CLASS,
	COMPANION_TOOL_CATALOG_ICON_TILE_CLASS,
	COMPANION_TOOL_CATALOG_PANEL_SURFACE_CLASS,
	COMPANION_TOOL_CATALOG_ROW_COMPACT_CLASS,
	COMPANION_TOOL_CATALOG_ROW_SHEET_CLASS,
	COMPANION_TOOL_CATALOG_SEARCH_CLASS,
	COMPANION_TOOL_CATALOG_SECTION_TITLE_CLASS,
	COMPANION_TOOL_CATALOG_SECTION_TITLE_SHEET_CLASS,
	COMPANION_TOOL_CATALOG_TRY_ACTION_CLASS,
	COMPANION_TOOLS_ANCHORED_MAX_WIDTH_PX,
} from '@/features/ewa/companionTools/companionToolsDesktopSurface';
import { companionEwaToolSpecById } from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import {
	COMPANION_PINNED_TOOLS_MAX,
	togglePinnedToolId,
} from '@/features/ewa/companionTools/companionPinnedToolsStorage';
import { companionQuickPresetVisual } from '@/features/ewa/companionQuickPresetIcons';
import {
	buildBuiltinCompanionQuickPresets,
	type CompanionQuickPresetChip,
} from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { CompanionMobileBottomSheet } from '@/features/ewa/companionUx/CompanionMobileBottomSheet';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionToolsCatalogPortalHost = 'body' | 'inline';

export type CompanionToolsCatalogVariant = 'anchored' | 'sheet';

export type CompanionToolsCatalogPanelProps = {
	open: boolean;
	onClose: () => void;
	principalId: string;
	pinnedToolIds: string[];
	recentToolIds: string[];
	onPinnedChange: (ids: string[]) => void;
	onTryTool: (chip: CompanionQuickPresetChip) => void;
	onInsertTool: (chip: CompanionQuickPresetChip) => void;
	embeddedMobile: boolean;
	variant: CompanionToolsCatalogVariant;
	/** Desktop composer anchor for body-portaled popover (above MODAL backdrop). */
	anchorRef?: RefObject<HTMLElement | null>;
	/** When parent already wrapped catalog in ``CompanionToolsCatalogPortal``, use ``inline``. */
	portalHost?: CompanionToolsCatalogPortalHost;
};

function useAnchorRect(
	anchorRef: RefObject<HTMLElement | null> | undefined,
	open: boolean
): DOMRect | null {
	const [rect, setRect] = useState<DOMRect | null>(null);

	useLayoutEffect(() => {
		if (!open || !anchorRef?.current) {
			setRect(null);
			return;
		}
		const node = anchorRef.current;
		const sync = () => {
			setRect(node.getBoundingClientRect());
		};
		sync();
		const observer = new ResizeObserver(sync);
		observer.observe(node);
		window.addEventListener('resize', sync);
		window.addEventListener('scroll', sync, true);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', sync);
			window.removeEventListener('scroll', sync, true);
		};
	}, [anchorRef, open]);

	return rect;
}

/** Dim backdrop layer — must live inside ``CompanionToolsCatalogPortal``. */
export function CompanionToolsCatalogBackdropLayer({
	onClose,
}: {
	onClose: () => void;
}) {
	const { t } = useTranslation('marketing');
	return (
		<button
			type="button"
			className="fixed inset-0 bg-(--desktop-overlay-backdrop)"
			style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
			data-testid="tools-catalog-backdrop"
			aria-label={t('ewaCompanion.sheetBackdropClose')}
			onClick={onClose}
		/>
	);
}

/** Legacy self-portaled backdrop (prefer overlay + ``CompanionToolsCatalogPortal``). */
export function CompanionToolsCatalogBackdrop({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	return (
		<CompanionToolsCatalogPortal open={open}>
			<CompanionToolsCatalogBackdropLayer onClose={onClose} />
		</CompanionToolsCatalogPortal>
	);
}

/** Desktop anchored popover — sheet-style cards (not cramped operator rows). */
const COMPANION_TOOLS_ANCHORED_LAYOUT = 'sheet' as const;

function availabilityBadgeLabel(
	t: TFunction<'marketing'>,
	availability: CompanionToolAvailability
): string {
	if (availability === 'needs_editor') {
		return t('ewaCompanion.toolsCatalog.badgeNeedsEditor');
	}
	if (availability === 'desktop_only') {
		return t('ewaCompanion.toolsCatalog.badgeDesktopOnly');
	}
	return t('ewaCompanion.toolsCatalog.badgeAvailable');
}

function accessChannelLabel(
	t: TFunction<'marketing'>,
	channel: CompanionToolAccessChannel
): string {
	if (channel === 'quick_chip')
		return t('ewaCompanion.toolsCatalog.accessQuickChip');
	if (channel === 'chat') return t('ewaCompanion.toolsCatalog.accessChat');
	if (channel === 'workflow')
		return t('ewaCompanion.toolsCatalog.accessWorkflow');
	return t('ewaCompanion.toolsCatalog.accessSlash');
}

function ToolCatalogMetaBadges({
	entry,
	t,
}: {
	entry: CompanionToolCatalogEntry;
	t: TFunction<'marketing'>;
}) {
	return (
		<div className="mt-1.5 flex flex-wrap gap-1">
			<span
				className={cn(
					'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]',
					entry.availability === 'available'
						? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
						: 'border-amber-300/25 bg-amber-300/10 text-amber-100'
				)}
				data-testid={`ewa-companion-tool-availability-${entry.catalogId}`}
			>
				{availabilityBadgeLabel(t, entry.availability)}
			</span>
			{entry.access.map((channel) => (
				<span
					key={`${entry.catalogId}-${channel}`}
					className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-(--desktop-text-muted)"
				>
					{accessChannelLabel(t, channel)}
				</span>
			))}
		</div>
	);
}

function ToolRow({
	entry,
	pinned,
	onTry,
	onInsert,
	onTogglePin,
	disabled,
	layout = 'compact',
	embeddedMobile = false,
}: {
	entry: CompanionToolCatalogEntry;
	pinned: boolean;
	onTry: () => void;
	onInsert: () => void;
	onTogglePin: () => void;
	disabled: boolean;
	layout?: 'compact' | 'sheet';
	embeddedMobile?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const spec = companionEwaToolSpecById(entry.catalogId);
	const visual = spec
		? { icon: spec.icon, tone: spec.tone }
		: companionQuickPresetVisual(entry.chip.id);
	const unavailable = embeddedMobile && entry.availability === 'desktop_only';
	const hint = [entry.description, entry.examplePhrase]
		.filter(Boolean)
		.join(' — ');

	if (layout === 'sheet') {
		return (
			<article
				className={cn(
					COMPANION_TOOL_CATALOG_ROW_SHEET_CLASS,
					unavailable && 'opacity-70'
				)}
				data-testid={`ewa-companion-tool-card-${entry.catalogId}`}
				title={hint}
			>
				<div className="flex min-w-0 items-start gap-2.5">
					<div className={COMPANION_TOOL_CATALOG_ICON_TILE_CLASS}>
						<EwaIcon
							name={visual.icon}
							size="sm"
							tone={visual.tone}
							className="shrink-0"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-start justify-between gap-2">
							<p className="text-[13px] font-semibold leading-snug text-(--desktop-text-primary)">
								{entry.chip.label}
							</p>
							{entry.pinnable ? (
								<button
									type="button"
									disabled={disabled}
									className={cn(
										'shrink-0 rounded-full p-1',
										pinned
											? 'text-[rgb(var(--desktop-accent-rgb))]'
											: 'text-(--desktop-text-muted)',
										'hover:bg-(--desktop-surface-soft-hover)',
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
									aria-label={t(
										pinned
											? 'ewaCompanion.toolsCatalog.unpinAria'
											: 'ewaCompanion.toolsCatalog.pinAria',
										{ label: entry.chip.label }
									)}
									onClick={onTogglePin}
								>
									<MapPinIcon
										className={cn('size-3.5', pinned && 'fill-current')}
									/>
								</button>
							) : null}
						</div>
						{entry.description ? (
							<p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-(--desktop-text-muted)">
								{entry.description}
							</p>
						) : null}
						<ToolCatalogMetaBadges entry={entry} t={t} />
					</div>
				</div>
				<div className="flex items-stretch justify-end gap-2">
					<button
						type="button"
						disabled={disabled || unavailable}
						onClick={onTry}
						className={cn(COMPANION_TOOL_CATALOG_TRY_ACTION_CLASS, 'flex-1')}
						data-testid={`ewa-companion-tool-try-${entry.catalogId}`}
					>
						{t('ewaCompanion.toolsCatalog.tryButton')}
					</button>
					<button
						type="button"
						disabled={disabled || unavailable}
						onClick={onInsert}
						className={COMPANION_TOOL_CATALOG_INSERT_ACTION_CLASS}
						data-testid={`ewa-companion-tool-insert-${entry.catalogId}`}
					>
						{t('ewaCompanion.toolsCatalog.insertButton')}
					</button>
				</div>
			</article>
		);
	}

	return (
		<article
			className={cn(
				COMPANION_TOOL_CATALOG_ROW_COMPACT_CLASS,
				unavailable && 'opacity-70'
			)}
			data-testid={`ewa-companion-tool-card-${entry.catalogId}`}
			title={hint}
		>
			<div className={COMPANION_TOOL_CATALOG_ICON_TILE_CLASS}>
				<EwaIcon
					name={visual.icon}
					size="sm"
					tone={visual.tone}
					className="shrink-0 scale-90"
				/>
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-1">
					<p className="truncate text-[12px] font-medium leading-tight text-(--desktop-text-primary)">
						{entry.chip.label}
					</p>
					{entry.pinnable ? (
						<button
							type="button"
							disabled={disabled}
							className={cn(
								'shrink-0 rounded p-0.5',
								pinned
									? 'text-[rgb(var(--desktop-accent-rgb))]'
									: 'text-(--desktop-text-muted) opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
								pinned && 'opacity-100',
								'hover:bg-(--desktop-surface-soft-hover)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							aria-label={t(
								pinned
									? 'ewaCompanion.toolsCatalog.unpinAria'
									: 'ewaCompanion.toolsCatalog.pinAria',
								{ label: entry.chip.label }
							)}
							onClick={onTogglePin}
						>
							<MapPinIcon className={cn('size-3', pinned && 'fill-current')} />
						</button>
					) : null}
				</div>
				{entry.description ? (
					<p className="truncate text-[10px] leading-tight text-(--desktop-text-muted)">
						{entry.description}
					</p>
				) : null}
				<ToolCatalogMetaBadges entry={entry} t={t} />
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<button
					type="button"
					disabled={disabled || unavailable}
					onClick={onInsert}
					className={COMPANION_TOOL_CATALOG_INSERT_ACTION_CLASS}
					data-testid={`ewa-companion-tool-insert-${entry.catalogId}`}
				>
					{t('ewaCompanion.toolsCatalog.insertButton')}
				</button>
				<button
					type="button"
					disabled={disabled || unavailable}
					onClick={onTry}
					className={COMPANION_TOOL_CATALOG_TRY_ACTION_CLASS}
					data-testid={`ewa-companion-tool-try-${entry.catalogId}`}
				>
					{t('ewaCompanion.toolsCatalog.tryButton')}
				</button>
			</div>
		</article>
	);
}

function CatalogBody({
	entries,
	pinnedToolIds,
	recentToolIds,
	onTryTool,
	onInsertTool,
	onTogglePin,
	disabled,
	layout = 'compact',
	embeddedMobile = false,
}: {
	entries: CompanionToolCatalogEntry[];
	pinnedToolIds: string[];
	recentToolIds: string[];
	onTryTool: (chip: CompanionQuickPresetChip) => void;
	onInsertTool: (chip: CompanionQuickPresetChip) => void;
	onTogglePin: (toolId: string) => void;
	disabled: boolean;
	layout?: 'compact' | 'sheet';
	embeddedMobile?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const [query, setQuery] = useState('');
	const filtered = useMemo(
		() => filterCompanionToolCatalogEntries(entries, query),
		[entries, query]
	);
	const grouped = useMemo(
		() => groupCompanionToolCatalogByCategory(filtered),
		[filtered]
	);
	const entryByChipId = useMemo(
		() => new Map(entries.map((row) => [row.chip.id, row])),
		[entries]
	);
	const recentEntries = useMemo(
		() =>
			recentToolIds
				.map((id) => entryByChipId.get(id))
				.filter((row): row is CompanionToolCatalogEntry => Boolean(row)),
		[entryByChipId, recentToolIds]
	);

	const sectionTitleClass =
		layout === 'compact'
			? COMPANION_TOOL_CATALOG_SECTION_TITLE_CLASS
			: COMPANION_TOOL_CATALOG_SECTION_TITLE_SHEET_CLASS;
	const listGapClass = layout === 'compact' ? 'gap-0.5' : 'gap-2';
	const rootGapClass = layout === 'compact' ? 'gap-2.5' : 'gap-3.5';

	return (
		<div className={cn('flex flex-col', rootGapClass)}>
			<label className="relative block shrink-0">
				<MagnifyingGlassIcon
					className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-(--desktop-text-muted)"
					aria-hidden
				/>
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={t('ewaCompanion.toolsCatalog.searchPlaceholder')}
					className={COMPANION_TOOL_CATALOG_SEARCH_CLASS}
				/>
			</label>
			<p className={COMPANION_TOOL_CATALOG_HINT_CLASS}>
				{t('ewaCompanion.toolsCatalog.pinnedHint', {
					max: COMPANION_PINNED_TOOLS_MAX,
				})}
			</p>
			{!query.trim() && recentEntries.length > 0 ? (
				<section>
					<h3 className={sectionTitleClass}>
						{t('ewaCompanion.toolsCatalog.recentTitle')}
					</h3>
					<ul className={cn('flex flex-col', listGapClass)}>
						{recentEntries.map((entry) => (
							<li key={`recent-${entry.chip.id}`}>
								<ToolRow
									entry={entry}
									pinned={pinnedToolIds.includes(entry.chip.id)}
									disabled={disabled}
									layout={layout}
									embeddedMobile={embeddedMobile}
									onTry={() => onTryTool(entry.chip)}
									onInsert={() => onInsertTool(entry.chip)}
									onTogglePin={() => onTogglePin(entry.chip.id)}
								/>
							</li>
						))}
					</ul>
				</section>
			) : null}
			{filtered.length === 0 ? (
				<p className="py-3 text-center text-[11px] text-(--desktop-text-muted)">
					{t('ewaCompanion.toolsCatalog.emptySearch')}
				</p>
			) : (
				COMPANION_TOOL_CATEGORY_ORDER.map((category) => {
					const rows = grouped.get(category) ?? [];
					if (rows.length === 0) return null;
					return (
						<section key={category}>
							<h3 className={sectionTitleClass}>
								{t(`ewaCompanion.toolsCatalog.categories.${category}`)}
							</h3>
							<ul className={cn('flex flex-col', listGapClass)}>
								{rows.map((entry) => (
									<li key={entry.chip.id}>
										<ToolRow
											entry={entry}
											pinned={pinnedToolIds.includes(entry.chip.id)}
											disabled={disabled}
											layout={layout}
											embeddedMobile={embeddedMobile}
											onTry={() => onTryTool(entry.chip)}
											onInsert={() => onInsertTool(entry.chip)}
											onTogglePin={() => onTogglePin(entry.chip.id)}
										/>
									</li>
								))}
							</ul>
						</section>
					);
				})
			)}
		</div>
	);
}

function CatalogChrome({
	title,
	subtitle,
	onClose,
	children,
	testId,
	className,
	anchored = false,
}: {
	title: string;
	subtitle?: string;
	onClose: () => void;
	children: ReactNode;
	testId: string;
	className?: string;
	/** Desktop popover above composer — taller, user-facing copy in header. */
	anchored?: boolean;
}) {
	const { t } = useTranslation('marketing');

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			data-testid={testId}
			className={cn(
				COMPANION_TOOL_CATALOG_PANEL_SURFACE_CLASS,
				'flex min-h-0 w-full flex-col text-(--desktop-text-primary)',
				anchored
					? 'max-h-[min(72vh,32rem)] max-w-[min(100vw-16px,28rem)]'
					: 'max-h-[min(72vh,32rem)] max-w-md',
				className
			)}
		>
			<div
				className={cn(
					COMPANION_TOOL_CATALOG_HEADER_CLASS,
					anchored && 'px-3.5 py-3'
				)}
			>
				<div className="min-w-0 flex-1">
					<h2
						className={cn(
							'font-semibold text-(--desktop-text-primary)',
							anchored ? 'text-[15px] leading-snug' : 'text-sm'
						)}
					>
						{title}
					</h2>
					{subtitle ? (
						<p className="mt-1 text-[12px] leading-relaxed text-(--desktop-text-secondary)">
							{subtitle}
						</p>
					) : null}
				</div>
				<button
					type="button"
					className={cn(
						'shrink-0 rounded-full px-2.5 py-1 text-[12px] text-(--desktop-text-muted)',
						'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					onClick={onClose}
				>
					{t('ewaCompanion.sheetClose')}
				</button>
			</div>
			<div
				className={
					anchored
						? COMPANION_TOOL_CATALOG_BODY_SHEET_CLASS
						: COMPANION_TOOL_CATALOG_BODY_SHEET_CLASS
				}
				onWheel={(event) => event.stopPropagation()}
			>
				{children}
			</div>
		</div>
	);
}

export function CompanionToolsCatalogPanel({
	open,
	onClose,
	principalId,
	pinnedToolIds,
	recentToolIds,
	onPinnedChange,
	onTryTool,
	onInsertTool,
	embeddedMobile,
	variant,
	anchorRef,
	portalHost = 'body',
}: CompanionToolsCatalogPanelProps) {
	const { t } = useTranslation('marketing');
	const anchorRect = useAnchorRect(anchorRef, open && variant === 'anchored');
	const builtins = useMemo(() => buildBuiltinCompanionQuickPresets(t), [t]);
	const entries = useMemo(
		() =>
			buildCompanionToolCatalogEntries(builtins, t, {
				embeddedMobile,
			}),
		[builtins, t, embeddedMobile]
	);

	const handleTogglePin = (toolId: string) => {
		const next = togglePinnedToolId(principalId, toolId);
		onPinnedChange(next);
	};

	const catalogBodyAnchored = (
		<CatalogBody
			entries={entries}
			pinnedToolIds={pinnedToolIds}
			recentToolIds={recentToolIds}
			layout={COMPANION_TOOLS_ANCHORED_LAYOUT}
			onTryTool={(chip) => {
				onTryTool(chip);
				onClose();
			}}
			onInsertTool={(chip) => {
				onInsertTool(chip);
				onClose();
			}}
			onTogglePin={handleTogglePin}
			disabled={false}
			embeddedMobile={embeddedMobile}
		/>
	);

	const catalogBodySheet = (
		<CatalogBody
			entries={entries}
			pinnedToolIds={pinnedToolIds}
			recentToolIds={recentToolIds}
			layout="sheet"
			onTryTool={(chip) => {
				onTryTool(chip);
				onClose();
			}}
			onInsertTool={(chip) => {
				onInsertTool(chip);
				onClose();
			}}
			onTogglePin={handleTogglePin}
			disabled={false}
			embeddedMobile={embeddedMobile}
		/>
	);

	if (variant === 'sheet') {
		return (
			<CompanionToolsCatalogPortal open={open}>
				<div style={{ zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT }}>
					<CompanionMobileBottomSheet
						open={open}
						title={t('ewaCompanion.toolsCatalog.title')}
						onClose={onClose}
						testId="ewa-companion-tools-sheet"
					>
						<p className="mb-3 text-[12px] leading-relaxed text-(--desktop-text-secondary)">
							{t('ewaCompanion.toolsCatalog.subtitle')}
						</p>
						{catalogBodySheet}
					</CompanionMobileBottomSheet>
				</div>
			</CompanionToolsCatalogPortal>
		);
	}

	if (!open) return null;

	const anchoredChrome = (
		<CatalogChrome
			title={t('ewaCompanion.toolsCatalog.title')}
			subtitle={t('ewaCompanion.toolsCatalog.subtitle')}
			onClose={onClose}
			testId="ewa-companion-tools-popover"
			anchored
		>
			{catalogBodyAnchored}
		</CatalogChrome>
	);

	if (anchorRef) {
		if (!anchorRect) return null;
		const panelWidth = Math.min(
			COMPANION_TOOLS_ANCHORED_MAX_WIDTH_PX,
			Math.max(anchorRect.width, 320),
			window.innerWidth - 16
		);
		const anchoredNode = (
			<div
				className="pointer-events-auto fixed"
				style={{
					zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT,
					left: Math.max(
						8,
						Math.min(anchorRect.left, window.innerWidth - panelWidth - 8)
					),
					bottom: Math.max(8, window.innerHeight - anchorRect.top + 6),
					width: panelWidth,
				}}
				data-testid="ewa-companion-tools-anchor"
			>
				{anchoredChrome}
			</div>
		);
		if (portalHost === 'inline') {
			return anchoredNode;
		}
		return (
			<CompanionToolsCatalogPortal open>
				{anchoredNode}
			</CompanionToolsCatalogPortal>
		);
	}

	return anchoredChrome;
}
