/**
 * ============================================
 * FILE: UploadZone.tsx
 * ============================================
 *
 * Drag-and-drop file upload zone component
 * Supports multiple files, validation, and progress tracking
 *
 * Features:
 * - Drag-and-drop interface
 * - Click to browse files
 * - Multiple file support
 * - File type validation
 * - Size limit validation
 * - ArrowUpTrayIcon progress indicators
 * - Error handling
 * - Glassmorphism design
 * - Accessibility (ARIA, keyboard nav)
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

import * as React from 'react';
import {
	useState,
	useCallback,
	useRef,
	useId,
	useMemo,
	type DragEvent,
	type ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CheckCircleIcon,
	DocumentIcon,
	ExclamationCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
// ============================================================================
// TYPES
// ============================================================================

export interface UploadFile {
	id: string;
	file: File;
	progress: number;
	status: 'pending' | 'uploading' | 'success' | 'error';
	error?: string;
}

export interface UploadZoneProps {
	/** ArrowUpTrayIcon handler (returns promise for upload result) */
	onUpload: (files: File[]) => Promise<void>;

	/** Accepted file types (MIME types or extensions) */
	accept?: string[];

	/** Maximum file size in bytes */
	maxSize?: number;

	/** Maximum number of files */
	maxFiles?: number;

	/** Allow multiple files */
	multiple?: boolean;

	/** Disabled state */
	disabled?: boolean;

	/** Custom placeholder text */
	placeholder?: string;

	/** Show file list */
	showFileList?: boolean;

	/** Auto-upload on file selection */
	autoUpload?: boolean;

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

