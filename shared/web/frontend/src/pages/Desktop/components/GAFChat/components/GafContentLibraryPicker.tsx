/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Modal shell for choosing one file from the user's Content Manager library to attach in GAF Chat.
 *
 * Invariants:
 * - Rendered in a portal above the chat window (`DESKTOP_Z_INDEX.GAF_CONTENT_LIBRARY_BACKDROP`).
 * - Selection body is `GafContentLibraryPickerPanel` (single file, GAF i18n).
 *
 * Related:
 * - GAFChatApp.tsx; GafContentLibraryPickerPanel.tsx
 */
import type { Content } from '@/components/UnifiedContent/types';
import { DesktopAppModalFrame } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY, DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { useSyncDesktopThemeFromMain } from '@/pages/Desktop/hooks/useSyncDesktopThemeFromMain';
import { cn } from '@/utils/cn';
import type { ReactElement } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GafContentLibraryPickerPanel } from './GafContentLibraryPickerPanel';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export interface GafContentLibraryPickerProps {
	isOpen: boolean;
	onClose: () => void;
	/** Выбран файл из библиотеки (один). */
	onPick: (file: Content) => void;
}

export function GafContentLibraryPicker({
	isOpen,
	onClose,
	onPick,
}: GafContentLibraryPickerProps): ReactElement | null {
	const { t } = useTranslation('gafChat');
	const portalSurfaceRef = useRef<HTMLDivElement>(null);

	useSyncDesktopThemeFromMain(isOpen, portalSurfaceRef);

	const handlePick = (file: Content) => {
		onPick(file);
		onClose();
	};

	if (!isOpen || typeof document === 'undefined') {
		return null;
	}

	return (
		<ShellPortalMount>
			<div
				ref={portalSurfaceRef}
				className={cn(
					'fixed inset-0 flex items-center justify-center p-3 sm:p-4',
					'text-(--desktop-text-primary)',
					DESKTOP_OVERLAY.backdrop
				)}
				style={{ zIndex: DESKTOP_Z_INDEX.GAF_CONTENT_LIBRARY_BACKDROP }}
				role="presentation"
			>
				<button
					type="button"
					className="absolute inset-0 cursor-default border-0 bg-transparent"
					aria-label={t('libraryPickerCancel')}
					onClick={onClose}
				/>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: stop backdrop close on panel click */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only stopPropagation */}
				<div
					className="relative flex max-h-[min(94vh,920px)] w-full max-w-6xl min-h-0 flex-col"
					style={{ zIndex: DESKTOP_Z_INDEX.GAF_INNER_BASE }}
					onClick={(e) => e.stopPropagation()}
				>
					<DesktopAppModalFrame
						title={t('libraryPickerTitle')}
						onClose={onClose}
						closeLabel={t('libraryPickerCancel')}
						className="flex max-h-[min(94vh,920px)] min-h-[min(72vh,640px)] w-full max-w-6xl flex-col shadow-(--desktop-shadow-panel)"
					>
						<GafContentLibraryPickerPanel
							enabled={isOpen}
							onCancel={onClose}
							onPick={handlePick}
						/>
					</DesktopAppModalFrame>
				</div>
			</div>
		</ShellPortalMount>
	);
}
