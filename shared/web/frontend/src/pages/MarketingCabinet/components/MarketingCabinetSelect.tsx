/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Custom dropdown for Marketing Cabinet (dark panel; replaces native select in desktop shell).
 *
 * Invariants:
 * - Portal listbox mounts under marketing-cabinet shell root when available.
 * - `onOpen` fires once per open gesture (click/keyboard), not on close.
 *
 * Related:
 * - MarketingCabinetToolbar.tsx
 */
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellPanelClassName,
	getDesktopShellSelectListOptionInteractiveClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import * as React from 'react';
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

import { getMarketingCabinetPortalRoot } from '../utils/getMarketingCabinetPortalRoot';

export type MarketingCabinetSelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
	/** Native tooltip on options / list row (e.g. catalog description). */
	description?: string;
};

export type MarketingCabinetSelectProps = {
	value: string;
	onChange: (next: string) => void;
	options: MarketingCabinetSelectOption[];
	disabled?: boolean;
	id?: string;
	className?: string;
	/** Для отправки формы через FormData */
	name?: string;
	size?: 'default' | 'compact';
	'aria-label'?: string;
	'aria-labelledby'?: string;
	'aria-describedby'?: string;
	/** Переопределение i18n для пустого списка опций */
	emptyLabel?: string;
	/** Переопределение i18n, когда значение не выбрано */
	placeholderLabel?: string;
	/**
	 * Раньше отличал триггер в шапке от полей в карточках; сейчас везде inset как у
	 * {@link getDesktopShellToolbarClusterInsetControlClassName} — проп оставлен для совместимости API.
	 */
	embeddedInToolbarCluster?: boolean;
	/** Вызывается при открытии списка (deferred prefetch в тулбаре кабинета). */
	onOpen?: () => void;
};

/** Layout + focus; граница/фон — из {@link getDesktopShellToolbarClusterInsetControlClassName}. */
const triggerLayout =
	'flex w-full min-w-0 items-center justify-between gap-2 rounded-(--desktop-radius) px-3 text-left outline-none transition-[color,background-color,border-color,box-shadow] duration-150 ' +
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--mc-accent-30)/55 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app) ' +
	'disabled:cursor-not-allowed disabled:opacity-50 scheme-dark';