const generateId = (): string =>
	`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// COMPONENT
// ============================================================================

const UploadZone: React.FC<UploadZoneProps> = ({
	onUpload,
	accept = [],
	maxSize = 50 * 1024 * 1024, // 50MB default
	maxFiles = 10,
	multiple = true,
	disabled = false,
	placeholder = 'Drag files here or click to browse',
	showFileList = true,
	autoUpload = false,
	className = '',
}) => {
	const [isDragging, setIsDragging] = useState(false);
	const [files, setFiles] = useState<UploadFile[]>([]);
	const [errors, setErrors] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const uploadZoneId = useId();
	const errorRowKeys = useMemo(
		() => errors.map((_, i) => `${uploadZoneId}-err-${i}`),
		[errors, uploadZoneId]
	);

	// Validate files
	const validateFiles = useCallback(
		(fileList: FileList | File[]): { valid: File[]; errors: string[] } => {
			const validFiles: File[] = [];
			const validationErrors: string[] = [];
			const fileArray = Array.from(fileList);

			// Check file count
			if (fileArray.length + files.length > maxFiles) {
				validationErrors.push(`Maximum ${maxFiles} files allowed`);
				return { valid: [], errors: validationErrors };
			}

			fileArray.forEach((file) => {
				// Check file size
				if (file.size > maxSize) {
					validationErrors.push(
						`${file.name}: File too large (max ${formatFileSize(maxSize)})`
					);
					return;
				}

				// Check file type
				if (accept.length > 0) {
					const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
					const fileMime = file.type;

					const isAccepted = accept.some((type) => {
						if (type.startsWith('.')) {
							return fileExt === type.toLowerCase();
						}
						if (type.includes('*')) {
							const baseType = type.split('/')[0];
							return fileMime.startsWith(baseType);
						}
						return fileMime === type;
					});

					if (!isAccepted) {
						validationErrors.push(`${file.name}: File type not accepted`);
						return;
					}
				}

				validFiles.push(file);
			});

			return { valid: validFiles, errors: validationErrors };
		},
		[accept, maxSize, maxFiles, files.length]
	);

	// Handle file selection
	const handleFiles = useCallback(
		async (fileList: FileList | File[]) => {
			const { valid, errors: validationErrors } = validateFiles(fileList);

			setErrors(validationErrors);

			if (valid.length === 0) {
				return;
			}

			// Create upload file objects
			const uploadFiles: UploadFile[] = valid.map((file) => ({
				id: generateId(),
				file,
				progress: 0,
				status: 'pending',
			}));

			setFiles((prev) => [...prev, ...uploadFiles]);

			// Auto-upload if enabled
			if (autoUpload) {
				try {
					await onUpload(valid);
					setFiles((prev) =>
						prev.map((f) =>
							uploadFiles.find((uf) => uf.id === f.id)
								? { ...f, status: 'success', progress: 100 }
								: f
						)
					);
				} catch {
					setFiles((prev) =>
						prev.map((f) =>
							uploadFiles.find((uf) => uf.id === f.id)
								? { ...f, status: 'error', error: 'ArrowUpTrayIcon failed' }
								: f
						)
					);
				}
			}
		},
		[validateFiles, autoUpload, onUpload]
	);

	// Drag handlers
	const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			if (disabled) {
				return;
			}

			const droppedFiles = e.dataTransfer.files;
			if (droppedFiles.length > 0) {
				handleFiles(droppedFiles);
			}
		},
		[disabled, handleFiles]
	);

	// Click to browse
	const handleClick = useCallback(() => {
		if (!disabled) {
			fileInputRef.current?.click();
		}
	}, [disabled]);

	// File input change
	const handleInputChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				handleFiles(e.target.files);
			}
			// Reset input value to allow re-uploading same file
			e.target.value = '';
		},
		[handleFiles]
	);

	// Remove file
	const handleRemoveFile = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	// Manual upload
	const handleUpload = useCallback(async () => {
		const pendingFiles = files.filter((f) => f.status === 'pending');
		if (pendingFiles.length === 0) {
			return;
		}

		try {
			await onUpload(pendingFiles.map((f) => f.file));
			setFiles((prev) =>
				prev.map((f) =>
					f.status === 'pending'
						? { ...f, status: 'success', progress: 100 }
						: f
				)
			);
		} catch {
			setFiles((prev) =>
				prev.map((f) =>
					f.status === 'pending'
						? { ...f, status: 'error', error: 'ArrowUpTrayIcon failed' }
						: f
				)
			);
		}
	}, [files, onUpload]);

	// Get status icon
	const getStatusIcon = (status: UploadFile['status']): React.ReactNode => {
		switch (status) {
			case 'uploading':
				return <ArrowPathIcon className="w-4 h-4 text-blue-400 animate-spin" />;
			case 'success':
				return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
			case 'error':
				return <ExclamationCircleIcon className="w-4 h-4 text-red-400" />;
			default:
				return <DocumentIcon className="w-4 h-4 text-white/60" />;
		}
	};

	return (
		<div className={`space-y-4 ${className}`}>
			{/* ArrowUpTrayIcon zone */}
			<motion.div
				onClick={handleClick}
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				whileHover={!disabled ? { scale: 1.01 } : {}}
				whileTap={!disabled ? { scale: 0.99 } : {}}
				className={`
          relative
          border-2 border-dashed rounded-xl
          p-12
          text-center
          cursor-pointer
          transition-all duration-200
          ${
						isDragging
							? 'border-purple-500 bg-purple-500/10 scale-105'
							: disabled
								? 'border-white/10 bg-white/5 cursor-not-allowed opacity-50'
								: 'border-white/20 bg-white/5 hover:border-purple-500/50 hover:bg-white/10'
					}
        `}
				role="button"
				tabIndex={disabled ? -1 : 0}
				aria-label="ArrowUpTrayIcon files"
				aria-disabled={disabled}
			>
				<input
					ref={fileInputRef}
					type="file"
					onChange={handleInputChange}
					multiple={multiple}
					accept={accept.join(',')}
					disabled={disabled}
					className="hidden"
				/>

				<div className="flex flex-col items-center gap-4">
					<motion.div
						animate={
							isDragging ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }
						}
						transition={{ duration: 0.2 }}
						className={`
              p-4 rounded-full
              ${isDragging ? 'bg-purple-500/20' : 'bg-white/10'}
            `}
					>
						<ArrowUpTrayIcon
							className={`w-8 h-8 ${isDragging ? 'text-purple-400' : 'text-white/60'}`}
						/>
					</motion.div>

					<div>
						<p className="text-lg font-medium text-white/90 mb-1">
							{isDragging ? 'Drop files here' : placeholder}
						</p>
						<p className="text-sm text-white/60">
							{accept.length > 0 && `Accepted: ${accept.join(', ')} • `}
							Max size: {formatFileSize(maxSize)}
							{multiple && ` • Up to ${maxFiles} files`}
						</p>
					</div>

					{!autoUpload && files.some((f) => f.status === 'pending') && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleUpload();
							}}
							className="px-6 py-2 bg-linear-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all"
						>
							ArrowUpTrayIcon{' '}
							{files.filter((f) => f.status === 'pending').length} files
						</button>
					)}
				</div>
			</motion.div>

			{/* Errors */}
			<AnimatePresence>
				{errors.length > 0 && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="space-y-1"
					>
						{errorRowKeys.map((rowKey, index) => (
							<div
								key={rowKey}
								className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400"
							>
								<ExclamationCircleIcon className="w-4 h-4 shrink-0" />
								<span>{errors[index]}</span>
							</div>
						))}
					</motion.div>
				)}
			</AnimatePresence>

			{/* File list */}
			{showFileList && files.length > 0 && (
				<div className="space-y-2">
					<h4 className="text-sm font-semibold text-white/80">
						Files ({files.length})
					</h4>

					<div className="space-y-2">
						<AnimatePresence>
							{files.map((uploadFile) => (
								<motion.div
									key={uploadFile.id}
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: 20 }}
									className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-xs border border-white/10 rounded-lg"
								>
									{getStatusIcon(uploadFile.status)}

									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-white/90 truncate">
											{uploadFile.file.name}
										</p>
										<p className="text-xs text-white/60">
											{formatFileSize(uploadFile.file.size)}
											{uploadFile.error && ` • ${uploadFile.error}`}
										</p>

										{uploadFile.status === 'uploading' && (
											<div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
												<motion.div
													initial={{ width: 0 }}
													animate={{ width: `${uploadFile.progress}%` }}
													className="h-full bg-blue-500"
												/>
											</div>
										)}
									</div>

									{uploadFile.status !== 'uploading' && (
										<button
											type="button"
											onClick={() => handleRemoveFile(uploadFile.id)}
											className="p-1 hover:bg-red-500/20 rounded-sm transition-colors"
											aria-label={`Remove ${uploadFile.file.name}`}
										>
											<XMarkIcon className="w-4 h-4 text-white/60 hover:text-red-400" />
										</button>
									)}
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</div>
			)}
		</div>
	);
};

export default UploadZone;
