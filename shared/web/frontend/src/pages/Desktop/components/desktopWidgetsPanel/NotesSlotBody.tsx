/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Notes widget slot body with compact summary and local-only banners.
 *
 * Invariants:
 * - Data from useWidgetNotes hook only.
 *
 * Related:
 * - useWidgetNotesTodos.ts
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { useWidgetNotes } from '../../hooks/useWidgetNotesTodos';

export function NotesSlotBody({ compact }: { compact: boolean }) {
	const { t } = useTranslation('desktopUi');
	const { t: tWorkspace } = useTranslation('desktopUi', {
		keyPrefix: 'workspace',
	});
	const { notes, isLoading, isLocalOnly, storageWriteFailed } =
		useWidgetNotes();

	const localOnlyBanner = isLocalOnly ? (
		<p
			className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-(--desktop-text-dim)')}
			data-local-only="true"
		>
			{tWorkspace('localOnlyHint')}
		</p>
	) : null;
	const storageFailedBanner = storageWriteFailed ? (
		<p
			className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-(--desktop-text-dim)')}
			role="alert"
		>
			{tWorkspace('localStorageWriteFailed')}
		</p>
	) : null;

	if (isLoading && notes.length === 0) {
		return (
			<div
				className="flex flex-col gap-1.5"
				data-local-only={isLocalOnly ? 'true' : undefined}
			>
				{localOnlyBanner}
				{storageFailedBanner}
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('settingsPanel.widgetsPanel.loading')}
				</p>
			</div>
		);
	}
	if (notes.length === 0) {
		return (
			<div
				className="flex flex-col gap-1.5"
				data-local-only={isLocalOnly ? 'true' : undefined}
			>
				{localOnlyBanner}
				{storageFailedBanner}
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('settingsPanel.widgetsPanel.notesEmpty')}
				</p>
			</div>
		);
	}
	if (compact) {
		const preview = notes[0]?.content?.trim().slice(0, 80) ?? '';
		return (
			<div
				className="flex flex-col gap-1.5"
				data-local-only={isLocalOnly ? 'true' : undefined}
			>
				{localOnlyBanner}
				{storageFailedBanner}
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'line-clamp-2 text-(--desktop-text-secondary)'
					)}
				>
					{t('settingsPanel.widgetsPanel.notesSummary', {
						count: notes.length,
						preview,
					})}
				</p>
			</div>
		);
	}
	return (
		<div
			className="flex flex-col gap-1.5"
			data-local-only={isLocalOnly ? 'true' : undefined}
		>
			{localOnlyBanner}
			{storageFailedBanner}
			<ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
				{notes.slice(0, 6).map((n) => (
					<li
						key={n.id}
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'wrap-break-word rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 text-(--desktop-text-secondary)'
						)}
					>
						{n.content?.trim() || t('settingsPanel.widgetsPanel.emptyNote')}
					</li>
				))}
			</ul>
		</div>
	);
}
