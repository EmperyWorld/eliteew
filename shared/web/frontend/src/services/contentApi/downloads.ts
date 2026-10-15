/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Blob, ticket, and browser download helpers for Unified Content.
 *
 * Invariants:
 * - Large blob downloads disable default axios timeout but honor AbortSignal.
 * - Browser downloads report terminal failures via contentDownloadResilience.
 *
 * Related:
 * - src/services/content/contentDownloadResilience.ts
 */
import type { AxiosRequestConfig } from 'axios';
import { api, apiClient } from '../api';
import { runBrowserContentDownload } from '../content/contentDownloadResilience';
import type {
	BatchDownloadToBrowserOptions,
	BlobDownloadResult,
	ContentDownloadTicketApiPayload,
	ContentDownloadTicketResponse,
	ContentDownloadToBrowserOptions,
	OwnedArchiveDownloadToBrowserOptions,
} from './types';
import {
	buildContentDownloadUrl,
	buildContentRequestConfig,
	normalizeDownloadTicketResponse,
	parseContentDispositionFilename,
	toBrowserDownloadUrl,
} from './utils';

async function getBlobDownload(
	url: string,
	config?: AxiosRequestConfig
): Promise<BlobDownloadResult> {
	const response = await apiClient.get<Blob>(url, {
		responseType: 'blob',
		// Large authenticated downloads can take minutes; don't abort them on the default 30s axios timeout.
		timeout: 0,
		...config,
	});

	return {
		blob: response.data,
		filename: parseContentDispositionFilename(
			response.headers['content-disposition']
		),
	};
}

async function downloadContentBlob(
	contentId: string,
	revision?: string | null,
	config?: AxiosRequestConfig
): Promise<BlobDownloadResult> {
	return getBlobDownload(buildContentDownloadUrl(contentId, revision), config);
}

async function createContentDownloadTicket(
	contentId: string,
	options: {
		disposition?: 'attachment' | 'inline';
		revision?: string | null;
	} = {}
): Promise<ContentDownloadTicketResponse> {
	const payload = await api.post<ContentDownloadTicketApiPayload>(
		`/content/${contentId}/download-ticket`,
		{
			disposition: options.disposition ?? 'attachment',
			v: options.revision ?? null,
		},
		buildContentRequestConfig()
	);
	return normalizeDownloadTicketResponse(payload);
}

function buildContentDirectDownloadUrl(
	contentId: string,
	ticket: string
): string | null {
	const trimmed = ticket.trim();
	if (!trimmed) {
		return null;
	}
	const path = `/api/v1/content/${contentId}/download-by-ticket?ticket=${encodeURIComponent(trimmed)}`;
	return toBrowserDownloadUrl(path);
}

async function downloadContentToBrowser(
	options: ContentDownloadToBrowserOptions
): Promise<void> {
	await runBrowserContentDownload({
		operation: 'content_download',
		contentId: options.contentId,
		preferredFilename: options.preferredFilename ?? undefined,
		fallbackDefaultFilename: 'download',
		resolveDirectUrl: async () => {
			if (options.directTicket?.trim()) {
				return buildContentDirectDownloadUrl(
					options.contentId,
					options.directTicket
				);
			}
			const ticket = await createContentDownloadTicket(options.contentId, {
				disposition: options.disposition ?? 'attachment',
				revision: options.revision ?? null,
			});
			const url = toBrowserDownloadUrl(ticket.download_url);
			return url.trim() || null;
		},
		runBlobDownload: () =>
			downloadContentBlob(options.contentId, options.revision ?? null),
	});
}

async function downloadContent(
	contentId: string,
	preferredFilename: string
): Promise<void> {
	await downloadContentToBrowser({ contentId, preferredFilename });
}

async function batchDownload(
	contentIds: string[]
): Promise<BlobDownloadResult> {
	const response = await apiClient.post<Blob>(
		'/api/v1/content/batch-download',
		{ content_ids: contentIds },
		{ responseType: 'blob', timeout: 0 }
	);

	return {
		blob: response.data,
		filename: parseContentDispositionFilename(
			response.headers['content-disposition']
		),
	};
}

