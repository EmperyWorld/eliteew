/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Heroicon glyph resolver for desktop file shortcut icons by MIME/extension hint.
 *
 * Invariants:
 * - Unknown types fall back to DocumentTextIcon.
 *
 * Related:
 * - desktopIcon/DesktopIconSurface.tsx
 */

import {
	ArchiveBoxIcon,
	CodeBracketIcon,
	DocumentTextIcon,
	FilmIcon,
	MusicalNoteIcon,
	PhotoIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE } from '../../constants';

export function getFileIcon(fileType?: string) {
	switch (fileType) {
		case 'document':
		case 'pdf':
		case 'doc':
		case 'docx':
			return (
				<DocumentTextIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
		case 'image':
		case 'png':
		case 'jpg':
		case 'jpeg':
			return (
				<PhotoIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
		case 'video':
		case 'mp4':
		case 'mov':
			return (
				<FilmIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
		case 'audio':
		case 'mp3':
		case 'wav':
			return (
				<MusicalNoteIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
		case 'archive':
		case 'zip':
		case 'rar':
			return (
				<ArchiveBoxIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
		case 'code':
		case 'js':
		case 'ts':
		case 'py':
			return (
				<CodeBracketIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
		default:
			return (
				<DocumentTextIcon
					className="h-full w-full text-(--desktop-text-secondary)"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
			);
	}
}
