/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk admin: create post, bulk AI, list/edit/delete news. Delete confirm via ShellPortalMount.
 *
 * Invariants:
 * - Delete modal uses ShellPortalMount (no createPortal(document.body)).
 *
 * Related:
 * - ../EwDeskAdminSection.tsx (stable facade path)
 * - documentation/product/desktop/EWDESK-NEWS.md
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	SparklesIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppModalFrame,
} from '../../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '../../Desktop/constants';
import { ShellPortalMount } from '../../Desktop/shell/shellPortal';
import {
	EwDeskContentAudioPicker,
	EwDeskContentImagePicker,
	EwDeskContentVideoPicker,
} from '../EwDeskContentImagePicker';
import { EwDeskMarkdownToolbar } from '../EwDeskMarkdownToolbar';
import { EwDeskNewsTemplateAndLinks } from '../EwDeskNewsTemplateAndLinks';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { EwDeskAdminEditNewsForm } from './EwDeskAdminEditNewsForm';
import {
	EwDeskAdminNewsAudioPreview,
	EwDeskAdminNewsImagePreview,
	EwDeskAdminNewsVideoPreview,
} from './EwDeskAdminMediaPreviews';
import { EwDeskNewsAiPolishButton } from './EwDeskNewsAiPolishButton';
import { useEwDeskAdminSection } from './useEwDeskAdminSection';

