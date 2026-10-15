/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Version list, revert, and download endpoints for Unified Content.
 *
 * Invariants:
 * - Browser version downloads use ticket-first flow with blob fallback.
 *
 * Related:
 * - src/services/content/contentDownloadResilience.ts
 */
import type { Version } from '../../components/UnifiedContent/types';
import { api, apiClient } from '../api';
import { runBrowserContentDownload } from '../content/contentDownloadResilience';
import { normalizeVersionItem, normalizeVersionList } from './normalizers';
import type {
	BlobDownloadResult,
	ContentDownloadTicketResponse,
	ContentVersionApiPayload,
	ContentVersionListApiPayload,
	VersionDownloadToBrowserOptions,
} from './types';
import {
	buildContentRequestConfig,
	normalizeDownloadTicketResponse,
	parseContentDispositionFilename,
	toBrowserDownloadUrl,
} from './utils';

async function getBlobDownload(
	url: string,
	config?: import('axios').AxiosRequestConfig
): Promise<BlobDownloadResult> {
	const response = await apiClient.get<Blob>(url, {
		responseType: 'blob',
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

async function listVersions(contentId: string): Promise<Version[]> {
	const payload = await api.get<ContentVersionListApiPayload>(
		`/content/${contentId}/versions`,
		buildContentRequestConfig()
	);
	return normalizeVersionList(payload);
}

async function downloadVersionBlob(
	versionId: string
): Promise<BlobDownloadResult> {
	return getBlobDownload(`/api/v1/content/versions/${versionId}/download`);
}

async function createVersionDownloadTicket(
	versionId: string
): Promise<ContentDownloadTicketResponse> {
	const response = await apiClient.post<unknown>(
		`/api/v1/content/versions/${versionId}/download-ticket`,
		{}
	);
	return normalizeDownloadTicketResponse(response.data);
}

function buildVersionDirectDownloadUrl(
	versionId: string,
	ticket: string
): string | null {
	const trimmed = ticket.trim();
	if (!trimmed) {
		return null;
	}
	return toBrowserDownloadUrl(
		`/api/v1/content/versions/${versionId}/download-by-ticket?ticket=${encodeURIComponent(trimmed)}`
	);
}

async function downloadVersionToBrowser(
	options: VersionDownloadToBrowserOptions
): Promise<void> {
	const fallback = options.fallbackFilename?.trim() || 'version-download';
	await runBrowserContentDownload({
		operation: 'version_download',
		versionId: options.versionId,
		preferredFilename: options.fallbackFilename ?? undefined,
		fallbackDefaultFilename: fallback,
		resolveDirectUrl: async () => {
			if (options.directTicket?.trim()) {
				return buildVersionDirectDownloadUrl(
					options.versionId,
					options.directTicket
				);
			}
			const ticket = await createVersionDownloadTicket(options.versionId);
			const url = toBrowserDownloadUrl(ticket.download_url);
			return url.trim() || null;
		},
		runBlobDownload: () => downloadVersionBlob(options.versionId),
	});
}

async function downloadVersion(
	versionId: string,
	fallbackFilename: string
): Promise<void> {
	await downloadVersionToBrowser({ versionId, fallbackFilename });
}

async function revertVersion(
	contentId: string,
	versionNumber: number,
	payload: Record<string, unknown>
): Promise<Version> {
	const versionPayload = await api.post<ContentVersionApiPayload>(
		`/content/${contentId}/revert/${versionNumber}`,
		payload,
		buildContentRequestConfig()
	);
	return normalizeVersionItem(versionPayload);
}

export const versionsApi = {
	listVersions,
	downloadVersionBlob,
	createVersionDownloadTicket,
	buildVersionDirectDownloadUrl,
	downloadVersionToBrowser,
	downloadVersion,
	revertVersion,
};
