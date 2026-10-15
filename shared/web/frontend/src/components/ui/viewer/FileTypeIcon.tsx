/**
 * ============================================
 * FILE: FileTypeIcon.tsx
 * ============================================
 *
 * Comprehensive file type icon component
 * Displays color-coded icons for 30+ file formats
 *
 * Features:
 * - 30+ file type icons (documents, images, videos, audio, code, archives)
 * - Color-coded by category (documents: blue, images: purple, videos: pink, etc.)
 * - Size variants (xs, sm, md, lg, xl)
 * - SVG-based for crisp display at any size
 * - Fallback icon for unknown types
 * - Accessibility (ARIA labels)
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

import * as React from 'react';
import {
	ArchiveBoxIcon,
	CircleStackIcon,
	CodeBracketIcon,
	DocumentIcon,
	DocumentTextIcon,
	MusicalNoteIcon,
	PhotoIcon,
	PresentationChartBarIcon,
	TableCellsIcon,
	VideoCameraIcon,
	WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
// ============================================================================
// TYPES
// ============================================================================

export type FileType =
	// Documents
	| 'pdf'
	| 'doc'
	| 'docx'
	| 'txt'
	| 'rtf'
	| 'odt'
	// Spreadsheets
	| 'xls'
	| 'xlsx'
	| 'csv'
	| 'ods'
	// Presentations
	| 'ppt'
	| 'pptx'
	| 'odp'
	| 'key'
	// Images
	| 'jpg'
	| 'jpeg'
	| 'png'
	| 'gif'
	| 'svg'
	| 'webp'
	| 'bmp'
	| 'ico'
	| 'tiff'
	// Videos
	| 'mp4'
	| 'mov'
	| 'avi'
	| 'mkv'
	| 'webm'
	| 'flv'
	| 'wmv'
	// Audio
	| 'mp3'
	| 'wav'
	| 'ogg'
	| 'flac'
	| 'm4a'
	| 'aac'
	// CodeBracketIcon
	| 'js'
	| 'ts'
	| 'jsx'
	| 'tsx'
	| 'py'
	| 'java'
	| 'cpp'
	| 'c'
	| 'cs'
	| 'php'
	| 'rb'
	| 'go'
	| 'rs'
	| 'swift'
	| 'kt'
	| 'html'
	| 'css'
	| 'scss'
	| 'sass'
	| 'json'
	| 'xml'
	| 'yaml'
	| 'yml'
	| 'md'
	| 'markdown'
	// Archives
	| 'zip'
	| 'rar'
	| '7z'
	| 'tar'
	| 'gz'
	| 'bz2'
	// Databases
	| 'sql'
	| 'db'
	| 'sqlite'
	| 'mdb'
	// Other
	| 'exe'
	| 'apk'
	| 'dmg'
	| 'iso'
	| 'dll'
	| 'so'
	| 'unknown';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface FileTypeIconProps {
	/** DocumentIcon extension or MIME type */
	type: string;

	/** Icon size */
	size?: IconSize;

	/** Additional CSS classes */
	className?: string;

	/** Show file extension label */
	showLabel?: boolean;

	/** Custom label */
	label?: string;
}

// ============================================================================
// FILE TYPE DETECTION
// ============================================================================

