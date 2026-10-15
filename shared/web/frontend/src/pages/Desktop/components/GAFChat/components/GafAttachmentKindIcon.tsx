/**
 * Иконка по классу вложения (список чата / превью в пузыре).
 */
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { GafAttachmentPreviewKind } from '../gafChatAttachmentPreviewUtils';
import {
	ArchiveBoxIcon,
	DocumentIcon,
	DocumentTextIcon,
	MusicalNoteIcon,
	PhotoIcon,
	TableCellsIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

export function GafAttachmentKindIcon({
	kind,
	className,
	size = 'sm',
}: {
	kind: GafAttachmentPreviewKind;
	className?: string;
	size?: 'sm' | 'md' | 'lg';
}): JSX.Element {
	const dim = size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
	const base = cn(dim, 'shrink-0', className);
	const sw = DESKTOP_LUCIDE.stroke;
	switch (kind) {
		case 'image':
		case 'sticker':
			return (
				<PhotoIcon
					className={cn(base, 'text-[rgb(var(--desktop-accent-rgb)/0.88)]')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
		case 'video':
			return (
				<VideoCameraIcon
					className={cn(base, 'text-(--desktop-text-muted)')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
		case 'audio':
			return (
				<MusicalNoteIcon
					className={cn(base, 'text-(--desktop-text-muted)')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
		case 'pdf':
		case 'text':
			return (
				<DocumentTextIcon
					className={cn(base, 'text-(--desktop-text-muted)')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
		case 'archive':
			return (
				<ArchiveBoxIcon
					className={cn(base, 'text-(--desktop-text-muted)')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
		case 'office':
			return (
				<TableCellsIcon
					className={cn(base, 'text-(--desktop-text-muted)')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
		default:
			return (
				<DocumentIcon
					className={cn(base, 'text-(--desktop-text-muted)')}
					aria-hidden
					strokeWidth={sw}
				/>
			);
	}
}
