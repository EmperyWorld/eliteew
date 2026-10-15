/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single grid or list row for GAF Chat Content Manager library picker — thumbnail, label,
 * size, type badge, and selection affordances with keyboard activation.
 *
 * Invariants:
 * - Row thumbnails use Bearer ContentThumbnail, not raw thumbnail_url on img.
 * - Grid and list variants preserve distinct layout and keyboard handling from the panel.
 *
 * Related:
 * - GafContentLibraryPickerPanel.tsx
 * - useUnifiedContentPickerController.ts
 */
import { ContentThumbnail } from '@/components/UnifiedContent/components/ContentThumbnail/ContentThumbnail';
import { unifiedContentDisplayLabel } from '@/components/UnifiedContent/utils/contentDisplayLabel';
import {
	PICKER_CONTENT_TYPE_BADGE_STYLES,
	PickerContentTypeIcon,
} from '@/components/UnifiedContent/picker/pickerContentTypeUtils';
import type { PickerItem } from '@/components/UnifiedContent/picker/useUnifiedContentPickerController';
import { DesktopAppStatusBadge } from '@/pages/Desktop/components/DesktopAppChrome';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ContentType } from '@/types/fileExchange';
import { formatFileSize } from '@/types/fileExchange';
import { cn } from '@/utils/cn';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import type { ReactElement } from 'react';

export type GafContentLibraryPickerRowVariant = 'grid' | 'list';

export type GafContentLibraryPickerRowProps = Readonly<{
	file: PickerItem;
	variant: GafContentLibraryPickerRowVariant;
	selectedId: string | null;
	typeChipLabel: (type: PickerItem['_pickerContentType']) => string;
	onActivate: (id: string) => void;
	onDoubleActivate: (item: PickerItem) => void;
}>;

export function GafContentLibraryPickerRow({
	file,
	variant,
	selectedId,
	typeChipLabel,
	onActivate,
	onDoubleActivate,
}: GafContentLibraryPickerRowProps): ReactElement {
	const isSelected = file.id === selectedId;
	const ct = file._pickerContentType;
	const badgeClassName =
		PICKER_CONTENT_TYPE_BADGE_STYLES[ct] ??
		PICKER_CONTENT_TYPE_BADGE_STYLES[ContentType.OTHER];
	const label = unifiedContentDisplayLabel(file);
	const sharedSelected =
		'border-[rgb(var(--desktop-accent-rgb)/0.55)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.35)]';
	const sharedIdle =
		'border-(--desktop-border-subtle) bg-(--desktop-surface-panel) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft)';

	if (variant === 'grid') {
		return (
			<DesktopChromeTooltip
				key={file.id}
				content={label}
				placement="top"
				offsetExtra={4}
			>
				{/* biome-ignore lint/a11y/useSemanticElements: card tile */}
				<div
					role="button"
					tabIndex={0}
					aria-pressed={isSelected}
					aria-label={label}
					className={cn(
						'flex cursor-pointer flex-col overflow-hidden rounded-(--desktop-radius-lg) border transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
						isSelected ? sharedSelected : sharedIdle
					)}
					onClick={() => onActivate(file.id)}
					onDoubleClick={() => onDoubleActivate(file)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							if (e.detail > 1) return;
							onActivate(file.id);
						}
					}}
				>
					<div className="relative aspect-4/3 w-full overflow-hidden bg-(--desktop-surface-soft)">
						{ct === ContentType.AUDIO ? (
							<div className="flex h-full w-full items-center justify-center">
								<PickerContentTypeIcon contentType={ct} />
							</div>
						) : (
							<ContentThumbnail
								contentId={file.id}
								alt=""
								className="h-full w-full object-cover"
								fillParent
							/>
						)}
						{isSelected ? (
							<span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.9)] text-white shadow-sm">
								<ClipboardDocumentCheckIcon
									className="h-3.5 w-3.5"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</span>
						) : null}
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
						<p
							className={cn(
								'line-clamp-2 font-medium text-(--desktop-text-primary)',
								DESKTOP_TYPOGRAPHY.meta
							)}
						>
							{label}
						</p>
						<div className="flex items-center justify-between gap-1">
							<span className={DESKTOP_TYPOGRAPHY.meta}>
								{formatFileSize(file.file_size ?? 0)}
							</span>
							<DesktopAppStatusBadge
								className={cn('px-1.5 py-0 text-[10px]', badgeClassName)}
							>
								{typeChipLabel(ct)}
							</DesktopAppStatusBadge>
						</div>
					</div>
				</div>
			</DesktopChromeTooltip>
		);
	}

	return (
		<DesktopChromeTooltip
			key={file.id}
			content={label}
			placement="top"
			offsetExtra={4}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: full-width row */}
			<div
				role="button"
				tabIndex={0}
				aria-pressed={isSelected}
				aria-label={label}
				className={cn(
					'flex cursor-pointer items-center gap-3 rounded-(--desktop-radius-lg) border px-3 py-2.5 transition-[border-color,background-color] duration-150 motion-reduce:transition-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
					isSelected ? sharedSelected : sharedIdle
				)}
				onClick={() => onActivate(file.id)}
				onDoubleClick={() => onDoubleActivate(file)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onActivate(file.id);
					}
				}}
			>
				<div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-(--desktop-radius)">
					{ct === ContentType.AUDIO ? (
						<div className="flex h-full w-full items-center justify-center bg-(--desktop-surface-soft)">
							<PickerContentTypeIcon contentType={ct} />
						</div>
					) : (
						<ContentThumbnail contentId={file.id} alt="" fillParent />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							'truncate font-medium text-(--desktop-text-primary)',
							DESKTOP_TYPOGRAPHY.body
						)}
					>
						{label}
					</p>
					<div className="mt-0.5 flex flex-wrap items-center gap-2">
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{formatFileSize(file.file_size ?? 0)}
						</span>
						<DesktopAppStatusBadge className={badgeClassName}>
							{typeChipLabel(ct)}
						</DesktopAppStatusBadge>
					</div>
				</div>
				{isSelected ? (
					<ClipboardDocumentCheckIcon
						className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/1)]"
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				) : null}
			</div>
		</DesktopChromeTooltip>
	);
}