const getFileType = (type: string): FileType => {
	const normalized = type.toLowerCase().replace(/^\./, '');

	// Direct mapping
	const typeMap: Record<string, FileType> = {
		// Documents
		pdf: 'pdf',
		doc: 'doc',
		docx: 'docx',
		txt: 'txt',
		rtf: 'rtf',
		odt: 'odt',

		// Spreadsheets
		xls: 'xls',
		xlsx: 'xlsx',
		csv: 'csv',
		ods: 'ods',

		// Presentations
		ppt: 'ppt',
		pptx: 'pptx',
		odp: 'odp',
		key: 'key',

		// Images
		jpg: 'jpg',
		jpeg: 'jpeg',
		png: 'png',
		gif: 'gif',
		svg: 'svg',
		webp: 'webp',
		bmp: 'bmp',
		ico: 'ico',
		tiff: 'tiff',

		// Videos
		mp4: 'mp4',
		mov: 'mov',
		avi: 'avi',
		mkv: 'mkv',
		webm: 'webm',
		flv: 'flv',
		wmv: 'wmv',

		// Audio
		mp3: 'mp3',
		wav: 'wav',
		ogg: 'ogg',
		flac: 'flac',
		m4a: 'm4a',
		aac: 'aac',

		// CodeBracketIcon
		js: 'js',
		ts: 'ts',
		jsx: 'jsx',
		tsx: 'tsx',
		py: 'py',
		java: 'java',
		cpp: 'cpp',
		c: 'c',
		cs: 'cs',
		php: 'php',
		rb: 'rb',
		go: 'go',
		rs: 'rs',
		swift: 'swift',
		kt: 'kt',
		html: 'html',
		css: 'css',
		scss: 'scss',
		sass: 'sass',
		json: 'json',
		xml: 'xml',
		yaml: 'yaml',
		yml: 'yml',
		md: 'md',
		markdown: 'markdown',

		// Archives
		zip: 'zip',
		rar: 'rar',
		'7z': '7z',
		tar: 'tar',
		gz: 'gz',
		bz2: 'bz2',

		// Databases
		sql: 'sql',
		db: 'db',
		sqlite: 'sqlite',
		mdb: 'mdb',

		// Other
		exe: 'exe',
		apk: 'apk',
		dmg: 'dmg',
		iso: 'iso',
		dll: 'dll',
		so: 'so',
	};

	return typeMap[normalized] || 'unknown';
};

// ============================================================================
// FILE TYPE METADATA
// ============================================================================

interface FileTypeMetadata {
	icon: React.ComponentType<{ className?: string }>;
	color: string;
	bgColor: string;
	borderColor: string;
	category: string;
}

const getFileTypeMetadata = (fileType: FileType): FileTypeMetadata => {
	// Documents (Blue)
	if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileType)) {
		return {
			icon: DocumentTextIcon,
			color: 'text-blue-400',
			bgColor: 'bg-blue-500/20',
			borderColor: 'border-blue-500/30',
			category: 'Document',
		};
	}

	// Spreadsheets (Green)
	if (['xls', 'xlsx', 'csv', 'ods'].includes(fileType)) {
		return {
			icon: TableCellsIcon,
			color: 'text-green-400',
			bgColor: 'bg-green-500/20',
			borderColor: 'border-green-500/30',
			category: 'Spreadsheet',
		};
	}

	// Presentations (Orange)
	if (['ppt', 'pptx', 'odp', 'key'].includes(fileType)) {
		return {
			icon: PresentationChartBarIcon,
			color: 'text-orange-400',
			bgColor: 'bg-orange-500/20',
			borderColor: 'border-orange-500/30',
			category: 'Presentation',
		};
	}

	// Images (Purple)
	if (
		['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(
			fileType
		)
	) {
		return {
			icon: PhotoIcon,
			color: 'text-purple-400',
			bgColor: 'bg-purple-500/20',
			borderColor: 'border-purple-500/30',
			category: 'PhotoIcon',
		};
	}

	// Videos (Pink)
	if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'].includes(fileType)) {
		return {
			icon: VideoCameraIcon,
			color: 'text-pink-400',
			bgColor: 'bg-pink-500/20',
			borderColor: 'border-pink-500/30',
			category: 'VideoCameraIcon',
		};
	}

	// Audio (Cyan)
	if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(fileType)) {
		return {
			icon: MusicalNoteIcon,
			color: 'text-cyan-400',
			bgColor: 'bg-cyan-500/20',
			borderColor: 'border-cyan-500/30',
			category: 'Audio',
		};
	}

	// CodeBracketIcon (Indigo)
	if (
		[
			'js',
			'ts',
			'jsx',
			'tsx',
			'py',
			'java',
			'cpp',
			'c',
			'cs',
			'php',
			'rb',
			'go',
			'rs',
			'swift',
			'kt',
			'html',
			'css',
			'scss',
			'sass',
			'yaml',
			'yml',
		].includes(fileType)
	) {
		return {
			icon: CodeBracketIcon,
			color: 'text-indigo-400',
			bgColor: 'bg-indigo-500/20',
			borderColor: 'border-indigo-500/30',
			category: 'CodeBracketIcon',
		};
	}

	// JSON/Config (Yellow)
	if (['json', 'xml', 'md', 'markdown'].includes(fileType)) {
		return {
			icon: DocumentTextIcon,
			color: 'text-yellow-400',
			bgColor: 'bg-yellow-500/20',
			borderColor: 'border-yellow-500/30',
			category: 'Data',
		};
	}

	// Archives (Amber)
	if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(fileType)) {
		return {
			icon: ArchiveBoxIcon,
			color: 'text-amber-400',
			bgColor: 'bg-amber-500/20',
			borderColor: 'border-amber-500/30',
			category: 'ArchiveBoxIcon',
		};
	}

	// Databases (Emerald)
	if (['sql', 'db', 'sqlite', 'mdb'].includes(fileType)) {
		return {
			icon: CircleStackIcon,
			color: 'text-emerald-400',
			bgColor: 'bg-emerald-500/20',
			borderColor: 'border-emerald-500/30',
			category: 'CircleStackIcon',
		};
	}

	// Executables (Red)
	if (['exe', 'apk', 'dmg', 'iso', 'dll', 'so'].includes(fileType)) {
		return {
			icon: WrenchScrewdriverIcon,
			color: 'text-red-400',
			bgColor: 'bg-red-500/20',
			borderColor: 'border-red-500/30',
			category: 'Executable',
		};
	}

	// Default (Gray)
	return {
		icon: DocumentIcon,
		color: 'text-gray-400',
		bgColor: 'bg-gray-500/20',
		borderColor: 'border-gray-500/30',
		category: 'Unknown',
	};
};

