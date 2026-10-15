/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overflow menu: archive / clear / delete — Shell portal (не режется overflow окна).
 *
 * Invariants:
 * - Floating UI via useShellPortal only (no createPortal / FloatingPortal adapter).
 *
 * Related:
 * - pages/Desktop/shell/shellPortal.tsx
 */
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton, menuItemVariants } from '../DesktopAppChrome';
import { GafChatDesktopIconTooltip } from './gafChatDesktopIconTooltip';
import { useDesktopShellFrame } from '../../context/DesktopShellFrameContext';
import {
	ArchiveBoxIcon,
	BackspaceIcon,
	EllipsisHorizontalIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

import {
	getDesktopShellToolbarClusterInsetControlClassName,
	getGafChatOverflowMenuSurfaceClassName,
} from '../../utils/desktopVisualSystem';

export interface GAFChatChatActionsMenuProps {
	disabled: boolean;
	onClear: () => void;
	onArchive: () => void;
	onDelete: () => void;
}

const MENU_MIN_W = 224;
const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GAFChatChatActionsMenu({
	disabled,
	onClear,
	onArchive,
	onDelete,
}: GAFChatChatActionsMenuProps) {
	const { t } = useTranslation('gafChat');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const { Portal } = useShellPortal({
		layer: 'shell_global',
		dismissOnEscape: false,
		trapFocus: false,
	});
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const menuPanelRef = useRef<HTMLDivElement | null>(null);
	const menuId = useId();
	const shellFrame = useDesktopShellFrame();
	const btnClass = cn(
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		'shrink-0'
	);

	const [menuPos, setMenuPos] = useState<{
		top: number;
		left: number;
		width: number;
	} | null>(null);

	const close = useCallback(() => setOpen(false), []);

	const updatePosition = useCallback(() => {
		const el = anchorRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const w = Math.max(MENU_MIN_W, r.width);
		let left = r.right - w;
		const margin = 8;
		if (left < margin) left = margin;
		if (left + w > window.innerWidth - margin) {
			left = window.innerWidth - w - margin;
		}
		const top = r.bottom + 4;
		setMenuPos({ top, left, width: w });
	}, []);

	useLayoutEffect(() => {
		if (!open || disabled) {
			setMenuPos(null);
			return;
		}
		updatePosition();
		const onScrollOrResize = () => updatePosition();
		window.addEventListener('resize', onScrollOrResize);
		window.addEventListener('scroll', onScrollOrResize, true);
		return () => {
			window.removeEventListener('resize', onScrollOrResize);
			window.removeEventListener('scroll', onScrollOrResize, true);
		};
	}, [open, disabled, updatePosition]);

	useLayoutEffect(() => {
		const el = menuPanelRef.current;
		if (!el || !menuPos) return;
		el.style.setProperty('top', `${menuPos.top}px`);
		el.style.setProperty('left', `${menuPos.left}px`);
		el.style.setProperty('width', `${menuPos.width}px`);
		el.style.setProperty('z-index', String(portalStackBase));
	}, [menuPos, portalStackBase]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (anchorRef.current?.contains(t) || menuPanelRef.current?.contains(t)) {
				return;
			}
			close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('mousedown', onDoc, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc, true);
			document.removeEventListener('keydown', onKey);
		};
	}, [open, close]);

	const menuSurfaceClass = cn(
		getGafChatOverflowMenuSurfaceClassName(shellFrame),
		'min-w-[220px] py-0 text-(--desktop-text-primary)',
		/** Иконки в строке — чуть компактнее стандартных h-7 в меню. */
		'[&_span[aria-hidden=true]]:!h-6 [&_span[aria-hidden=true]]:!w-6'
	);
	const menuScrollClass =
		'max-h-[min(70vh,420px)] overflow-y-auto overflow-x-hidden';

	const menuContent =
		open && !disabled && menuPos && typeof document !== 'undefined' ? (
			<div
				ref={menuPanelRef}
				id={menuId}
				data-empery-gaf-overflow="1"
				className={cn(
					'fixed outline-none focus:outline-none',
					menuSurfaceClass
				)}
			>
				<div
					id={`${menuId}-heading`}
					role="presentation"
					className="border-b border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_40%,transparent)] px-2.5 py-1.5"
				>
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.shellMeta10,
							'font-semibold uppercase tracking-wide text-[rgb(var(--desktop-accent-rgb))]'
						)}
					>
						{t('chatActionsMenuTitle')}
					</span>
				</div>
				<div
					role="menu"
					aria-labelledby={`${menuId}-heading`}
					className={cn(menuScrollClass, 'py-1')}
				>
					{/* Нативные `button role="menuitem"` — статический axe видит детей `role="menu"`. */}
					<GafChatDesktopIconTooltip content={t('clearHistory')}>
						<button
							type="button"
							role="menuitem"
							className={cn(menuItemVariants({ tone: 'default' }), 'py-1.5')}
							onClick={() => {
								close();
								onClear();
							}}
						>
							<span className="flex min-w-0 flex-1 items-center gap-3">
								<span
									className={cn(
										'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-(--desktop-surface-soft) text-(--desktop-text-muted) [&_svg]:stroke-[1.35]'
									)}
									aria-hidden
								>
									<BackspaceIcon
										className="h-3.5 w-3.5"
										strokeWidth={LUCIDE_SW}
									/>
								</span>
								<span className="truncate">
									<span className="hidden sm:inline">{t('clearHistory')}</span>
									<span className="sm:hidden">{t('clearHistoryShort')}</span>
								</span>
							</span>
						</button>
					</GafChatDesktopIconTooltip>
					<GafChatDesktopIconTooltip content={t('archiveChat')}>
						<button
							type="button"
							role="menuitem"
							className={cn(menuItemVariants({ tone: 'default' }), 'py-1.5')}
							onClick={() => {
								close();
								onArchive();
							}}
						>
							<span className="flex min-w-0 flex-1 items-center gap-3">
								<span
									className={cn(
										'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-(--desktop-surface-soft) text-(--desktop-text-muted) [&_svg]:stroke-[1.35]'
									)}
									aria-hidden
								>
									<ArchiveBoxIcon
										className="h-3.5 w-3.5"
										strokeWidth={LUCIDE_SW}
									/>
								</span>
								<span className="truncate">
									<span className="hidden sm:inline">{t('archiveChat')}</span>
									<span className="sm:hidden">{t('archiveChatShort')}</span>
								</span>
							</span>
						</button>
					</GafChatDesktopIconTooltip>
					<hr
						className="mx-2 my-1 h-px shrink-0 border-0 border-t border-[color-mix(in_srgb,var(--desktop-border-menu)_35%,transparent)]"
						aria-orientation="horizontal"
					/>
					<GafChatDesktopIconTooltip content={t('deleteForBoth')}>
						<button
							type="button"
							role="menuitem"
							className={cn(menuItemVariants({ tone: 'danger' }), 'py-1.5')}
							onClick={() => {
								close();
								onDelete();
							}}
						>
							<span className="flex min-w-0 flex-1 items-center gap-3">
								<span
									className={cn(
										'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,rgb(239_68_68)_10%,var(--desktop-surface-soft))] text-[color-mix(in_srgb,rgb(248_113_113)_65%,var(--desktop-text-muted))] [&_svg]:stroke-[1.35]'
									)}
									aria-hidden
								>
									<TrashIcon className="h-3.5 w-3.5" strokeWidth={LUCIDE_SW} />
								</span>
								<span className="truncate">
									<span className="hidden md:inline">{t('deleteForBoth')}</span>
									<span className="md:hidden">{t('deleteForBothShort')}</span>
								</span>
							</span>
						</button>
					</GafChatDesktopIconTooltip>
				</div>
			</div>
		) : null;

	return (
		<div className="inline-flex shrink-0" ref={anchorRef}>
			<GafChatDesktopIconTooltip content={t('chatActionsMenuTitle')}>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={disabled}
					className={cn(btnClass, 'touch-manipulation gap-1 px-1.5 py-1')}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-controls={open ? menuId : undefined}
					onClick={() => setOpen((o) => !o)}
					aria-label={t('chatActionsMenuAria')}
				>
					<EllipsisHorizontalIcon
						className="h-3.5 w-3.5 shrink-0 opacity-90"
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
					<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
						{t('chatActionsMenuShort')}
					</span>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
			{menuContent ? <Portal>{menuContent}</Portal> : null}
		</div>
	);
}
