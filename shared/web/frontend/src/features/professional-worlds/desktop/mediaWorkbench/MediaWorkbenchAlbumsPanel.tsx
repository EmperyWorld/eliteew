/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing-scoped album gallery: list, rename, create, and open delete confirm.
 *
 * Invariants:
 * - Empty gallery shows explicit empty state + reload control.
 * - Rename/create require non-empty trimmed titles.
 *
 * Related:
 * - useProfessionalMediaWorkbench.ts
 */

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { ReactElement } from 'react';
import type { ProfessionalMediaAlbum } from '../types';
import type { ProfessionalMediaWorkbenchModel } from './useProfessionalMediaWorkbench';

type AlbumsPanelProps = {
	readonly model: Pick<
		ProfessionalMediaWorkbenchModel,
		| 't'
		| 'albums'
		| 'albumsPending'
		| 'galleryScopeLabel'
		| 'albumTitleDraft'
		| 'setAlbumTitleDraft'
		| 'albumRenameId'
		| 'setAlbumRenameId'
		| 'albumRenameDraft'
		| 'setAlbumRenameDraft'
		| 'setAlbumDeleteId'
		| 'setAlbumDeleteTitle'
		| 'reloadAlbums'
		| 'createAlbumQuick'
		| 'renameAlbum'
	>;
};

export function MediaWorkbenchAlbumsPanel({
	model,
}: AlbumsPanelProps): ReactElement {
	const {
		t,
		albums,
		albumsPending,
		galleryScopeLabel,
		albumTitleDraft,
		setAlbumTitleDraft,
		albumRenameId,
		setAlbumRenameId,
		albumRenameDraft,
		setAlbumRenameDraft,
		setAlbumDeleteId,
		setAlbumDeleteTitle,
		reloadAlbums,
		createAlbumQuick,
		renameAlbum,
	} = model;

	return (
		<div className="grid gap-2 rounded-(--desktop-radius-xs) border border-dashed border-(--desktop-border-strong) bg-(--desktop-surface-raised)/40 p-3">
			<div className="flex flex-wrap items-center gap-2">
				<DesktopAppSectionLabel>
					{t('mediaWorkbench.gallery')} ({albums.length})
				</DesktopAppSectionLabel>
				<span className="text-[11px] text-(--desktop-text-muted)">
					{galleryScopeLabel}.
				</span>
				<DesktopAppButton
					className="ml-auto px-3! py-1! text-[11px]"
					type="button"
					variant="ghost"
					onClick={() => void reloadAlbums()}
				>
					{t('mediaWorkbench.reloadAlbums')}
				</DesktopAppButton>
			</div>
			{albumsPending ? (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('mediaWorkbench.albumsLoading')}
				</p>
			) : albums.length === 0 ? (
				<div className="rounded-(--desktop-radius-xxs) border border-(--desktop-border-strong) bg-(--desktop-bg)/40 p-3 text-xs">
					<p className="text-(--desktop-text-strong) font-semibold">
						{t('mediaWorkbench.albumsEmpty')}
					</p>
					<ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-(--desktop-text-muted)">
						<li>{t('mediaWorkbench.albumsEmptyHintBindings')}</li>
						<li>{t('mediaWorkbench.albumsEmptyHintReload')}</li>
					</ul>
				</div>
			) : (
				<ul className="grid max-h-[220px] gap-2 overflow-y-auto overscroll-contain pr-1 text-xs">
					{albums.map((album: ProfessionalMediaAlbum) => (
						<li
							key={album.id}
							className="rounded-(--desktop-radius-xxs) border border-(--desktop-border-strong) bg-(--desktop-surface-raised) px-3 py-2 shadow-sm"
						>
							<div className="flex flex-wrap items-baseline gap-2">
								<strong className="text-sm">{album.title}</strong>
								<span className="text-[10px] text-(--desktop-text-muted)">
									{t('mediaWorkbench.albumAssetCount', {
										count: Array.isArray(album.unified_content_ids)
											? album.unified_content_ids.length
											: 0,
									})}
								</span>
							</div>
							{albumRenameId === album.id ? (
								<div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
									<DesktopAppInput
										value={albumRenameDraft}
										onChange={(e) => setAlbumRenameDraft(e.target.value)}
										placeholder={album.title}
									/>
									<DesktopAppButton
										disabled={!albumRenameDraft.trim()}
										onClick={() => void renameAlbum(album.id)}
									>
										{t('mediaWorkbench.albumRenameSave')}
									</DesktopAppButton>
									<DesktopAppButton
										variant="ghost"
										onClick={() => {
											setAlbumRenameId(null);
											setAlbumRenameDraft('');
										}}
									>
										{t('mediaWorkbench.modalCancel')}
									</DesktopAppButton>
								</div>
							) : (
								<div className="mt-2 flex flex-wrap justify-end gap-2">
									<DesktopAppButton
										variant="ghost"
										onClick={() => {
											setAlbumRenameId(album.id);
											setAlbumRenameDraft(album.title);
										}}
									>
										{t('mediaWorkbench.albumRename')}
									</DesktopAppButton>
									<DesktopAppButton
										variant="danger"
										onClick={() => {
											setAlbumDeleteId(album.id);
											setAlbumDeleteTitle(album.title);
										}}
									>
										{t('mediaWorkbench.albumDelete')}
									</DesktopAppButton>
								</div>
							)}
							{(album.unified_content_ids ?? []).length > 0 ? (
								<p className="mt-2 text-[11px] text-(--desktop-text-muted)">
									{t('mediaWorkbench.albumPhotoCount', {
										count: (album.unified_content_ids ?? []).length,
									})}
								</p>
							) : (
								<p className="mt-2 text-[11px] text-(--desktop-text-muted)">
									{t('mediaWorkbench.albumNoAssets')}
								</p>
							)}
						</li>
					))}
				</ul>
			)}
			<div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
				<DesktopAppInput
					value={albumTitleDraft}
					onChange={(e) => setAlbumTitleDraft(e.target.value)}
					placeholder={t('mediaWorkbench.albumTitle')}
				/>
				<DesktopAppButton
					disabled={!albumTitleDraft.trim()}
					onClick={() => void createAlbumQuick()}
				>
					{t('mediaWorkbench.albumCreate')}
				</DesktopAppButton>
			</div>
		</div>
	);
}
