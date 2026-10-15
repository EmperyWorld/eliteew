/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized EWRP draft slide editor row and sortable DnD wrapper.
 *
 * Invariants:
 * - Editing title/bullets does not repaint sibling rows; Sortable only inside DndContext.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { cn } from '@/utils/cn';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as React from 'react';
import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	memo,
	useState,
} from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellContextMenuClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { ewrpZIndexClass } from '../ewrpZIndex';
import type { EwrpSlide } from '../../../services/ewrpApi';
import { EwrpSlideImagePreview } from '../EwrpSlideImagePreview';
import { ewrpShouldFetchSlideImage } from '../ewrpSlideImageReadiness';
import {
	ewrpBulletsToTextareaValue,
	ewrpNonEmptyBulletCount,
} from '../ewrpDraftBullets';
import {
	Bars2Icon,
	ChevronDownIcon,
	EllipsisVerticalIcon,
	InformationCircleIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import {
	EWRP_SLIDE_LAYOUT_VALUES,
	ewrpSlideLayoutI18nKey,
} from './ewrpGeneratorConstants';
import { EwrpDesktopSelect, sw } from './EwrpFormChrome';

type DraftSlideRowProps = {
	index: number;
	slide: EwrpSlide;
	shellInset: string;
	shellField: string;
	/** Classes for the native select (see {@link EwrpDesktopSelect}). */
	shellSelectClass: string;
	onTitleChange: (index: number, value: string) => void;
	onBulletsChange: (index: number, value: string) => void;
	onLayoutChange: (index: number, value: string) => void;
	isFirstSlide: boolean;
	onMoveUp: (index: number) => void;
	onMoveDown: (index: number) => void;
	onRemove: (index: number) => void;
	canMoveUp: boolean;
	canMoveDown: boolean;
	canRemove: boolean;
	/** Extra actions under fields (e.g. UGS). */
	slideActions?: React.ReactNode;
	/** With {@link onSlideExpandedChange}, collapsible body is controlled by parent (list toolbar). */
	slideExpandedOpen?: boolean;
	onSlideExpandedChange?: (open: boolean) => void;
	/** When set, slide PNG previews are loaded for this job. */
	jobId?: string | null;
};

const ewrpRadixMenuItemClass =
	'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-(--desktop-text-primary) outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-(--desktop-surface-soft-hover)';

/** Single-slide editor: editing title/bullets does not repaint sibling rows. */
export const EwrpDraftSlideRow = memo(function EwrpDraftSlideRow({
	index,
	slide,
	shellInset,
	shellField,
	shellSelectClass,
	onTitleChange,
	onBulletsChange,
	onLayoutChange,
	isFirstSlide,
	onMoveUp,
	onMoveDown,
	onRemove,
	canMoveUp,
	canMoveDown,
	canRemove,
	slideActions,
	slideExpandedOpen,
	onSlideExpandedChange,
	jobId,
}: DraftSlideRowProps) {
	const { t } = useTranslation('ewrp');
	const shellFrame = useDesktopShellFrame();
	const radixMenuContentClass = useMemo(
		() =>
			cn(
				getDesktopShellContextMenuClassName(shellFrame),
				ewrpZIndexClass.radixPortal,
				'min-w-[12rem] p-1',
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);
	const layoutHelpPopoverClass = useMemo(
		() =>
			cn(
				getDesktopShellContentPanelClassName(shellFrame),
				ewrpZIndexClass.radixPortal,
				'max-w-xs p-3 shadow-[0_16px_48px_rgba(0,0,0,0.38)]',
				DESKTOP_TYPOGRAPHY.small,
				'leading-relaxed text-(--desktop-text-secondary)',
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);
	const bulletsText = ewrpBulletsToTextareaValue(slide);
	const layoutValue = slide.layout ?? '';
	const [internalExpanded, setInternalExpanded] = useState(true);
	const controlled =
		slideExpandedOpen !== undefined && onSlideExpandedChange !== undefined;
	const slideExpanded = controlled ? slideExpandedOpen : internalExpanded;
	const handleCollapsibleOpenChange = useCallback(
		(open: boolean) => {
			if (controlled) onSlideExpandedChange(open);
			else setInternalExpanded(open);
		},
		[controlled, onSlideExpandedChange]
	);
	const bulletsTaRef = useRef<HTMLTextAreaElement | null>(null);
	const bulletCount = ewrpNonEmptyBulletCount(slide.bullets);
	const titlePreview =
		slide.title.trim() || t('draftSlide.titlePlaceholder', { n: index + 1 });

	// biome-ignore lint/correctness/useExhaustiveDependencies: height follows textarea content; bulletsText drives scrollHeight
	useLayoutEffect(() => {
		const el = bulletsTaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		const minPx = 72;
		const maxPx = 320;
		el.style.height = `${Math.min(maxPx, Math.max(minPx, el.scrollHeight))}px`;
	}, [bulletsText]);

	return (
		<Collapsible.Root
			open={slideExpanded}
			onOpenChange={handleCollapsibleOpenChange}
		>
			<div
				id={`ewrp-draft-slide-${index}`}
				className={cn(
					shellInset,
					'space-y-2 rounded-xl p-3 ring-1 ring-inset ring-black/3 motion-safe:transition-shadow motion-safe:duration-200 hover:ring-black/5'
				)}
			>
				<div className="flex items-center gap-2">
					<Collapsible.Trigger asChild>
						<button
							type="button"
							className={cn(
								'flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left text-(--desktop-text-primary) outline-none',
								'hover:bg-(--desktop-surface-soft)/50 focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							aria-expanded={slideExpanded}
							title={t('draftSlide.collapseExpandTitle')}
						>
							<motion.span
								className="flex h-6 w-6 shrink-0 items-center justify-center text-(--desktop-text-muted)"
								animate={{ rotate: slideExpanded ? 0 : -90 }}
								transition={{ duration: 0.2, ease: 'easeInOut' }}
							>
								<ChevronDownIcon
									className="h-4 w-4"
									strokeWidth={sw}
									aria-hidden
								/>
							</motion.span>
							<span className="shrink-0 text-[11px] font-semibold text-(--desktop-text-muted)">
								{t('outline.slideTitle', { n: index + 1 })}
							</span>
							<span
								className="min-w-0 flex-1 truncate text-[11px] text-(--desktop-text-secondary)"
								title={titlePreview}
							>
								{titlePreview}
							</span>
							<span className="shrink-0 tabular-nums text-[10px] text-(--desktop-text-dim)">
								{t('draftSlide.bulletLineCount', { count: bulletCount })}
							</span>
						</button>
					</Collapsible.Trigger>
					{ewrpShouldFetchSlideImage(jobId, slide) ? (
						<EwrpSlideImagePreview
							jobId={jobId}
							slideIndex={index}
							compact
							alt={titlePreview}
						/>
					) : slide.image_filename ? (
						<span className="shrink-0 rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.25)] bg-(--desktop-surface-accent) px-2 py-0.5 text-[10px] text-(--desktop-text-secondary)">
							IMG
						</span>
					) : null}
					<DropdownMenu.Root modal={false}>
						<DropdownMenu.Trigger asChild>
							<button
								type="button"
								className={cn(
									'rounded-lg p-1.5 text-(--desktop-text-muted) transition-colors hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								aria-label={t('draftSlide.moreActionsAria')}
							>
								<EllipsisVerticalIcon className="h-4 w-4" strokeWidth={sw} />
							</button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content
								className={radixMenuContentClass}
								sideOffset={6}
								align="end"
							>
								<DropdownMenu.Item
									className={ewrpRadixMenuItemClass}
									disabled={!canMoveUp}
									onSelect={() => onMoveUp(index)}
								>
									{t('draftSlide.moveUpTitle')}
								</DropdownMenu.Item>
								<DropdownMenu.Item
									className={ewrpRadixMenuItemClass}
									disabled={!canMoveDown}
									onSelect={() => onMoveDown(index)}
								>
									{t('draftSlide.moveDownTitle')}
								</DropdownMenu.Item>
								<DropdownMenu.Separator className="my-1 h-px bg-(--desktop-border-subtle)/60" />
								<DropdownMenu.Item
									className={cn(
										ewrpRadixMenuItemClass,
										'text-red-200 data-highlighted:bg-red-950/35'
									)}
									disabled={!canRemove}
									onSelect={() => onRemove(index)}
								>
									<TrashIcon
										className="h-3.5 w-3.5 shrink-0"
										strokeWidth={sw}
									/>
									{t('draftSlide.removeTitle')}
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				</div>
				<Collapsible.Content
					className={cn(
						'overflow-hidden transition-all duration-200 ease-out',
						'data-[state=closed]:max-h-0 data-[state=closed]:opacity-0',
						'data-[state=open]:max-h-[2000px] data-[state=open]:opacity-100'
					)}
				>
					<div className="space-y-2 pt-0.5">
						<label
							className="block space-y-1"
							htmlFor={`ewrp-slide-title-${index}`}
						>
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'font-medium text-(--desktop-text-secondary)'
								)}
							>
								{t('draftSlide.titleFieldLabel')}
							</span>
							<input
								id={`ewrp-slide-title-${index}`}
								type="text"
								value={slide.title}
								onChange={(e) => onTitleChange(index, e.target.value)}
								className={cn(shellField, 'py-2 text-xs')}
								placeholder={t('draftSlide.titlePlaceholder', { n: index + 1 })}
								maxLength={150}
								autoComplete="off"
							/>
						</label>
						{isFirstSlide ? (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'text-(--desktop-text-dim)'
								)}
							>
								{t('draftSlide.firstSlideNote')}
							</p>
						) : (
							<label
								className="block space-y-1"
								htmlFor={`ewrp-slide-layout-${index}`}
							>
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'flex items-center gap-1.5 font-medium text-(--desktop-text-secondary)'
									)}
								>
									{t('form.layoutLabel')}
									<Popover.Root>
										<Popover.Trigger asChild>
											<button
												type="button"
												className={cn(
													'inline-flex rounded-md p-0.5 text-(--desktop-text-dim) transition-colors hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
													DESKTOP_CHROME_FOCUS_VISIBLE
												)}
												aria-label={t('draftSlide.layoutHelpAria')}
											>
												<InformationCircleIcon
													className="h-3.5 w-3.5"
													strokeWidth={sw}
												/>
											</button>
										</Popover.Trigger>
										<Popover.Portal>
											<Popover.Content
												className={layoutHelpPopoverClass}
												side="top"
												sideOffset={8}
											>
												{t('form.layoutHelp')}
											</Popover.Content>
										</Popover.Portal>
									</Popover.Root>
								</span>
								<EwrpDesktopSelect
									id={`ewrp-slide-layout-${index}`}
									selectSize="sm"
									selectClassName={shellSelectClass}
									value={layoutValue}
									onChange={(e) => onLayoutChange(index, e.target.value)}
									aria-label={t('draftSlide.layoutSelectAria', {
										n: index + 1,
									})}
								>
									{EWRP_SLIDE_LAYOUT_VALUES.map((value) => (
										<option key={value === '' ? '__auto' : value} value={value}>
											{t(`slideLayouts.${ewrpSlideLayoutI18nKey(value)}`)}
										</option>
									))}
								</EwrpDesktopSelect>
							</label>
						)}
						<label
							className="block space-y-1"
							htmlFor={`ewrp-slide-bullets-${index}`}
						>
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'font-medium text-(--desktop-text-secondary)'
								)}
							>
								{t('draftSlide.bulletsFieldLabel')}
							</span>
							<span
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'block text-(--desktop-text-dim)'
								)}
							>
								{t('draftSlide.bulletsFieldHint')}
							</span>
							<textarea
								id={`ewrp-slide-bullets-${index}`}
								ref={bulletsTaRef}
								value={bulletsText}
								onChange={(e) => onBulletsChange(index, e.target.value)}
								rows={3}
								className={cn(
									shellField,
									'min-h-18 resize-y overflow-y-auto text-xs'
								)}
								placeholder={t('draftSlide.bulletsPlaceholder')}
								spellCheck
							/>
						</label>
						{slideActions ? (
							<div className="border-t border-(--desktop-border-subtle)/40 pt-2">
								{slideActions}
							</div>
						) : null}
					</div>
				</Collapsible.Content>
			</div>
		</Collapsible.Root>
	);
});

