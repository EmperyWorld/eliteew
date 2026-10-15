/**
 * ============================================
 * FILE: FileCard.tsx
 * ============================================
 *
 * Individual file card component for grid/list views
 * Displays file preview, metadata, and quick actions
 *
 * Features:
 * - File thumbnail/icon
 * - File name and metadata
 * - Quick actions (download, share, delete)
 * - Selection state
 * - Hover effects with glassmorphism
 * - Responsive design
 * - Accessibility (ARIA, keyboard nav)
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

import * as React from 'react';
import { useState } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowTopRightOnSquareIcon,
	CheckIcon,
	EllipsisVerticalIcon,
	EyeIcon,
	PencilSquareIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import FileTypeIcon from './FileTypeIcon';
import FormatBadge from './FormatBadge';

// ============================================================================
// TYPES
// ============================================================================

export interface FileCardProps {
	/** File ID */
	id: string;

	/** File name */
	name: string;

	/** File extension/format */
	format: string;

	/** File size in bytes */
	size?: number;

	/** Thumbnail URL */
	thumbnailUrl?: string;

	/** Last modified date */
	lastModified?: Date;

	/** Is file editable */
	editable?: boolean;

	/** Is file selected */
	selected?: boolean;

	/** Selection handler */
	onSelect?: (id: string) => void;

	/** Click handler */
	onClick?: (id: string) => void;

	/** ArrowDownTrayIcon handler */
	onDownload?: (id: string) => void;

	/** Share handler */
	onShare?: (id: string) => void;

	/** Delete handler */
	onDelete?: (id: string) => void;

	/** Preview handler */
	onPreview?: (id: string) => void;

	/** Edit handler */
	onEdit?: (id: string) => void;

	/** Card variant */
	variant?: 'grid' | 'list';

	/** Show quick actions */
	showActions?: boolean;

	/** Additional CSS classes */
	className?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

