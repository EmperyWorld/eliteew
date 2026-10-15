/**
 * 🚀 FileUploader - Modern drag & drop file upload component
 *
 * Features:
 * - Drag & drop
 * - Progress tracking
 * - Multiple file support
 * - File type restrictions
 */

import { useCallback, useState, useRef } from 'react';
import * as React from 'react';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CheckCircleIcon,
	DocumentIcon,
	ExclamationCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface FileUploaderProps {
	/** API endpoint for upload */
	endpoint: string;
	/** Allowed file types (e.g., ['image/*', '.pdf']) */
	allowedFileTypes?: string[];
	/** Maximum file size in bytes */
	maxFileSize?: number;
	/** Maximum number of files */
	maxNumberOfFiles?: number;
	/** Callback when upload completes */
	onUploadComplete?: (files: UploadedFile[]) => void;
	/** Callback on upload error */
	onUploadError?: (error: Error) => void;
	/** Custom class name */
	className?: string;
}

interface UploadedFile {
	id: string;
	name: string;
	size: number;
	type: string;
	url?: string;
	response?: unknown;
}

interface FileWithProgress {
	file: File;
	id: string;
	progress: number;
	status: 'pending' | 'uploading' | 'complete' | 'error';
	error?: string;
	response?: unknown;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
	endpoint,
	allowedFileTypes,
	maxFileSize = 100 * 1024 * 1024, // 100MB default
	maxNumberOfFiles = 10,
	onUploadComplete,
	onUploadError,
	className = '',
}) => {
	const { token } = useAuth();
	const [files, setFiles] = useState<FileWithProgress[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const validateFile = useCallback(
		(file: File): string | null => {
			if (maxFileSize && file.size > maxFileSize) {
				return `Файл слишком большой (макс. ${Math.round(maxFileSize / 1024 / 1024)}MB)`;
			}
			if (allowedFileTypes && allowedFileTypes.length > 0) {
				const isAllowed = allowedFileTypes.some((type) => {
					if (type.startsWith('.')) {
						return file.name.toLowerCase().endsWith(type.toLowerCase());
					}
					if (type.endsWith('/*')) {
						return file.type.startsWith(type.replace('/*', '/'));
					}
					return file.type === type;
				});
				if (!isAllowed) {
					return 'Неподдерживаемый тип файла';
				}
			}
			return null;
		},
		[maxFileSize, allowedFileTypes]
	);

	const uploadFile = useCallback(
		async (fileWithProgress: FileWithProgress) => {
			const formData = new FormData();
			formData.append('file', fileWithProgress.file);

			try {
				setFiles((prev) =>
					prev.map((f) =>
						f.id === fileWithProgress.id
							? { ...f, status: 'uploading' as const }
							: f
					)
				);

				const xhr = new XMLHttpRequest();

				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						const progress = Math.round((e.loaded / e.total) * 100);
						setFiles((prev) =>
							prev.map((f) =>
								f.id === fileWithProgress.id ? { ...f, progress } : f
							)
						);
					}
				};

				await new Promise<void>((resolve, reject) => {
					xhr.onload = () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							const response = JSON.parse(xhr.responseText);
							setFiles((prev) =>
								prev.map((f) =>
									f.id === fileWithProgress.id
										? {
												...f,
												status: 'complete' as const,
												progress: 100,
												response,
											}
										: f
								)
							);
							resolve();
						} else {
							reject(new Error(`ArrowUpTrayIcon failed: ${xhr.statusText}`));
						}
					};
					xhr.onerror = () => reject(new Error('Network error'));

					xhr.open('POST', endpoint);
					if (token) {
						xhr.setRequestHeader('Authorization', `Bearer ${token}`);
					}
					xhr.send(formData);
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'ArrowUpTrayIcon failed';
				setFiles((prev) =>
					prev.map((f) =>
						f.id === fileWithProgress.id
							? { ...f, status: 'error' as const, error: errorMessage }
							: f
					)
				);
				onUploadError?.(
					error instanceof Error ? error : new Error(errorMessage)
				);
			}
		},
		[endpoint, token, onUploadError]
	);

	const addFiles = useCallback(
		(newFiles: FileList | File[]) => {
			const fileArray = Array.from(newFiles);
			const currentCount = files.length;

			if (currentCount + fileArray.length > maxNumberOfFiles) {
				alert(`Максимум ${maxNumberOfFiles} файлов`);
				return;
			}

			const filesToAdd: FileWithProgress[] = [];

			for (const file of fileArray) {
				const error = validateFile(file);
				filesToAdd.push({
					file,
					id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
					progress: 0,
					status: error ? 'error' : 'pending',
					error: error || undefined,
				});
			}

			setFiles((prev) => [...prev, ...filesToAdd]);

			// Auto-upload valid files
			for (const f of filesToAdd) {
				if (f.status === 'pending') {
					uploadFile(f);
				}
			}
		},
		[files.length, maxNumberOfFiles, validateFile, uploadFile]
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (e.dataTransfer.files.length > 0) {
				addFiles(e.dataTransfer.files);
			}
		},
		[addFiles]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const removeFile = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	const completedFiles = files.filter((f) => f.status === 'complete');

	// Notify parent when all uploads complete
	if (
		completedFiles.length > 0 &&
		completedFiles.length === files.filter((f) => f.status !== 'error').length
	) {
		const uploadedFiles: UploadedFile[] = completedFiles.map((f) => ({
			id: f.id,
			name: f.file.name,
			size: f.file.size,
			type: f.file.type,
			response: f.response,
		}));
		onUploadComplete?.(uploadedFiles);
	}

	return (
		<div className={`file-uploader ${className}`}>
			{/* Drop zone */}
			<button
				type="button"
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onClick={() => fileInputRef.current?.click()}
				className={`
          w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${
						isDragging
							? 'border-blue-500 bg-blue-500/10'
							: 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
					}
        `}
			>
				<ArrowUpTrayIcon
					className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-400' : 'text-gray-400'}`}
				/>
				<p className="text-white font-medium mb-1">
					{isDragging ? 'Отпустите файлы' : 'Перетащите файлы сюда'}
				</p>
				<p className="text-gray-400 text-sm">или нажмите для выбора</p>
				<p className="text-gray-500 text-xs mt-2">
					Максимум {maxNumberOfFiles} файлов, до{' '}
					{Math.round(maxFileSize / 1024 / 1024)}MB каждый
				</p>
			</button>

			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={allowedFileTypes?.join(',')}
				onChange={(e) => e.target.files && addFiles(e.target.files)}
				className="hidden"
			/>

			{/* File list */}
			{files.length > 0 && (
				<div className="mt-4 space-y-2">
					{files.map((f) => (
						<div
							key={f.id}
							className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
						>
							<DocumentIcon className="w-5 h-5 text-gray-400 shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="text-white text-sm truncate">{f.file.name}</p>
								<div className="flex items-center gap-2 mt-1">
									{f.status === 'uploading' && (
										<>
											<div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
												<div
													className="h-full bg-blue-500 transition-all"
													style={{ width: `${f.progress}%` }}
												/>
											</div>
											<span className="text-xs text-gray-400">
												{f.progress}%
											</span>
										</>
									)}
									{f.status === 'complete' && (
										<span className="text-xs text-green-400 flex items-center gap-1">
											<CheckCircleIcon className="w-3 h-3" /> Загружено
										</span>
									)}
									{f.status === 'error' && (
										<span className="text-xs text-red-400 flex items-center gap-1">
											<ExclamationCircleIcon className="w-3 h-3" /> {f.error}
										</span>
									)}
									{f.status === 'pending' && (
										<span className="text-xs text-gray-400 flex items-center gap-1">
											<ArrowPathIcon className="w-3 h-3 animate-spin" />{' '}
											Ожидание
										</span>
									)}
								</div>
							</div>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									removeFile(f.id);
								}}
								className="p-1 hover:bg-gray-700 rounded"
								title="Удалить"
							>
								<XMarkIcon className="w-4 h-4 text-gray-400" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default FileUploader;
