/**
 * ПКМ по строке документа в менеджере файлов редактора.
 */
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDocEditorContextMenuZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppContextMenuTitle,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	getContextMenuPositionFromCursor,
	getDesktopPortalShellProps,
} from '@/pages/Desktop/utils/desktopUi';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { m, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useId, useRef } from 'react';
import {
	ClipboardDocumentCheckIcon,
	DocumentTextIcon,
	SparklesIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;
/** Ширина под длинные названия; позиция всё равно клампится к вьюпорту */
const MENU_W = 248;
/** Заголовок + до 4 пунктов + разделитель; запас для safe-area */
const MENU_H = 280;

/** Outer motion node: positioning only (Framer `m.*` is not always seen as `role="menu"` by static a11y checks). */
const motionShellClass = cn('fixed origin-top-left select-none');
/** Inner surface: actual `menu` landmark and click-outside ref. */
const menuSurfaceClass = cn(
	'flex min-w-[14rem] max-w-[min(100vw-16px,20rem)] flex-col gap-0.5 overflow-hidden rounded-(--desktop-radius) p-1',
	'border border-(--desktop-border-menu)',
	'bg-(--desktop-surface-panel-strong)/96 shadow-(--desktop-shadow-soft) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.12)] backdrop-blur-md'
);

const menuItemClass = cn(
	'flex w-full min-h-[2.25rem] items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
	DESKTOP_TYPOGRAPHY.shellCopy13,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	'outline-none active:bg-(--desktop-surface-soft-active) active:transition-none'
);

const menuIconClass = 'h-4 w-4 shrink-0';

export function FileManagerDocContextMenu({
	open,
	anchor,
	documentTitle,
	onClose,
	onOpen,
	onAskAi,
	onToggleSelect,
	onDelete,
	isCurrent,
	isSelected,
}: {
	open: boolean;
	anchor: { clientX: number; clientY: number } | null;
	/** Строка в шапке меню (какой документ затронут) */
	documentTitle: string | null;
	onClose: () => void;
	onOpen: () => void;
	onAskAi: () => void;
	onToggleSelect: () => void;
	onDelete: () => void;
	isCurrent: boolean;
	isSelected: boolean;
}): React.ReactElement | null {
	const { t } = useTranslation('ultimateDocEditor');
	const contextMenuZ = useDocEditorContextMenuZIndex();
	const menuRef = useRef<HTMLDivElement | null>(null);
	const baseId = useId();
	const reduceMotion = useReducedMotion();

	const pos =
		open && anchor
			? getContextMenuPositionFromCursor({
					clientX: anchor.clientX,
					clientY: anchor.clientY,
					menuWidth: MENU_W,
					menuHeight: MENU_H,
				})
			: null;

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const el = e.target as Node;
			if (menuRef.current?.contains(el)) return;
			onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('mousedown', onDoc, true);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc, true);
			document.removeEventListener('keydown', onKey);
		};
	}, [open, onClose]);

	if (!open || !pos || typeof document === 'undefined') return null;

	const titleText = documentTitle?.trim() ?? '';

	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	const portal = (
		<m.div
			className={motionShellClass}
			style={{
				top: pos.y,
				left: pos.x,
				width: MENU_W,
				zIndex: contextMenuZ,
			}}
			onPointerDown={(e) => e.stopPropagation()}
			initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{
				duration: reduceMotion ? 0 : 0.14,
				ease: [0.16, 1, 0.3, 1],
			}}
		>
			<div
				ref={menuRef}
				id={`${baseId}-file-manager-doc-ctx`}
				role="menu"
				aria-label={t('fileManager.contextMenu.menuAria')}
				aria-orientation="vertical"
				className={menuSurfaceClass}
			>
				{titleText ? (
					<DesktopAppContextMenuTitle className="min-w-0 truncate">
						<span className="block truncate" title={titleText}>
							{titleText}
						</span>
					</DesktopAppContextMenuTitle>
				) : null}
				<button
					type="button"
					role="menuitem"
					className={cn(
						menuItemClass,
						'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => {
						onClose();
						onOpen();
					}}
				>
					<DocumentTextIcon
						className={cn(menuIconClass, 'text-(--desktop-text-muted)')}
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
					<span className="min-w-0 flex-1 leading-snug">
						{t('fileManager.contextMenu.open')}
					</span>
				</button>
				<button
					type="button"
					role="menuitem"
					className={cn(
						menuItemClass,
						'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => {
						onClose();
						onAskAi();
					}}
				>
					<SparklesIcon
						className={cn(menuIconClass, 'text-purple-300/90')}
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
					<span className="min-w-0 flex-1 leading-snug">
						{t('fileManager.contextMenu.askAi')}
					</span>
				</button>
				<button
					type="button"
					role="menuitem"
					className={cn(
						menuItemClass,
						'text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)'
					)}
					onClick={() => {
						onClose();
						onToggleSelect();
					}}
				>
					<ClipboardDocumentCheckIcon
						className={cn(
							menuIconClass,
							isSelected ? 'text-emerald-400/95' : 'text-(--desktop-text-muted)'
						)}
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
					<span className="min-w-0 flex-1 leading-snug">
						{isSelected
							? t('fileManager.contextMenu.deselect')
							: t('fileManager.contextMenu.select')}
					</span>
				</button>
				{!isCurrent ? (
					<>
						<hr
							className="mx-1 my-0.5 h-px shrink-0 border-0 bg-(--desktop-border-subtle)"
							aria-hidden
						/>
						<button
							type="button"
							role="menuitem"
							className={cn(
								menuItemClass,
								'text-red-200 hover:bg-red-500/15 active:bg-red-500/20'
							)}
							onClick={() => {
								onClose();
								onDelete();
							}}
						>
							<TrashIcon
								className={cn(menuIconClass, 'text-red-300/90')}
								aria-hidden
								strokeWidth={LUCIDE_SW}
							/>
							<span className="min-w-0 flex-1 leading-snug">
								{t('fileManager.contextMenu.delete')}
							</span>
						</button>
					</>
				) : null}
			</div>
		</m.div>
	);

	return (
		<ShellPortalMount>
			<div
				style={portalShellStyle}
				className={portalTheme === 'dark' ? 'dark' : ''}
			>
				{portal}
			</div>
		</ShellPortalMount>
	);
}
