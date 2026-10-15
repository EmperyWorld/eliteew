/**
 * Мини-настройки текущего диалога (локально на устройстве, на пользователя + чат).
 * Панель в document.body (fixed), чтобы не перекрывалась лентой и не ловила ложные «клик снаружи».
 */
import { cn } from '@/utils/cn';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useDesktopShellFrame } from '../../../context/DesktopShellFrameContext';
import { getDesktopShellFloatingSurfaceClassName } from '../../../utils/desktopVisualSystem';
import { DesktopAppButton } from '../../DesktopAppChrome';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import type { GafChatThreadPrefs } from '../gafChatThreadPrefs';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

const LUCIDE_SW = DESKTOP_LUCIDE.stroke;

export function GafChatThreadSettingsPopover({
	prefs,
	onChange,
	disabled,
}: {
	prefs: GafChatThreadPrefs;
	onChange: (next: GafChatThreadPrefs) => void;
	disabled?: boolean;
}): JSX.Element {
	const { t } = useTranslation('gafChat');
	const shellFrame = useDesktopShellFrame();
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const baseId = useId();

	const [panelPos, setPanelPos] = useState<{
		top: number;
		left: number;
		width: number;
	} | null>(null);

	const updatePosition = useCallback(() => {
		const el = anchorRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const margin = 8;
		const panelW = Math.min(window.innerWidth - 2 * margin, 288);
		let left = r.right - panelW;
		if (left < margin) left = margin;
		if (left + panelW > window.innerWidth - margin) {
			left = window.innerWidth - panelW - margin;
		}
		setPanelPos({ top: r.bottom + 4, left, width: panelW });
	}, []);

	useLayoutEffect(() => {
		if (!open) {
			setPanelPos(null);
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
	}, [open, updatePosition]);

	/** Capture mousedown: панель в портале — учитываем panelRef. */
	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				anchorRef.current?.contains(target) ||
				panelRef.current?.contains(target)
			) {
				return;
			}
			setOpen(false);
		};
		document.addEventListener('mousedown', onDoc, true);
		return () => document.removeEventListener('mousedown', onDoc, true);
	}, [open]);

	const panelPortal =
		open && panelPos && typeof document !== 'undefined' ? (
			<div
				ref={panelRef}
				id={`${baseId}-panel`}
				role="dialog"
				aria-label={t('threadSettingsTitle')}
				className={cn(
					'fixed rounded-(--desktop-radius-lg) p-2.5',
					getDesktopShellFloatingSurfaceClassName(shellFrame),
					'shadow-lg ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.12)]'
				)}
				style={{
					top: panelPos.top,
					left: panelPos.left,
					width: panelPos.width,
					zIndex: portalStackBase,
				}}
				onPointerDown={(e) => e.stopPropagation()}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.shellMeta10,
						'mb-2 font-semibold uppercase tracking-wide text-(--desktop-text-muted)'
					)}
				>
					{t('threadSettingsHeading')}
				</p>
				<label className="flex cursor-pointer items-start gap-2 py-1.5">
					<input
						type="checkbox"
						className="mt-0.5 h-4 w-4 accent-[rgb(var(--desktop-accent-rgb))]"
						checked={prefs.showMediaPreview}
						onChange={(e) =>
							onChange({ ...prefs, showMediaPreview: e.target.checked })
						}
					/>
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-primary)'
						)}
					>
						{t('threadSettingsShowPreview')}
					</span>
				</label>
				<label className="flex cursor-pointer items-start gap-2 py-1.5">
					<input
						type="checkbox"
						className="mt-0.5 h-4 w-4 accent-[rgb(var(--desktop-accent-rgb))]"
						checked={prefs.loadMedia}
						onChange={(e) =>
							onChange({ ...prefs, loadMedia: e.target.checked })
						}
					/>
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-primary)'
						)}
					>
						{t('threadSettingsLoadMedia')}
					</span>
				</label>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'mt-2 text-(--desktop-text-dim)'
					)}
				>
					{t('threadSettingsHint')}
				</p>
			</div>
		) : null;

	return (
		<div className="relative shrink-0" ref={anchorRef}>
			<GafChatDesktopIconTooltip content={t('threadSettingsTitle')}>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7 shrink-0 touch-manipulation"
					disabled={disabled}
					aria-expanded={open}
					aria-controls={`${baseId}-panel`}
					aria-label={t('threadSettingsAria')}
					onClick={() => setOpen((v) => !v)}
				>
					<AdjustmentsHorizontalIcon
						className="h-3.5 w-3.5"
						aria-hidden
						strokeWidth={LUCIDE_SW}
					/>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
			{panelPortal ? <ShellPortalMount>{panelPortal}</ShellPortalMount> : null}
		</div>
	);
}