export function EwDeskAdminSection(): React.ReactElement {
	const {
		t,
		title,
		setTitle,
		body,
		setBody,
		imageUrl,
		setImageUrl,
		imageContentId,
		setImageContentId,
		videoContentId,
		setVideoContentId,
		audioContentId,
		setAudioContentId,
		contentPickerOpen,
		setContentPickerOpen,
		videoPickerOpen,
		setVideoPickerOpen,
		audioPickerOpen,
		setAudioPickerOpen,
		publishAtCreate,
		setPublishAtCreate,
		editingId,
		setEditingId,
		deleteTargetId,
		setDeleteTargetId,
		selectedIds,
		setSelectedIds,
		bulkAiBusy,
		bulkAiProgress,
		bulkSelectAllRef,
		deleteModalPortalRef,
		deleteModalDescId,
		listQuery,
		posts,
		createMut,
		patchMut,
		delMut,
		runBulkAiRegenerate,
		selectablePosts,
		allSelectableSelected,
	} = useEwDeskAdminSection();

	const inputClass = cn(
		'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
		'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
		'placeholder:text-(--desktop-text-dim) outline-none transition-colors',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);

	const bodyTextareaClass = cn(
		inputClass,
		'min-h-[min(58vh,38rem)] resize-y align-top leading-relaxed md:min-h-[min(62vh,42rem)]'
	);

	const bodyTextareaRef = React.useRef<HTMLTextAreaElement>(null);

	const deleteModal =
		deleteTargetId && typeof document !== 'undefined' ? (
			<ShellPortalMount layer="embedded_modal_backdrop">
				<div
					ref={deleteModalPortalRef}
					className="fixed inset-0 flex items-center justify-center p-4"
					style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
				>
					<button
						type="button"
						className={cn('absolute inset-0', DESKTOP_OVERLAY.backdrop)}
						aria-label={t('deleteModalDismissAria')}
						onClick={() => setDeleteTargetId(null)}
					/>
					<div
						className="relative w-full max-w-md"
						style={{ zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT }}
					>
						<DesktopAppModalFrame
							title={t('deleteModalTitle')}
							onClose={() => setDeleteTargetId(null)}
							closeLabel={t('cancel')}
							className="max-w-md shadow-lg shadow-black/20"
							role="alertdialog"
							aria-describedby={deleteModalDescId}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex flex-col gap-4 p-4">
								<p
									id={deleteModalDescId}
									className="text-sm leading-relaxed text-(--desktop-text-secondary)"
								>
									{t('deleteConfirm')}
								</p>
								<div className="flex flex-wrap justify-end gap-2">
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										disabled={delMut.isPending}
										onClick={() => setDeleteTargetId(null)}
									>
										{t('cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="danger"
										size="sm"
										disabled={delMut.isPending}
										onClick={() => {
											delMut.mutate(deleteTargetId, {
												onSuccess: () => setDeleteTargetId(null),
											});
										}}
									>
										{delMut.isPending ? (
											<ArrowPathIcon
												className="h-4 w-4 animate-spin"
												aria-hidden
											/>
										) : null}
										{t('deleteModalAction')}
									</DesktopAppButton>
								</div>
							</div>
						</DesktopAppModalFrame>
					</div>
				</div>
			</ShellPortalMount>
		) : null;

	return (
		<>
			<AdminSectionFrame className="flex flex-col gap-6">
				<div
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.panel,
						'space-y-3 p-4',
						DESKTOP_SURFACE.radius
					)}
				>
					<div className={DESKTOP_TYPOGRAPHY.caption}>{t('newPost')}</div>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={t('headlinePlaceholder')}
						className={inputClass}
					/>
					<EwDeskNewsTemplateAndLinks
						title={title}
						body={body}
						setTitle={setTitle}
						setBody={setBody}
					/>
					<div className="flex flex-col gap-1.5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<span
								className={`${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-muted)`}
							>
								{t('editorToolbar.formattingCaption')}
							</span>
							<EwDeskNewsAiPolishButton
								title={title}
								body={body}
								setTitle={setTitle}
								setBody={setBody}
							/>
						</div>
						<EwDeskMarkdownToolbar
							textareaRef={bodyTextareaRef}
							setBody={setBody}
						/>
						<textarea
							ref={bodyTextareaRef}
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder={t('bodyPlaceholder')}
							rows={22}
							spellCheck={true}
							className={bodyTextareaClass}
						/>
					</div>
					<p
						className={`${DESKTOP_TYPOGRAPHY.captionInherit} text-(--desktop-text-dim)`}
					>
						{t('bodyMarkdownHint')}
					</p>
					<label className="flex flex-col gap-1">
						<span
							className={`${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-muted)`}
						>
							{t('imageUrlLabel')}
						</span>
						<input
							type="url"
							value={imageUrl}
							onChange={(e) => {
								setImageUrl(e.target.value);
								if (e.target.value.trim()) {
									setImageContentId(null);
									setVideoContentId(null);
								}
							}}
							placeholder={t('imageUrlPlaceholder')}
							autoComplete="off"
							className={inputClass}
						/>
						<span
							className={`${DESKTOP_TYPOGRAPHY.captionInherit} text-(--desktop-text-dim)`}
						>
							{t('imageUrlHint')}
						</span>
						<p
							className={`${DESKTOP_TYPOGRAPHY.captionInherit} text-(--desktop-text-dim)`}
						>
							{t('heroMediaExclusiveHint')}
						</p>
						<div className="flex flex-wrap gap-2 pt-1">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => setContentPickerOpen(true)}
							>
								{t('pickFromContentManager')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => setVideoPickerOpen(true)}
							>
								{t('pickVideoFromContentManager')}
							</DesktopAppButton>
							{imageUrl.trim() || imageContentId || videoContentId ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => {
										setImageUrl('');
										setImageContentId(null);
										setVideoContentId(null);
									}}
								>
									{t('clearHeroMedia')}
								</DesktopAppButton>
							) : null}
						</div>
					</label>
					{videoContentId ? (
						<div
							className={cn(
								'overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
								'aspect-video max-h-56 w-full max-w-md bg-black'
							)}
						>
							<EwDeskAdminNewsVideoPreview
								videoContentId={videoContentId}
								className="h-full w-full object-contain"
							/>
						</div>
					) : imageUrl.trim() || imageContentId ? (
						<div
							className={cn(
								'overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
								'aspect-video max-h-40 w-full max-w-md bg-(--desktop-surface-soft)'
							)}
						>
							<EwDeskAdminNewsImagePreview
								imageUrl={imageUrl}
								imageContentId={imageContentId}
								className="h-full w-full object-cover"
							/>
						</div>
					) : null}
					<fieldset className="flex flex-col gap-1 border-0 p-0 pt-1">
						<legend
							className={`${DESKTOP_TYPOGRAPHY.small} float-none text-(--desktop-text-muted)`}
						>
							{t('audioAttachmentLabel')}
						</legend>
						<div className="flex flex-wrap gap-2">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => setAudioPickerOpen(true)}
							>
								{t('pickAudioFromContentManager')}
							</DesktopAppButton>
							{audioContentId ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => setAudioContentId(null)}
								>
									{t('clearAudioAttachment')}
								</DesktopAppButton>
							) : null}
						</div>
					</fieldset>
					{audioContentId ? (
						<div
							className={cn(
								'overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
								'max-w-md bg-(--desktop-surface-soft) p-3'
							)}
						>
							<EwDeskAdminNewsAudioPreview audioContentId={audioContentId} />
						</div>
					) : null}
					<label className="flex flex-col gap-1">
						<span
							className={`${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-muted)`}
						>
							{t('publishAtLabel')}
						</span>
						<input
							type="datetime-local"
							value={publishAtCreate}
							onChange={(e) => setPublishAtCreate(e.target.value)}
							className={inputClass}
						/>
					</label>
					<button
						type="button"
						disabled={!title.trim() || !body.trim() || createMut.isPending}
						onClick={() => createMut.mutate()}
						className={cn(
							'px-4 py-2 text-sm text-(--desktop-text-primary)',
							DESKTOP_SURFACE.radius,
							DESKTOP_INTERACTIVE.btnRounded,
							'border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) hover:bg-(--desktop-surface-accent-strong) disabled:opacity-50',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					>
						{createMut.isPending ? (
							<ArrowPathIcon
								className="inline h-4 w-4 animate-spin"
								aria-hidden
							/>
						) : (
							t('publish')
						)}
					</button>
				</div>

				<div className={DESKTOP_TYPOGRAPHY.caption}>{t('allPosts')}</div>
				<div className="flex flex-wrap items-center gap-3 py-2">
					<label
						className={cn(
							'flex cursor-pointer items-center gap-2 text-sm text-(--desktop-text-secondary)',
							(selectablePosts.length === 0 ||
								bulkAiBusy ||
								listQuery.isLoading) &&
								'cursor-not-allowed opacity-60'
						)}
					>
						<input
							ref={bulkSelectAllRef}
							type="checkbox"
							checked={selectablePosts.length > 0 && allSelectableSelected}
							disabled={
								selectablePosts.length === 0 ||
								bulkAiBusy ||
								listQuery.isLoading
							}
							onChange={() => {
								if (allSelectableSelected) {
									setSelectedIds(new Set());
								} else {
									setSelectedIds(new Set(selectablePosts.map((x) => x.id)));
								}
							}}
							className={cn('rounded border', DESKTOP_CHROME_FOCUS_VISIBLE)}
							aria-label={t('bulkSelectAllAria')}
						/>
						<span>{t('bulkSelectAll')}</span>
					</label>
					{selectedIds.size > 0 ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							disabled={bulkAiBusy}
							onClick={() => setSelectedIds(new Set())}
						>
							{t('bulkClearSelection')}
						</DesktopAppButton>
					) : null}
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="gap-1.5"
						disabled={selectedIds.size === 0 || bulkAiBusy}
						title={t('bulkAiRegenerateHint')}
						aria-label={t('bulkAiRegenerateAria')}
						onClick={() => void runBulkAiRegenerate()}
					>
						{bulkAiBusy ? (
							<ArrowPathIcon
								className="h-3.5 w-3.5 shrink-0 animate-spin"
								aria-hidden
							/>
						) : (
							<SparklesIcon
								className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
								aria-hidden
							/>
						)}
						{t('bulkAiRegenerate')}
						{bulkAiProgress ? (
							<span className="tabular-nums text-(--desktop-text-dim)">
								{t('bulkAiProgress', {
									current: bulkAiProgress.current,
									total: bulkAiProgress.total,
								})}
							</span>
						) : null}
					</DesktopAppButton>
				</div>
				{listQuery.isLoading && (
					<div
						className="flex items-center gap-2 py-2 text-sm text-(--desktop-text-muted)"
						aria-busy="true"
						aria-live="polite"
					>
						<ArrowPathIcon
							className="h-6 w-6 shrink-0 animate-spin text-(--desktop-text-dim)"
							aria-hidden
						/>
						<span>{t('listLoading')}</span>
					</div>
				)}
				<ul className="space-y-3">
					{posts.map((p) => (
						<li
							key={p.id}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.panel,
								'flex flex-col gap-2 p-4',
								'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
								'hover:border-(--desktop-border-strong)/35 hover:shadow-md hover:shadow-black/15',
								DESKTOP_SURFACE.radius
							)}
						>
							{editingId === p.id ? (
								<EwDeskAdminEditNewsForm
									key={p.id}
									post={p}
									onCancel={() => setEditingId(null)}
									onSave={(patch) => patchMut.mutate({ id: p.id, patch })}
									saving={patchMut.isPending}
									inputClass={inputClass}
									bodyTextareaClass={bodyTextareaClass}
								/>
							) : (
								<>
									<div className="flex items-start justify-between gap-2">
										<label className="flex shrink-0 cursor-pointer pt-1">
											<input
												type="checkbox"
												checked={selectedIds.has(p.id)}
												disabled={bulkAiBusy}
												onChange={() => {
													setSelectedIds((prev) => {
														const n = new Set(prev);
														if (n.has(p.id)) n.delete(p.id);
														else n.add(p.id);
														return n;
													});
												}}
												onClick={(e) => e.stopPropagation()}
												className={cn(
													'rounded border',
													DESKTOP_CHROME_FOCUS_VISIBLE
												)}
												aria-label={t('bulkRowSelectAria')}
											/>
										</label>
										<div className="flex min-w-0 flex-1 gap-3">
											{p.video_content_id ? (
												<div
													className={cn(
														'relative hidden shrink-0 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) sm:block',
														'h-14 w-22 bg-black'
													)}
												>
													<EwDeskAdminNewsVideoPreview
														videoContentId={p.video_content_id}
														className="h-full w-full object-cover"
													/>
													{p.audio_content_id ? (
														<span
															className="absolute right-0.5 bottom-0.5 rounded bg-black/55 px-1 py-0.5 text-[0.625rem] text-white/95"
															title={t('audioAttachmentLabel')}
														>
															{t('audioListBadge')}
														</span>
													) : null}
												</div>
											) : p.image_url || p.image_content_id ? (
												<div
													className={cn(
														'relative hidden shrink-0 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) sm:block',
														'h-14 w-22 bg-(--desktop-surface-soft)'
													)}
												>
													<EwDeskAdminNewsImagePreview
														imageUrl={p.image_url ?? ''}
														imageContentId={p.image_content_id ?? null}
														className="h-full w-full object-cover"
													/>
													{p.audio_content_id ? (
														<span
															className="absolute right-0.5 bottom-0.5 rounded bg-black/55 px-1 py-0.5 text-[0.625rem] text-white/95"
															title={t('audioAttachmentLabel')}
														>
															{t('audioListBadge')}
														</span>
													) : null}
												</div>
											) : p.audio_content_id ? (
												<div
													className={cn(
														'hidden shrink-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) sm:flex',
														'h-14 w-22 items-center justify-center bg-(--desktop-surface-soft) text-xs text-(--desktop-text-muted)'
													)}
													title={t('audioAttachmentLabel')}
												>
													{t('audioListBadge')}
												</div>
											) : null}
											<div className="min-w-0 flex-1">
												<div className="font-medium text-(--desktop-text-primary)">
													{p.title}
												</div>
												<div
													className={cn(
														DESKTOP_TYPOGRAPHY.small,
														'text-(--desktop-text-muted)'
													)}
												>
													{p.is_published ? t('published') : t('draft')}
													{p.pinned ? ` · ${t('pinned')}` : ''}
												</div>
											</div>
										</div>
										<div className="flex shrink-0 gap-2">
											<button
												type="button"
												className={cn(
													'px-2 py-1 text-xs text-(--desktop-text-secondary)',
													DESKTOP_INTERACTIVE.btnRounded,
													'hover:bg-(--desktop-surface-soft)',
													DESKTOP_CHROME_FOCUS_VISIBLE
												)}
												onClick={() => setEditingId(p.id)}
											>
												{t('edit')}
											</button>
											<button
												type="button"
												className={cn(
													'rounded-lg p-2 text-rose-400/90 transition-colors',
													'hover:bg-[color-mix(in_srgb,rgb(239_68_68)_12%,var(--desktop-surface-soft))]',
													DESKTOP_CHROME_FOCUS_VISIBLE
												)}
												aria-label={t('deleteAria')}
												disabled={delMut.isPending}
												onClick={() => setDeleteTargetId(p.id)}
											>
												<TrashIcon className="h-4 w-4" />
											</button>
										</div>
									</div>
									<p className="line-clamp-4 whitespace-pre-wrap text-sm text-(--desktop-text-secondary)">
										{p.body}
									</p>
								</>
							)}
						</li>
					))}
				</ul>
			</AdminSectionFrame>
			<EwDeskContentImagePicker
				open={contentPickerOpen}
				onClose={() => setContentPickerOpen(false)}
				onSelect={(id) => {
					setImageContentId(id);
					setImageUrl('');
					setVideoContentId(null);
				}}
			/>
			<EwDeskContentVideoPicker
				open={videoPickerOpen}
				onClose={() => setVideoPickerOpen(false)}
				onSelect={(id) => {
					setVideoContentId(id);
					setImageUrl('');
					setImageContentId(null);
				}}
			/>
			<EwDeskContentAudioPicker
				open={audioPickerOpen}
				onClose={() => setAudioPickerOpen(false)}
				onSelect={(id) => setAudioContentId(id)}
			/>
			{deleteModal}
		</>
	);
}
