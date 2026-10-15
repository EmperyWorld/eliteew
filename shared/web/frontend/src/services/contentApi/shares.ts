/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Share CRUD endpoints for Unified Content ACL delegation.
 *
 * Invariants:
 * - Share payloads normalize legacy permission field aliases.
 *
 * Related:
 * - src/services/contentApi/normalizers.ts
 */
import type {
	Share,
	ShareResponse,
} from '../../components/UnifiedContent/types';
import { api } from '../api';
import { normalizeShareItem, normalizeShareResponseItem } from './normalizers';
import type {
	ContentShareApiPayload,
	ContentShareResponseApiPayload,
} from './types';
import { buildContentRequestConfig } from './utils';

async function listContentShares(contentId: string): Promise<Share[]> {
	const payload = await api.get<ContentShareApiPayload[]>(
		`/content/${contentId}/shares`,
		buildContentRequestConfig()
	);
	return Array.isArray(payload) ? payload.map(normalizeShareItem) : [];
}

async function listReceivedShares(): Promise<ShareResponse[]> {
	const payload = await api.get<ContentShareResponseApiPayload[]>(
		'/content/shares/received',
		buildContentRequestConfig()
	);
	return Array.isArray(payload) ? payload.map(normalizeShareResponseItem) : [];
}

async function createShare(
	contentId: string,
	payload: Record<string, unknown>
): Promise<Share> {
	const responsePayload = await api.post<ContentShareApiPayload>(
		`/content/${contentId}/shares`,
		payload,
		buildContentRequestConfig()
	);
	return normalizeShareItem(responsePayload);
}

async function updateShare(
	shareId: string,
	payload: Record<string, unknown>
): Promise<Share> {
	const responsePayload = await api.patch<ContentShareApiPayload>(
		`/content/shares/${shareId}`,
		payload,
		buildContentRequestConfig()
	);
	return normalizeShareItem(responsePayload);
}

async function deleteShare(shareId: string): Promise<void> {
	await api.delete(`/content/shares/${shareId}`, buildContentRequestConfig());
}

export const sharesApi = {
	listContentShares,
	listReceivedShares,
	createShare,
	updateShare,
	deleteShare,
};
