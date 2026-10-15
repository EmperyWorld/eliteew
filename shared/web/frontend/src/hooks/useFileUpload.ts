/**
 * useFileUpload Hook
 *
 * Handles file uploads to Unified Content API with progress tracking.
 * Provides type-safe upload operations with comprehensive error handling.
 *
 * @module hooks/useFileUpload
 *
 * @example
 * Basic usage:
 * ```tsx
 * function FileUploader() {
 *   const { uploadFile, uploading, progress, error, reset } = useFileUpload();
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (!file) return;
 *
 *     try {
 *       const result = await uploadFile(file, {
 *         visibility: VisibilityLevel.PRIVATE,
 *         tags: ['invoice', 'Q4-2024'],
 *       });
 *       log.info('Uploaded:', result.id);
 *     } catch (err) {
 *       log.error('Upload failed:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={uploading} />
 *       {uploading && <Progress value={progress} />}
 *       {error && <Error message={error} onDismiss={reset} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * With validation:
 * ```tsx
 * const { uploadFile } = useFileUpload();
 *
 * const handleUpload = async (file: File) => {
 *   const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
 *   const allowedTypes = ['image/jpeg', 'image/png'];
 *
 *   if (!validateFileSize(file, MAX_SIZE)) {
 *     throw new Error('File too large');
 *   }
 *
 *   if (!validateFileType(file, allowedTypes)) {
 *     throw new Error('Invalid file type');
 *   }
 *
 *   return uploadFile(file);
 * };
 * ```
 */

import { useState, useCallback } from 'react';
import { AxiosError, type AxiosProgressEvent } from 'axios';
import { apiClient } from '../services/api';
import { log } from '../utils/logger';
import {
	type UploadOptions,
	type UploadResult,
	type UseFileUploadResult,
	toUploadResult,
	isApiErrorResponse,
	UploadError,
} from '../types/fileExchange';

import { API_CONFIG } from '../services/api/config';

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Handles file uploads to Unified Content API
 *
 * Features:
 * - Real-time upload progress tracking
 * - Type-safe upload options
 * - Comprehensive error handling
 * - Automatic state management
 * - Reset functionality for error recovery
 *
 * @returns Hook result with upload function, state, and reset
 *
 * @example
 * ```tsx
 * const { uploadFile, uploading, progress, error, reset } = useFileUpload();
 * ```
 */
export const useFileUpload = (): UseFileUploadResult => {
	const [uploading, setUploading] = useState<boolean>(false);
	const [progress, setProgress] = useState<number>(0);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Uploads a file to the Unified Content API
	 *
	 * @param file - File to upload
	 * @param options - Upload options (tags, visibility, content type, etc.)
	 * @returns Promise resolving to upload result with file ID
	 *
	 * @throws {UploadError} When upload fails
	 *
	 * @example
	 * ```tsx
	 * const result = await uploadFile(file, {
	 *   tags: ['invoice', 'Q4-2024'],
	 *   visibility: VisibilityLevel.PRIVATE,
	 *   contentType: ContentType.DOCUMENT,
	 *   description: 'Monthly financial report'
	 * });
	 * log.info('File ID:', result.id);
	 * ```
	 */
	const uploadFile = useCallback(
		async (file: File, options: UploadOptions = {}): Promise<UploadResult> => {
			// Reset state
			setUploading(true);
			setProgress(0);
			setError(null);

			try {
				// Build FormData
				const formData = new FormData();
				formData.append('file', file);
				formData.append('name', file.name);

				// Add optional fields
				if (options.tags && options.tags.length > 0) {
					formData.append('tags', options.tags.join(','));
				}

				if (options.visibility) {
					formData.append('visibility', options.visibility);
				}

				if (options.contentType) {
					formData.append('content_type', options.contentType);
				}

				if (options.description) {
					formData.append('description', options.description);
				}

				// Upload with progress tracking
				const response = await apiClient.post<unknown>(
					'/api/v1/content',
					formData,
					{
						headers: {
							'Content-Type': 'multipart/form-data',
						},
						timeout: API_CONFIG.uploadTimeout,
						onUploadProgress: (progressEvent: AxiosProgressEvent) => {
							if (progressEvent.total) {
								const percentCompleted = Math.round(
									(progressEvent.loaded * 100) / progressEvent.total
								);
								setProgress(percentCompleted);
							}
						},
					}
				);

				// Validate and transform response
				const uploadResult = toUploadResult(response.data);

				// Success state
				setProgress(100);
				setUploading(false);
				setError(null);

				return uploadResult;
			} catch (err) {
				log.error(
					'useFileUpload',
					'Upload failed',
					err instanceof Error ? err : undefined,
					err
				);

				// Extract error message
				let errorMessage = 'Ошибка загрузки';

				if (err instanceof AxiosError) {
					if (err.code === 'ECONNABORTED') {
						errorMessage =
							'Превышено время ожидания - файл слишком большой или медленное соединение';
					} else if (err.response?.status === 413) {
						errorMessage = 'Файл слишком большой';
					} else if (err.response?.status === 415) {
						errorMessage = 'Тип файла не поддерживается';
					} else if (
						err.response?.data &&
						isApiErrorResponse(err.response.data)
					) {
						errorMessage = err.response.data.detail;
					} else if (err.message) {
						errorMessage = err.message;
					}
				} else if (err instanceof Error) {
					errorMessage = err.message;
				}

				// Update error state
				setError(errorMessage);
				setUploading(false);
				setProgress(0);

				// Throw UploadError with context
				throw new UploadError(
					errorMessage,
					file.name,
					err instanceof AxiosError ? err.code : undefined,
					err
				);
			}
		},
		[]
	);

	/**
	 * Resets upload state (error and progress)
	 * Useful for error recovery and UI cleanup
	 *
	 * @example
	 * ```tsx
	 * {error && (
	 *   <Alert onClose={reset}>
	 *     {error}
	 *   </Alert>
	 * )}
	 * ```
	 */
	const reset = useCallback((): void => {
		setError(null);
		setProgress(0);
		setUploading(false);
	}, []);

	return {
		uploadFile,
		uploading,
		progress,
		error,
		reset,
	};
};

/**
 * Type guard to check if upload is in progress
 *
 * @param state - Upload state from hook
 * @returns True if upload is in progress
 *
 * @example
 * ```tsx
 * const uploadState = useFileUpload();
 * if (isUploading(uploadState)) {
 *   return <Spinner />;
 * }
 * ```
 */
export const isUploading = (state: UseFileUploadResult): boolean => {
	return state.uploading;
};

/**
 * Type guard to check if upload has error
 *
 * @param state - Upload state from hook
 * @returns True if upload has error
 */
export const hasUploadError = (
	state: UseFileUploadResult
): state is UseFileUploadResult & { error: string } => {
	return state.error !== null;
};