type SortableDraftSlideRowProps = DraftSlideRowProps & { sortableId: string };

/** Drag handle wrapper: only inside {@link DndContext} + {@link SortableContext}. */
export const EwrpSortableDraftSlideRow = memo(
	function EwrpSortableDraftSlideRow(props: SortableDraftSlideRowProps) {
		const { t } = useTranslation('ewrp');
		const { sortableId, ...rowProps } = props;
		const {
			attributes,
			listeners,
			setNodeRef,
			transform,
			transition,
			isDragging,
		} = useSortable({ id: sortableId });
		const rowRef = useRef<HTMLDivElement | null>(null);
		const setRefs = useCallback(
			(node: HTMLDivElement | null) => {
				setNodeRef(node);
				rowRef.current = node;
			},
			[setNodeRef]
		);
		useLayoutEffect(() => {
			const el = rowRef.current;
			if (!el) return;
			el.style.transform = CSS.Transform.toString(transform) ?? '';
			el.style.transition = transition ?? '';
		}, [transform, transition]);
		return (
			<div
				ref={setRefs}
				className={cn(isDragging && 'relative z-20 opacity-95')}
			>
				<div className="flex gap-2">
					<button
						type="button"
						className={cn(
							'mt-1.5 shrink-0 cursor-grab touch-none rounded-lg border border-transparent p-1.5 text-(--desktop-text-muted) transition-colors hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary) active:cursor-grabbing',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-label={t('draftSlide.dragAria')}
						title={t('draftSlide.dragTitle')}
						{...attributes}
						{...listeners}
					>
						<Bars2Icon className="h-4 w-4" strokeWidth={sw} />
					</button>
					<div className="min-w-0 flex-1">
						<EwrpDraftSlideRow {...rowProps} />
					</div>
				</div>
			</div>
		);
	}
);