export function MarketingCabinetSelect({
	value,
	onChange,
	options,
	disabled = false,
	id: idProp,
	className,
	name,
	size = 'default',
	'aria-label': ariaLabel,
	'aria-labelledby': ariaLabelledBy,
	'aria-describedby': ariaDescribedByProp,
	emptyLabel: emptyLabelProp,
	placeholderLabel: placeholderLabelProp,
	embeddedInToolbarCluster: _embeddedInToolbarCluster = false,
	onOpen,
}: MarketingCabinetSelectProps) {
	const { t } = useTranslation('marketing');
	const shellFrame = useDesktopShellFrame();
	const shellSelectSurface =
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame);
	const shellListPanel = getDesktopShellPanelClassName(shellFrame, 'standard');
	const listOptionShell = useMemo(
		() => getDesktopShellSelectListOptionInteractiveClassName(shellFrame),
		[shellFrame]
	);
	const emptyLabel = emptyLabelProp ?? t('marketingCabinetSelect.emptyOptions');
	const placeholderLabel =
		placeholderLabelProp ?? t('marketingCabinetSelect.selectPrompt');
	const autoId = useId();
	const listboxId = `${autoId}-listbox`;
	const triggerId = idProp ?? `${autoId}-trigger`;
	const [open, setOpen] = useState(false);
	const [highlight, setHighlight] = useState(0);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

	const enabledIndices = useMemo(() => {
		const idx: number[] = [];
		options.forEach((o, i) => {
			if (!o.disabled) idx.push(i);
		});
		return idx;
	}, [options]);

	const selectedIndex = useMemo(
		() => options.findIndex((o) => o.value === value),
		[options, value]
	);

	const { triggerLabel, triggerIsPlaceholder } = useMemo(() => {
		if (options.length === 0) {
			return { triggerLabel: emptyLabel, triggerIsPlaceholder: true };
		}
		const hit = options.find((o) => o.value === value);
		if (hit) {
			return { triggerLabel: hit.label, triggerIsPlaceholder: false };
		}
		return { triggerLabel: placeholderLabel, triggerIsPlaceholder: true };
	}, [options, value, emptyLabel, placeholderLabel]);

	const updatePosition = useCallback(() => {
		const el = triggerRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const gap = 6;
		const maxH = Math.min(
			280,
			Math.max(120, window.innerHeight - r.bottom - gap - 16)
		);
		setPanelStyle({
			position: 'fixed',
			top: r.bottom + gap,
			left: r.left,
			width: r.width,
			maxHeight: maxH,
			zIndex: 200,
		});
	}, []);

	useEffect(() => {
		if (!open) return;
		requestAnimationFrame(() => listRef.current?.focus());
	}, [open]);

	useLayoutEffect(() => {
		if (!open) return;
		updatePosition();
		const onWin = () => updatePosition();
		window.addEventListener('resize', onWin);
		window.addEventListener('scroll', onWin, true);
		const ro = triggerRef.current ? new ResizeObserver(updatePosition) : null;
		if (triggerRef.current && ro) ro.observe(triggerRef.current);
		return () => {
			window.removeEventListener('resize', onWin);
			window.removeEventListener('scroll', onWin, true);
			ro?.disconnect();
		};
	}, [open, updatePosition]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (triggerRef.current?.contains(t) || listRef.current?.contains(t))
				return;
			setOpen(false);
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const i = selectedIndex >= 0 ? selectedIndex : (enabledIndices[0] ?? 0);
		setHighlight(i);
	}, [open, selectedIndex, enabledIndices]);

	const pick = useCallback(
		(idx: number) => {
			const opt = options[idx];
			if (!opt || opt.disabled) return;
			onChange(opt.value);
			setOpen(false);
			triggerRef.current?.focus();
		},
		[onChange, options]
	);

	const toggleOpen = useCallback(() => {
		if (disabled) return;
		setOpen((wasOpen) => {
			if (!wasOpen) onOpen?.();
			return !wasOpen;
		});
	}, [disabled, onOpen]);

	const onKeyDownTrigger = (e: React.KeyboardEvent) => {
		if (disabled) return;
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleOpen();
		}
	};

	const onKeyDownList = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			setOpen(false);
			triggerRef.current?.focus();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			let next = highlight + 1;
			while (next < options.length && options[next]?.disabled) next++;
			if (next < options.length) setHighlight(next);
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			let prev = highlight - 1;
			while (prev >= 0 && options[prev]?.disabled) prev--;
			if (prev >= 0) setHighlight(prev);
			return;
		}
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			pick(highlight);
		}
	};

	const triggerSize = size === 'compact' ? 'h-9 px-2 text-xs' : 'h-10 text-sm';
	const portalMount = open
		? getMarketingCabinetPortalRoot(triggerRef.current)
		: null;

	const panel = open
		? createPortal(
				<div
					ref={listRef}
					id={listboxId}
					data-marketing-cabinet-shell
					data-mc-select-panel
					role="listbox"
					tabIndex={0}
					style={panelStyle}
					onKeyDown={onKeyDownList}
					data-desktop-window-ignore-context
					aria-activedescendant={
						options.length > 0 && options[highlight]
							? `${listboxId}-opt-${highlight}`
							: undefined
					}
					className={cn(
						shellListPanel,
						'flex max-h-[inherit] min-h-0 flex-col overflow-y-auto overflow-x-hidden py-1 text-(--desktop-text-primary) scheme-dark',
						'ring-1 ring-black/20',
						'outline-none focus-visible:ring-2 focus-visible:ring-(--mc-accent-35)/60 focus-visible:ring-offset-0'
					)}
				>
					{options.length === 0 ? (
						<div
							role="presentation"
							className={cn(
								'select-none px-3 py-3 text-center text-(--desktop-text-muted)',
								size === 'compact' ? 'text-xs' : 'text-sm'
							)}
						>
							{emptyLabel}
						</div>
					) : (
						options.map((opt, idx) => {
							const selected = opt.value === value;
							const hi = idx === highlight;
							return (
								<button
									key={String(opt.value)}
									type="button"
									id={`${listboxId}-opt-${idx}`}
									role="option"
									aria-selected={selected}
									disabled={opt.disabled}
									title={opt.description}
									className={cn(
										'flex w-full items-center gap-2 px-3 text-left text-(--desktop-text-primary) transition-colors',
										size === 'compact' ? 'py-1.5 text-xs' : 'py-2.5 text-sm',
										listOptionShell.hoverFocus,
										'focus:outline-none',
										'focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--mc-accent-35)/45',
										'disabled:pointer-events-none disabled:opacity-40',
										hi && !selected && listOptionShell.highlight,
										selected &&
											'bg-(--mc-accent-12) text-(--desktop-text-primary)'
									)}
									onMouseEnter={() => setHighlight(idx)}
									onClick={() => pick(idx)}
								>
									<span className="flex h-4 w-4 shrink-0 items-center justify-center">
										{selected ? (
											<CheckIcon
												className="h-3.5 w-3.5 text-(--mc-accent)"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
										) : null}
									</span>
									<span className="min-w-0 flex-1 truncate">{opt.label}</span>
								</button>
							);
						})
					)}
				</div>,
				portalMount ?? document.body
			)
		: null;

	return (
		<div className={cn('relative w-full min-w-0', className)}>
			{name ? (
				<input
					type="hidden"
					name={name}
					value={value}
					readOnly
					tabIndex={-1}
					aria-hidden
				/>
			) : null}
			<button
				ref={triggerRef}
				type="button"
				id={triggerId}
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={open ? listboxId : undefined}
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
				aria-describedby={ariaDescribedByProp}
				className={cn(
					triggerLayout,
					shellSelectSurface,
					triggerSize,
					triggerIsPlaceholder
						? 'text-(--desktop-text-muted)'
						: 'text-(--desktop-text-primary)',
					open &&
						'border-[rgb(var(--desktop-accent-rgb)/0.38)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
				)}
				onClick={toggleOpen}
				onKeyDown={onKeyDownTrigger}
			>
				<span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
				<ChevronDownIcon
					className={cn(
						'h-4 w-4 shrink-0 text-(--desktop-text-muted) transition-transform duration-200 ease-out',
						open && 'rotate-180'
					)}
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</button>
			{panel}
		</div>
	);
}
