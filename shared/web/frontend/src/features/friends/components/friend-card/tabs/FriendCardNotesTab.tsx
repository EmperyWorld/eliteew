/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the owner-scoped note draft and its explicit save action.
 *
 * Invariants:
 * - Draft edits are never persisted until the save callback is invoked.
 *
 * Related:
 * - ../../FriendPersonCard.tsx
 * ---
 */

import type { TFunction } from 'i18next';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppStatusBadge,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';

import type { FriendProfile } from '../friendPersonCardTypes';

type Props = {
	t: TFunction;
	friend: FriendProfile;
	saving: boolean;
	draftNote: string;
	noteTextareaClass: string;
	onSaveNote?: (friend: FriendProfile, note: string) => void;
	setDraftNote: (value: string) => void;
};

export function FriendCardNotesTab({
	t,
	friend,
	saving,
	draftNote,
	noteTextareaClass,
	onSaveNote,
	setDraftNote,
}: Props): JSX.Element {
	const savedNoteText = (friend.private_note ?? '').trim();
	const draftNoteText = draftNote.trim();
	const changed = savedNoteText !== draftNoteText;
	return (
		<div>
			<div className="mb-3 flex items-center gap-2">
				<DocumentTextIcon className="h-4 w-4 text-cyan-400" aria-hidden />
				<h4>{t('friends.privateNoteTitle')}</h4>
			</div>
			<textarea
				aria-label={t('friends.privateNoteTitle')}
				value={draftNote}
				onChange={(event) => setDraftNote(event.target.value)}
				placeholder={t('friends.privateNotePlaceholder')}
				className={noteTextareaClass}
			/>
			{!draftNoteText && !savedNoteText ? (
				<DesktopProductStatusBanner
					tone="neutral"
					className="mt-3 rounded-xl"
					title={t('friends.privateNoteEmptyTitle')}
					description={t('friends.privateNoteEmptyDescription')}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={() => setDraftNote(t('friends.privateNoteStarterText'))}
						>
							{t('friends.privateNoteStarterAction')}
						</DesktopAppButton>
					}
				/>
			) : null}
			<div className="mt-3 flex items-center justify-between gap-3">
				<DesktopAppStatusBadge
					className={
						changed
							? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
							: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)'
					}
				>
					{changed
						? t('friends.privateNoteDraftChanged')
						: savedNoteText
							? t('friends.privateNoteSavedState')
							: t('friends.privateNoteNoSavedState')}
				</DesktopAppStatusBadge>
				<DesktopAppButton
					type="button"
					variant="accent"
					onClick={() => onSaveNote?.(friend, draftNote)}
					disabled={saving || !changed}
				>
					{saving ? (
						<ArrowPathIcon
							className="h-4 w-4 animate-spin motion-reduce:animate-none"
							aria-hidden
						/>
					) : null}
					{t('friends.privateNoteSave')}
				</DesktopAppButton>
			</div>
		</div>
	);
}