// ============================================================================
// SIZE MAPPING
// ============================================================================

const sizeMap: Record<IconSize, { icon: string; label: string }> = {
	xs: { icon: 'w-3 h-3', label: 'text-xs' },
	sm: { icon: 'w-4 h-4', label: 'text-xs' },
	md: { icon: 'w-5 h-5', label: 'text-sm' },
	lg: { icon: 'w-6 h-6', label: 'text-base' },
	xl: { icon: 'w-8 h-8', label: 'text-lg' },
};

// ============================================================================
// COMPONENT
// ============================================================================

const FileTypeIcon: React.FC<FileTypeIconProps> = ({
	type,
	size = 'md',
	className = '',
	showLabel = false,
	label,
}) => {
	const fileType = getFileType(type);
	const metadata = getFileTypeMetadata(fileType);
	const Icon = metadata.icon;
	const sizes = sizeMap[size];

	const displayLabel = label || type.toUpperCase();

	if (showLabel) {
		return (
			<div
				className={`flex items-center gap-2 ${className}`}
				role="img"
				aria-label={`${metadata.category} file: ${displayLabel}`}
			>
				<div
					className={`
            p-2 rounded-lg
            ${metadata.bgColor}
            ${metadata.borderColor}
            border
          `}
				>
					<Icon className={`${sizes.icon} ${metadata.color}`} />
				</div>

				<div className="flex flex-col">
					<span className={`${sizes.label} font-medium text-white/90`}>
						{displayLabel}
					</span>
					<span className="text-xs text-white/50">{metadata.category}</span>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`
        inline-flex items-center justify-center
        p-1.5 rounded
        ${metadata.bgColor}
        ${className}
      `}
			role="img"
			aria-label={`${metadata.category} file`}
		>
			<Icon className={`${sizes.icon} ${metadata.color}`} />
		</div>
	);
};

export default FileTypeIcon;

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { getFileType, getFileTypeMetadata };
