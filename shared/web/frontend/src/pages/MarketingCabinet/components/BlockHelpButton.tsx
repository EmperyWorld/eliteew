import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../Desktop/components/DesktopAppChrome';
import { getBlockHelp } from '../help/getBlockHelp';
import { getMarketingCabinetPortalRoot } from '../utils/getMarketingCabinetPortalRoot';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';

const POPOVER_MARGIN = 8;

/** Позиция fixed-панели: не вылезает за viewport; снизу не помещается → вверх; справа → влево / слева от якоря. */
function computeHelpPopoverPosition(
	trigger: DOMRect,
	panelW: number,
	panelH: number,
	vw: number,
	vh: number
): { top: number; left: number } {
	const m = POPOVER_MARGIN;
	const w = Math.min(panelW, vw - 2 * m);
	const h = Math.min(panelH, vh - 2 * m);

	// Вертикаль: сначала под якорём
	let top = trigger.bottom + m;
	const belowBottom = top + h;
	if (belowBottom > vh - m) {
		const aboveTop = trigger.top - m - h;
		if (aboveTop >= m) {
			top = aboveTop;
		} else {
			top = Math.max(m, vh - m - h);
		}
	}

	// Горизонталь: по центру якоря
	let left = trigger.left + trigger.width / 2 - w / 2;

	const fitsHoriz = (l: number) => l >= m && l + w <= vw - m;

	if (!fitsHoriz(left)) {
		left = trigger.right - w;
	}
	if (!fitsHoriz(left)) {
		left = trigger.left - m - w;
	}
	if (!fitsHoriz(left)) {
		left = trigger.right + m;
	}
	if (!fitsHoriz(left)) {
		left = vw - m - w;
	}
	left = Math.max(m, Math.min(left, vw - m - w));

	top = Math.max(m, Math.min(top, vh - m - h));

	return { top, left };
}

interface BlockHelpButtonProps {
	blockId: string;
	/** Меньше отступы у кнопки (для MetricCard) */
	compact?: boolean;
}

/** Shared popover surface: desktop shell tokens (same in/out `[data-marketing-cabinet-shell]`). */
const HELP_PANEL_SURFACE =
	'border border-(--desktop-border-subtle)/90 bg-(--desktop-surface-panel-strong) text-(--desktop-text-secondary) shadow-(--desktop-shadow-panel)';

export function BlockHelpButton({ blockId, compact }: BlockHelpButtonProps) {
	const { t, i18n } = useTranslation('marketing');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const baseId = useId().replace(/:/g, '');
	const titleId = `${baseId}-title`;
	const leadId = `${baseId}-lead`;
	const entry = useMemo(
		() => getBlockHelp(i18n.language, blockId),
		[i18n.language, blockId]
	);
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [coords, setCoords] = useState({ top: 0, left: 0 });
	useMarketingDialogFocusTrap(panelRef, open);

	const reposition = useCallback(() => {
		const triggerEl = wrapRef.current;
		if (!triggerEl) return;
		const panelEl = panelRef.current;
		const r = triggerEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const estW = Math.min(320, vw - 24);
		const estH = Math.min(vh * 0.7, 24 * 16);
		const panelW = panelEl?.offsetWidth || estW;
		const panelH = panelEl?.offsetHeight || estH;
		setCoords(computeHelpPopoverPosition(r, panelW, panelH, vw, vh));
	}, []);

	useLayoutEffect(() => {
		if (!open) return;
		reposition();
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(reposition);
		});
		return () => cancelAnimationFrame(id);
	}, [open, reposition]);

	useEffect(() => {
		if (!open) return;

		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
			setOpen(false);
		};

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};

		const onResize = () => reposition();
		const onScroll = () => reposition();

		document.addEventListener('mousedown', onDoc, true);
		document.addEventListener('keydown', onKey);
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', onScroll, true);
		return () => {
			document.removeEventListener('mousedown', onDoc, true);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onScroll, true);
		};
	}, [open, reposition]);

	if (!entry) {
		return null;
	}

	const panel = open ? (
		<div
			ref={panelRef}
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={leadId}
			data-desktop-window-ignore-context
			className={cn(
				'fixed w-[min(calc(100vw-1.5rem),20rem)] max-h-[min(70vh,24rem)] overflow-y-auto rounded-(--desktop-radius-lg) px-4 py-3 text-left text-xs leading-5',
				HELP_PANEL_SURFACE
			)}
			style={{ zIndex: portalStackBase, top: coords.top, left: coords.left }}
		>
			<div className="mb-3 flex items-start justify-between gap-2 border-b border-(--desktop-border-subtle)/60 pb-3">
				<div
					id={titleId}
					className={cn(
						DESKTOP_TYPOGRAPHY.subtitle,
						'min-w-0 pr-1 tracking-[-0.02em]'
					)}
				>
					{entry.title}
				</div>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className="shrink-0"
					onClick={() => setOpen(false)}
					aria-label={t('blockHelp.close')}
				>
					<XMarkIcon className="h-4 w-4" strokeWidth={DESKTOP_LUCIDE.stroke} />
				</DesktopAppButton>
			</div>
			<p
				id={leadId}
				className="mb-2 text-sm font-medium leading-6 text-(--desktop-text-primary)"
			>
				{entry.lead}
			</p>
			{entry.paragraphs.map((p) => (
				<p key={p} className="mb-2 leading-5 text-(--desktop-text-secondary)">
					{p}
				</p>
			))}
			{entry.related.length > 0 ? (
				<div className="mb-2">
					<div
						className={cn(
							'mb-1.5',
							DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
							'font-medium'
						)}
					>
						{t('blockHelp.related')}
					</div>
					<ul className="list-inside list-disc space-y-0.5 text-(--desktop-text-secondary)">
						{entry.related.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			) : null}
			{entry.tips.length > 0 ? (
				<div>
					<div
						className={cn(
							'mb-1.5',
							DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
							'font-medium'
						)}
					>
						{t('blockHelp.tips')}
					</div>
					<ul className="list-inside list-disc space-y-0.5 text-(--desktop-text-secondary)">
						{entry.tips.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	) : null;

	return (
		<>
			<span ref={wrapRef} className="inline-flex shrink-0">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						'shrink-0 text-(--desktop-text-muted) hover:text-(--mc-accent)',
						compact ? 'h-7 w-7' : 'h-8 w-8'
					)}
					aria-expanded={open}
					aria-haspopup="dialog"
					aria-label={`${t('blockHelp.openAria')}: ${entry.title}`}
					onClick={() => setOpen((v) => !v)}
				>
					<InformationCircleIcon
						className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</DesktopAppButton>
			</span>
			{panel
				? createPortal(panel, getMarketingCabinetPortalRoot(wrapRef.current))
				: null}
		</>
	);
}
