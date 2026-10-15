/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal dialogs used by the Music Player (playlist naming and keyboard shortcuts help).
 *
 * Invariants:
 * - Dialogs close on Escape and block background interaction while open.
 * - Keyboard shortcuts help reflects actual key handling in MusicPlayerPage.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import { cn } from '@/lib/utils';
import * as React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSurface,
} from '../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../Desktop/context/DesktopWindowPortalStackContext';

const SHORTCUT_ITEM_IDS = [
	'space',
	'seek',
	'volume',
	'repeat',
	'shuffle',
	'search',
	'seekStep',
	'media',
	'favorite',
] as const;

export const PlaylistNameDialog = memo(function PlaylistNameDialog({
	open,
	titleId,
	title,
	description,
	playlistNameDraft,
	onDraftChange,
	onCancel,
	onConfirm,
	canConfirm,
	confirmLabel,
	placeholder = '',
	validationMessage = null,
}: {
	open: boolean;
	titleId: string;
	title: string;
	description: string;
	playlistNameDraft: string;
	onDraftChange: (value: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
	canConfirm: boolean;
	confirmLabel: string;
	placeholder?: string;
	validationMessage?: string | null;
}): React.ReactNode {
	const { t } = useTranslation('desktopUi');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!open) return null;

	return (
		<div
			className={cn(DESKTOP_APP_STYLE_CONTRACT.modalBackdrop, 'p-4')}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			onClick={onCancel}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onCancel();
			}}
		>
			<div
				role="document"
				tabIndex={-1}
				className="w-full max-w-md outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40"
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			>
				<DesktopAppSurface variant="panelStrong" padding="lg">
					<h2
						id={titleId}
						className="text-base font-semibold text-(--desktop-text-primary)"
					>
						{title}
					</h2>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.small,
							'mt-1 text-(--desktop-text-secondary)'
						)}
					>
						{description}
					</p>
					<DesktopAppInput
						autoFocus
						value={playlistNameDraft}
						onChange={(e) => onDraftChange(e.target.value)}
						placeholder={placeholder}
						className="mt-4"
						onKeyDown={(e) => {
							if (e.key === 'Enter' && canConfirm) {
								e.preventDefault();
								onConfirm();
							}
						}}
					/>
					{validationMessage ? (
						<p className="mt-2 text-[11px] text-amber-300">
							{validationMessage}
						</p>
					) : null}
					<div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-(--desktop-border-subtle) pt-4">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="md"
							onClick={onCancel}
						>
							{t('musicPlayer.playlistDialog.cancel')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="md"
							disabled={!canConfirm}
							onClick={onConfirm}
						>
							{confirmLabel}
						</DesktopAppButton>
					</div>
				</DesktopAppSurface>
			</div>
		</div>
	);
});

export const KeyboardShortcutsHelpModal = memo(
	function KeyboardShortcutsHelpModal({
		open,
		titleId,
		onClose,
	}: {
		open: boolean;
		titleId: string;
		onClose: () => void;
	}): React.ReactNode {
		const { t } = useTranslation('desktopUi');
		const embeddedModalZ = useEmbeddedPortaledModalZIndex();
		if (!open) return null;

		return (
			<div
				className={cn(DESKTOP_APP_STYLE_CONTRACT.modalBackdrop, 'p-4')}
				style={{ zIndex: embeddedModalZ.backdrop }}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === 'Escape') onClose();
				}}
			>
				<div
					role="document"
					tabIndex={-1}
					className="w-full max-w-md outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40"
					style={{ zIndex: embeddedModalZ.content }}
					onClick={(event) => event.stopPropagation()}
					onKeyDown={(event) => event.stopPropagation()}
				>
					<DesktopAppSurface variant="panelStrong" padding="lg">
						<h2
							id={titleId}
							className="text-base font-semibold text-(--desktop-text-primary)"
						>
							{t('musicPlayer.shortcutsModal.title')}
						</h2>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.small,
								'mt-1 text-(--desktop-text-secondary)'
							)}
						>
							{t('musicPlayer.shortcutsModal.hint')}
						</p>
						<ul
							className={cn(
								DESKTOP_TYPOGRAPHY.small,
								'mt-4 list-none space-y-2.5 text-(--desktop-text-secondary)'
							)}
						>
							{SHORTCUT_ITEM_IDS.map((itemId) => (
								<li key={itemId}>
									<span className="font-medium text-(--desktop-text-primary)">
										{t(`musicPlayer.shortcutsModal.items.${itemId}.keys`)}
									</span>{' '}
									— {t(`musicPlayer.shortcutsModal.items.${itemId}.desc`)}
								</li>
							))}
						</ul>
						<div className="mt-5 flex justify-end border-t border-(--desktop-border-subtle) pt-4">
							<DesktopAppButton
								type="button"
								variant="accent"
								size="md"
								onClick={onClose}
							>
								{t('musicPlayer.shortcutsModal.close')}
							</DesktopAppButton>
						</div>
					</DesktopAppSurface>
				</div>
			</div>
		);
	}
);