const formatFileSize = (bytes: number): string => {
	if (bytes === 0) {
		return '0 B';
	}
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (date: Date): string => {
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (days === 0) {
		return 'Today';
	}
	if (days === 1) {
		return 'Yesterday';
	}
	if (days < 7) {
		return `${days} days ago`;
	}

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
};

// ============================================================================
// COMPONENT
// ============================================================================

const FileCard: React.FC<FileCardProps> = ({
	id,
	name,
	format,
	size,
	thumbnailUrl,
	lastModified,
	editable = false,
	selected = false,
	onSelect,
	onClick,
	onDownload,
	onShare,
	onDelete,
	onPreview,
	onEdit,
	variant = 'grid',
	showActions = true,
	className = '',
}) => {
	const [showMenu, setShowMenu] = useState(false);

	// Grid variant
	if (variant === 'grid') {
		return (
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				whileHover={{ scale: 1.02 }}
				whileTap={{ scale: 0.98 }}
				className={`
          relative
          group
          p-4
          bg-white/10 backdrop-blur-xl
          border-2
          ${selected ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-white/10'}
          rounded-xl
          cursor-pointer
          transition-all duration-200
          hover:bg-white/15 hover:border-white/30
          ${className}
        `}
				onClick={() => onClick?.(id)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onClick?.(id);
					}
				}}
				role="button"
				tabIndex={0}
				aria-label={`File: ${name}`}
				aria-selected={selected}
			>
				{/* Selection checkbox */}
				{onSelect && (
					<button
						type="button"
						className="absolute top-3 left-3 z-10"
						onClick={(e) => {
							e.stopPropagation();
							onSelect(id);
						}}
						aria-label={selected ? 'Deselect file' : 'Select file'}
						aria-pressed={selected}
					>
						<div
							className={`
                w-5 h-5
                border-2
                rounded
                flex items-center justify-center
                transition-all
                ${
									selected
										? 'bg-purple-500 border-purple-500'
										: 'bg-white/10 border-white/30 hover:border-purple-500/50'
								}
              `}
						>
							{selected && <CheckIcon className="w-3 h-3 text-white" />}
						</div>
					</button>
				)}

				{/* Thumbnail or icon */}
				<div className="aspect-square rounded-lg overflow-hidden mb-3 bg-black/20 flex items-center justify-center">
					{thumbnailUrl ? (
						<img
							src={thumbnailUrl}
							alt={name}
							className="w-full h-full object-cover"
						/>
					) : (
						<FileTypeIcon type={format} size="xl" />
					)}
				</div>

				{/* File info */}
				<div className="space-y-2">
					<div>
						<h3
							className="text-sm font-medium text-white/90 truncate"
							title={name}
						>
							{name}
						</h3>
						{size && (
							<p className="text-xs text-white/60 mt-0.5">
								{formatFileSize(size)}
							</p>
						)}
					</div>

					<FormatBadge
						format={format}
						size={size}
						editable={editable}
						variant="sm"
						showSize={false}
					/>

					{lastModified && (
						<p className="text-xs text-white/50">{formatDate(lastModified)}</p>
					)}
				</div>

				{/* Quick actions (on hover) */}
				{showActions && (
					<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
						<div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xs rounded-lg p-1">
							{onPreview && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onPreview(id);
									}}
									className="p-1.5 hover:bg-white/10 rounded-sm transition-colors"
									title="Preview"
									aria-label="Preview file"
								>
									<EyeIcon className="w-4 h-4 text-white/80" />
								</button>
							)}

							{onDownload && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDownload(id);
									}}
									className="p-1.5 hover:bg-white/10 rounded-sm transition-colors"
									title="ArrowDownTrayIcon"
									aria-label="ArrowDownTrayIcon file"
								>
									<ArrowDownTrayIcon className="w-4 h-4 text-white/80" />
								</button>
							)}

							{onShare && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onShare(id);
									}}
									className="p-1.5 hover:bg-white/10 rounded-sm transition-colors"
									title="Share"
									aria-label="Share file"
								>
									<ArrowTopRightOnSquareIcon className="w-4 h-4 text-white/80" />
								</button>
							)}

							{onDelete && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDelete(id);
									}}
									className="p-1.5 hover:bg-red-500/20 rounded-sm transition-colors"
									title="Delete"
									aria-label="Delete file"
								>
									<TrashIcon className="w-4 h-4 text-white/80 hover:text-red-400" />
								</button>
							)}
						</div>
					</div>
				)}
			</motion.div>
		);
	}

	// List variant
	return (
		<motion.div
			initial={{ opacity: 0, x: -20 }}
			animate={{ opacity: 1, x: 0 }}
			whileHover={{ x: 4 }}
			className={`
        flex items-center gap-4
        p-3
        bg-white/5 backdrop-blur-xs
        border
        ${selected ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-500/10' : 'border-white/10'}
        rounded-lg
        cursor-pointer
        transition-all duration-200
        hover:bg-white/10 hover:border-white/20
        ${className}
      `}
			onClick={() => onClick?.(id)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick?.(id);
				}
			}}
			role="button"
			tabIndex={0}
			aria-label={`File: ${name}`}
			aria-selected={selected}
		>
			{/* Selection checkbox */}
			{onSelect && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onSelect(id);
					}}
					aria-label={selected ? 'Deselect file' : 'Select file'}
					aria-pressed={selected}
				>
					<div
						className={`
              w-5 h-5
              border-2
              rounded
              flex items-center justify-center
              transition-all
              ${
								selected
									? 'bg-purple-500 border-purple-500'
									: 'bg-white/10 border-white/30 hover:border-purple-500/50'
							}
            `}
					>
						{selected && <CheckIcon className="w-3 h-3 text-white" />}
					</div>
				</button>
			)}

			{/* Icon/Thumbnail */}
			<div className="shrink-0">
				{thumbnailUrl ? (
					<img
						src={thumbnailUrl}
						alt={name}
						className="w-10 h-10 rounded-sm object-cover"
					/>
				) : (
					<FileTypeIcon type={format} size="md" />
				)}
			</div>

			{/* File info */}
			<div className="flex-1 min-w-0">
				<h3 className="text-sm font-medium text-white/90 truncate" title={name}>
					{name}
				</h3>
				<div className="flex items-center gap-2 mt-0.5">
					<FormatBadge
						format={format}
						variant="sm"
						showSize={false}
						showEditStatus={false}
					/>
					{size && (
						<span className="text-xs text-white/60">
							{formatFileSize(size)}
						</span>
					)}
					{lastModified && (
						<>
							<span className="text-xs text-white/40">•</span>
							<span className="text-xs text-white/50">
								{formatDate(lastModified)}
							</span>
						</>
					)}
				</div>
			</div>

			{/* Actions */}
			{showActions && (
				<div className="flex items-center gap-1">
					{onEdit && editable && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onEdit(id);
							}}
							className="p-2 hover:bg-white/10 rounded-sm transition-colors"
							title="Edit"
							aria-label="Edit file"
						>
							<PencilSquareIcon className="w-4 h-4 text-white/80" />
						</button>
					)}

					{onDownload && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onDownload(id);
							}}
							className="p-2 hover:bg-white/10 rounded-sm transition-colors"
							title="ArrowDownTrayIcon"
							aria-label="ArrowDownTrayIcon file"
						>
							<ArrowDownTrayIcon className="w-4 h-4 text-white/80" />
						</button>
					)}

					{onShare && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onShare(id);
							}}
							className="p-2 hover:bg-white/10 rounded-sm transition-colors"
							title="Share"
							aria-label="Share file"
						>
							<ArrowTopRightOnSquareIcon className="w-4 h-4 text-white/80" />
						</button>
					)}

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setShowMenu(!showMenu);
						}}
						className="p-2 hover:bg-white/10 rounded-sm transition-colors"
						title="More options"
						aria-label="More options"
					>
						<EllipsisVerticalIcon className="w-4 h-4 text-white/80" />
					</button>
				</div>
			)}
		</motion.div>
	);
};

export default FileCard;