async function downloadOwnedArchiveBlob(): Promise<BlobDownloadResult> {
	const response = await apiClient.post<Blob>(
		'/api/v1/content/download-owned-archive',
		{},
		{ responseType: 'blob', timeout: 0 }
	);

	return {
		blob: response.data,
		filename: parseContentDispositionFilename(
			response.headers['content-disposition']
		),
	};
}

async function createBatchDownloadTicket(
	contentIds: string[],
	archiveName?: string | null
): Promise<ContentDownloadTicketResponse> {
	const response = await apiClient.post<unknown>(
		'/api/v1/content/batch-download-ticket',
		{ content_ids: contentIds, archive_name: archiveName ?? null }
	);
	return normalizeDownloadTicketResponse(response.data);
}

function buildBatchDirectDownloadUrl(ticket: string): string | null {
	const trimmed = ticket.trim();
	if (!trimmed) {
		return null;
	}
	return toBrowserDownloadUrl(
		`/api/v1/content/batch-download-by-ticket?ticket=${encodeURIComponent(trimmed)}`
	);
}

async function batchDownloadToBrowser(
	options: BatchDownloadToBrowserOptions
): Promise<void> {
	await runBrowserContentDownload({
		operation: 'batch_download',
		archiveName: options.archiveName ?? null,
		preferredFilename: options.archiveName?.trim() || undefined,
		fallbackDefaultFilename: 'content_batch.zip',
		resolveDirectUrl: async () => {
			if (options.directTicket?.trim()) {
				return buildBatchDirectDownloadUrl(options.directTicket);
			}
			const ticket = await createBatchDownloadTicket(
				options.contentIds,
				options.archiveName ?? null
			);
			const url = toBrowserDownloadUrl(ticket.download_url);
			return url.trim() || null;
		},
		runBlobDownload: () => batchDownload(options.contentIds),
	});
}

async function createOwnedArchiveDownloadTicket(
	archiveName?: string | null
): Promise<ContentDownloadTicketResponse> {
	const response = await apiClient.post<unknown>(
		'/api/v1/content/download-owned-archive-ticket',
		{ archive_name: archiveName ?? null }
	);
	return normalizeDownloadTicketResponse(response.data);
}

function buildOwnedArchiveDirectDownloadUrl(ticket: string): string | null {
	const trimmed = ticket.trim();
	if (!trimmed) {
		return null;
	}
	return toBrowserDownloadUrl(
		`/api/v1/content/download-owned-archive-by-ticket?ticket=${encodeURIComponent(trimmed)}`
	);
}

async function downloadOwnedArchiveToBrowser(
	options: OwnedArchiveDownloadToBrowserOptions = {}
): Promise<void> {
	const ownedArchiveDefault = `owned_content_${new Date().toISOString().slice(0, 10)}.zip`;
	await runBrowserContentDownload({
		operation: 'owned_archive_download',
		archiveName: options.archiveName ?? null,
		preferredFilename: options.archiveName?.trim() || undefined,
		fallbackDefaultFilename: ownedArchiveDefault,
		resolveDirectUrl: async () => {
			if (options.directTicket?.trim()) {
				return buildOwnedArchiveDirectDownloadUrl(options.directTicket);
			}
			const ticket = await createOwnedArchiveDownloadTicket(
				options.archiveName ?? null
			);
			const url = toBrowserDownloadUrl(ticket.download_url);
			return url.trim() || null;
		},
		runBlobDownload: () => downloadOwnedArchiveBlob(),
	});
}

async function downloadOwnedArchive(): Promise<void> {
	await downloadOwnedArchiveToBrowser();
}

export const downloadApi = {
	downloadContentBlob,
	createContentDownloadTicket,
	buildContentDirectDownloadUrl,
	downloadContentToBrowser,
	downloadContent,
	batchDownload,
	downloadOwnedArchiveBlob,
	createBatchDownloadTicket,
	buildBatchDirectDownloadUrl,
	batchDownloadToBrowser,
	createOwnedArchiveDownloadTicket,
	buildOwnedArchiveDirectDownloadUrl,
	downloadOwnedArchiveToBrowser,
	downloadOwnedArchive,
};
