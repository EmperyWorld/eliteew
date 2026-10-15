/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline edit form for a single EWDesk admin news post row.
 *
 * Invariants:
 * - Hero media mutual exclusion preserved (image URL vs content vs video).
 *
 * Related:
 * - EwDeskAdminSection.tsx
 * - documentation/product/desktop/EWDESK-NEWS.md
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { CompanyNewsPostAdmin } from '../../Desktop/services/productDesktopApi';
import {
	EwDeskContentAudioPicker,
	EwDeskContentImagePicker,
	EwDeskContentVideoPicker,
} from '../EwDeskContentImagePicker';
import { EwDeskMarkdownToolbar } from '../EwDeskMarkdownToolbar';
import { EwDeskNewsTemplateAndLinks } from '../EwDeskNewsTemplateAndLinks';
import { isoToDatetimeLocal } from './ewDeskAdminHelpers';
import {
	EwDeskAdminNewsAudioPreview,
	EwDeskAdminNewsImagePreview,
	EwDeskAdminNewsVideoPreview,
} from './EwDeskAdminMediaPreviews';
import { EwDeskNewsAiPolishButton } from './EwDeskNewsAiPolishButton';

export function EwDeskAdminEditNewsForm({
	post,
	onCancel,
	onSave,
	saving,
	inputClass,
	bodyTextareaClass,
}: {
	post: CompanyNewsPostAdmin;
	onCancel: () => void;
	onSave: (patch: Partial<CompanyNewsPostAdmin>) => void;
	saving: boolean;
	inputClass: string;
	bodyTextareaClass: string;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDeskAdmin' });
	const [title, setTitle] = React.useState(post.title);
	const [body, setBody] = React.useState(post.body);
	const [imageUrl, setImageUrl] = React.useState(post.image_url ?? '');
	const [imageContentId, setImageContentId] = React.useState(
		post.image_content_id ?? null
	);
	const [videoContentId, setVideoContentId] = React.useState(
		post.video_content_id ?? null
	);
	const [audioContentId, setAudioContentId] = React.useState(
		post.audio_content_id ?? null
	);
	const [pickerOpen, setPickerOpen] = React.useState(false);
	const [videoPickerOpen, setVideoPickerOpen] = React.useState(false);
	const [audioPickerOpen, setAudioPickerOpen] = React.useState(false);
	const [pinned, setPinned] = React.useState(post.pinned);
	const [published, setPublished] = React.useState(post.is_published);
	const [publishedAt, setPublishedAt] = React.useState(() =>
		isoToDatetimeLocal(post.published_at)
	);
	const bodyTextareaRef = React.useRef<HTMLTextAreaElement>(null);

	return (
		<div className="w-full space-y-2">
			<input
				type="text"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				aria-label={t('headlinePlaceholder')}
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
					rows={22}
					spellCheck={true}
					aria-label={t('bodyPlaceholder')}
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
						onClick={() => setPickerOpen(true)}
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
						'aspect-video max-h-56 w-full bg-black'
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
						'aspect-video max-h-36 w-full bg-(--desktop-surface-soft)'
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
					value={publishedAt}
					onChange={(e) => setPublishedAt(e.target.value)}
					className={inputClass}
				/>
			</label>
			<label className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
				<input
					type="checkbox"
					checked={pinned}
					onChange={(e) => setPinned(e.target.checked)}
				/>
				{t('pinPin')}
			</label>
			<label className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
				<input
					type="checkbox"
					checked={published}
					onChange={(e) => setPublished(e.target.checked)}
				/>
				{t('publishedToggle')}
			</label>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={saving}
					onClick={() =>
						onSave({
							title: title.trim(),
							body: body.trim(),
							image_url:
								videoContentId || imageContentId
									? null
									: imageUrl.trim() || null,
							image_content_id: videoContentId ? null : imageContentId,
							video_content_id: videoContentId,
							audio_content_id: audioContentId,
							pinned,
							is_published: published,
							published_at: publishedAt.trim()
								? new Date(publishedAt).toISOString()
								: null,
						})
					}
					className={cn(
						'rounded-lg px-3 py-1.5 text-sm text-(--desktop-text-primary)',
						'bg-(--desktop-surface-accent) hover:bg-(--desktop-surface-accent-strong)',
						saving && 'opacity-50'
					)}
				>
					{t('save')}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="px-3 py-1.5 text-sm text-(--desktop-text-muted)"
				>
					{t('cancel')}
				</button>
			</div>
			<EwDeskContentImagePicker
				open={pickerOpen}
				onClose={() => setPickerOpen(false)}
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
		</div>
	);
}
