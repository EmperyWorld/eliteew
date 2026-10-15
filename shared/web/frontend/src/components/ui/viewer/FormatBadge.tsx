/**
 * ============================================
 * FILE: FormatBadge.tsx
 * ============================================
 *
 * File format badge component
 * Displays file format with color coding, size, and edit status
 *
 * Features:
 * - Color-coded by file category
 * - Shows file format (PDF, DOCX, PNG, etc.)
 * - File size display (MB/KB)
 * - Editable/Read-only indicator
 * - Size variants (sm, md, lg)
 * - Glassmorphism styling
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

import * as React from 'react';
import { LockClosedIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { getFileType, getFileTypeMetadata } from './FileTypeIcon';

// ============================================================================
// TYPES
// ============================================================================

export interface FormatBadgeProps {
	/** File format/extension */
	format: string;

	/** File size in bytes */
	size?: number;

	/** Is file editable */
	editable?: boolean;

	/** Badge size variant */
	variant?: 'sm' | 'md' | 'lg';

	/** Show file size */
	showSize?: boolean;

	/** Show edit status icon */
	showEditStatus?: boolean;

	/** Additional CSS classes */
	className?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format file size to human-readable string
 */
const formatFileSize = (bytes: number): string => {
	if (bytes === 0) {
		return '0 B';
	}

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

// ============================================================================
// COMPONENT
// ============================================================================

const FormatBadge: React.FC<FormatBadgeProps> = ({
	format,
	size,
	editable = false,
	variant = 'md',
	showSize = true,
	showEditStatus = true,
	className = '',
}) => {
	const fileType = getFileType(format);
	const metadata = getFileTypeMetadata(fileType);

	// Size variants
	const variants = {
		sm: {
			container: 'px-2 py-1 gap-1',
			text: 'text-xs',
			icon: 'w-3 h-3',
		},
		md: {
			container: 'px-3 py-1.5 gap-1.5',
			text: 'text-sm',
			icon: 'w-3.5 h-3.5',
		},
		lg: {
			container: 'px-4 py-2 gap-2',
			text: 'text-base',
			icon: 'w-4 h-4',
		},
	};

	const sizeVariant = variants[variant];

	return (
		<div
			className={`
        inline-flex items-center
        ${sizeVariant.container}
        ${metadata.bgColor}
        ${metadata.borderColor}
        border
        backdrop-blur-xs
        rounded-full
        ${className}
      `}
			role="status"
			aria-label={`File format: ${format}${size ? `, size: ${formatFileSize(size)}` : ''}${editable ? ', editable' : ', read-only'}`}
		>
			{/* Format text */}
			<span
				className={`${sizeVariant.text} font-semibold ${metadata.color} uppercase`}
			>
				{format}
			</span>

			{/* File size */}
			{showSize && size !== undefined && (
				<>
					<span className={`${sizeVariant.text} text-white/40`}>•</span>
					<span className={`${sizeVariant.text} text-white/60`}>
						{formatFileSize(size)}
					</span>
				</>
			)}

			{/* Edit status */}
			{showEditStatus && (
				<>
					<span className={`${sizeVariant.text} text-white/40`}>•</span>
					{editable ? (
						<span role="img" title="Editable" aria-label="Editable">
							<PencilSquareIcon
								className={`${sizeVariant.icon} text-green-400`}
								aria-hidden="true"
							/>
						</span>
					) : (
						<span role="img" title="Read-only" aria-label="Read-only">
							<LockClosedIcon
								className={`${sizeVariant.icon} text-white/40`}
								aria-hidden="true"
							/>
						</span>
					)}
				</>
			)}
		</div>
	);
};

export default FormatBadge;

// ============================================================================
// VARIANT COMPONENTS
// ============================================================================

/**
 * Simple format badge (format only)
 */
export const SimpleFormatBadge: React.FC<{
	format: string;
	className?: string;
}> = ({ format, className }) => (
	<FormatBadge
		format={format}
		showSize={false}
		showEditStatus={false}
		variant="sm"
		className={className}
	/>
);

/**
 * Detailed format badge (all info)
 */
export const DetailedFormatBadge: React.FC<{
	format: string;
	size: number;
	editable: boolean;
	className?: string;
}> = ({ format, size, editable, className }) => (
	<FormatBadge
		format={format}
		size={size}
		editable={editable}
		showSize={true}
		showEditStatus={true}
		variant="md"
		className={className}
	/>
);

export { formatFileSize };
