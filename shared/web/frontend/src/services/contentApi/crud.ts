/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Upload, update, delete, and comment mutations for Unified Content.
 *
 * Invariants:
 * - Multipart uploads use normalized filenames and default upload timeout.
 *
 * Related:
 * - src/utils/uploadMultipartFilename.ts
 */
import type { AxiosRequestConfig } from 'axios';
import type { Content } from '../../components/UnifiedContent/types';
import { normalizeFileForMultipartUpload } from '../../utils/uploadMultipartFilename';
import { api, apiClient } from '../api';
import { API_CONFIG } from '../api/config';
import { normalizeContentItem } from './normalizers';
import type { ContentItemApiPayload } from './types';
import {
	buildContentRequestConfig,
	toQueryParams,
	toStringValue,
} from './utils';

async function uploadContent(
	file: File,
	query: Record<string, unknown>,
	options: {
		onProgress?: (progress: number) => void;
		signal?: AbortSignal;
		timeout?: number;
	} = {}
): Promise<Content> {
	const uploadFile = normalizeFileForMultipartUpload(file);
	const formData = new FormData();
	formData.append('file', uploadFile, uploadFile.name);

	const response = await apiClient.post<unknown>('/api/v1/content', formData, {
		params: toQueryParams(query),
		signal: options.signal,
		timeout: options.timeout ?? API_CONFIG.uploadTimeout,
		headers: {
			'Content-Type': 'multipart/form-data',
		},
		onUploadProgress: (progressEvent) => {
			if (!options.onProgress || !progressEvent.total) {
				return;
			}
			options.onProgress(
				Math.round((progressEvent.loaded * 100) / progressEvent.total)
			);
		},
	});

	return normalizeContentItem(response.data);
}

async function replaceContentFile(
	contentId: string,
	file: File,
	options: {
		onProgress?: (progress: number) => void;
		signal?: AbortSignal;
		timeout?: number;
	} = {}
): Promise<Content> {
	const uploadFile = normalizeFileForMultipartUpload(file);
	const formData = new FormData();
	formData.append('file', uploadFile, uploadFile.name);

	const response = await apiClient.post<unknown>(
		`/api/v1/content/${contentId}/replace-file`,
		formData,
		{
			signal: options.signal,
			timeout: options.timeout ?? API_CONFIG.uploadTimeout,
			headers: {
				'Content-Type': 'multipart/form-data',
			},
			onUploadProgress: (progressEvent) => {
				if (!options.onProgress || !progressEvent.total) {
					return;
				}
				options.onProgress(
					Math.round((progressEvent.loaded * 100) / progressEvent.total)
				);
			},
		}
	);

	return normalizeContentItem(response.data);
}

async function reprocessContentDisplay(
	contentId: string,
	config?: AxiosRequestConfig
): Promise<{ status: string; content_id: string }> {
	const payload = await api.post<{
		status?: unknown;
		content_id?: unknown;
	}>(`/content/${contentId}/reprocess`, {}, buildContentRequestConfig(config));
	return {
		status: toStringValue(payload.status, 'queued'),
		content_id: toStringValue(payload.content_id, contentId),
	};
}

async function updateContent(
	contentId: string,
	updates: Record<string, unknown>
): Promise<Content> {
	const payload = await api.patch<ContentItemApiPayload>(
		`/content/${contentId}`,
		updates,
		buildContentRequestConfig()
	);
	return normalizeContentItem(payload);
}

async function copyContent(contentId: string, name: string): Promise<Content> {
	const payload = await api.post<ContentItemApiPayload>(
		`/content/${contentId}/copy`,
		{ name: name.trim() },
		buildContentRequestConfig()
	);
	return normalizeContentItem(payload);
}

async function deleteContent(contentId: string): Promise<void> {
	await api.delete(`/content/${contentId}`, buildContentRequestConfig());
}

async function addComment(
	contentId: string,
	comment: string
): Promise<Content> {
	const payload = await api.post<{ content?: unknown }>(
		`/content/${contentId}/comment`,
		{ comment },
		buildContentRequestConfig()
	);
	return normalizeContentItem(payload.content);
}

async function deleteComment(
	contentId: string,
	commentId: string
): Promise<Content> {
	const payload = await api.delete<{ content?: unknown }>(
		`/content/${contentId}/comment/${commentId}`,
		buildContentRequestConfig()
	);
	return normalizeContentItem(payload.content);
}

export const crudApi = {
	uploadContent,
	replaceContentFile,
	reprocessContentDisplay,
	updateContent,
	copyContent,
	deleteContent,
	addComment,
	deleteComment,
};
