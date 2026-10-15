/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Feedback Hub ticket types, list normalizers, and user/admin HTTP client for `/feedback`.
 *
 * Invariants:
 * - List endpoints always normalize to `{ items, total }` for React Query.
 *
 * Related:
 * - `shared/api/routers/product_desktop.py`
 * - `documentation/product/FEEDBACK-HUB.md`
 */

import { api } from '../../../../services/api/client';
import { PRODUCT_DESKTOP_API_BASE } from './constants';

const BASE = PRODUCT_DESKTOP_API_BASE;

export type FeedbackTicket = {
	id: string;
	kind: string;
	body: string;
	status: string;
	admin_notes: string | null;
	reward_credits: number | null;
	closed_at: string | null;
	created_at: string;
	updated_at: string;
	/** Client context from submit (build, UA) */
	client_meta?: Record<string, unknown> | null;
};

/** Автор обращения (админ-очередь). */
export type FeedbackSubmitter = {
	id: string;
	username: string;
	email: string;
	full_name: string | null;
	avatar_url: string | null;
};

export type FeedbackTicketAdmin = FeedbackTicket & {
	user_id: string;
	submitter?: FeedbackSubmitter | null;
};

export type FeedbackTicketListPage = {
	items: FeedbackTicket[];
	total: number;
};

/** GET /feedback/summary — лимиты и «признание от команды» (не валюта). */
export type FeedbackSummary = {
	is_trusted: boolean;
	wish_count: number;
	wish_limit: number;
	bug_count: number;
	bug_limit: number;
	team_recognition_total: number;
};

export type FeedbackTicketAdminListPage = {
	items: FeedbackTicketAdmin[];
	total: number;
};

/** Parse total from API (number or numeric string). */
function parseFeedbackListTotal(v: unknown): number {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string') {
		const n = Number.parseInt(v, 10);
		if (Number.isFinite(n)) return n;
	}
	return 0;
}

/**
 * Normalize GET list responses so React Query always sees `{ items, total }`.
 * Handles occasional non-number `total`, nested `{ data: { items, total } }`, or empty payloads.
 */
export function normalizeFeedbackTicketListPage(
	raw: unknown
): FeedbackTicketListPage {
	if (raw == null || typeof raw !== 'object') {
		return { items: [], total: 0 };
	}
	let o = raw as Record<string, unknown>;
	if (!Array.isArray(o.items) && o.data != null && typeof o.data === 'object') {
		o = o.data as Record<string, unknown>;
	}
	const items = Array.isArray(o.items) ? (o.items as FeedbackTicket[]) : [];
	let total = parseFeedbackListTotal(o.total);
	if (items.length > 0 && total < items.length) {
		total = items.length;
	}
	return { items, total };
}

export function normalizeFeedbackAdminListPage(
	raw: unknown
): FeedbackTicketAdminListPage {
	const n = normalizeFeedbackTicketListPage(raw);
	return {
		items: n.items as FeedbackTicketAdmin[],
		total: n.total,
	};
}

export async function createFeedbackTicket(body: {
	kind: 'wish' | 'bug';
	body: string;
	client_meta?: Record<string, unknown> | null;
}): Promise<FeedbackTicket> {
	return api.post<FeedbackTicket>(`${BASE}/feedback/tickets`, body);
}

export async function fetchFeedbackSummary(): Promise<FeedbackSummary> {
	return api.get<FeedbackSummary>(`${BASE}/feedback/summary`);
}

export async function listMyFeedbackTickets(params?: {
	limit?: number;
	offset?: number;
	/** Серверный фильтр wish | bug */
	kind?: 'wish' | 'bug';
}): Promise<FeedbackTicketListPage> {
	const data = await api.get<unknown>(`${BASE}/feedback/tickets`, {
		params,
	});
	return normalizeFeedbackTicketListPage(data);
}

export async function adminListFeedbackTickets(params?: {
	status?: string;
	limit?: number;
	offset?: number;
	kind?: 'wish' | 'bug';
	/** Поиск по body и id тикета */
	q?: string;
	/** Показывать закрытые при просмотре «все статусы» (без фильтра по status). По умолчанию на сервере закрытые скрыты. */
	include_closed?: boolean;
}): Promise<FeedbackTicketAdminListPage> {
	const data = await api.get<unknown>(`${BASE}/admin/feedback/tickets`, {
		params,
	});
	return normalizeFeedbackAdminListPage(data);
}

export async function adminPatchFeedbackTicket(
	id: string,
	body: { status?: string; admin_notes?: string | null }
): Promise<FeedbackTicketAdmin> {
	return api.patch<FeedbackTicketAdmin>(
		`${BASE}/admin/feedback/tickets/${id}`,
		body
	);
}

export async function adminCloseFeedbackTicket(
	id: string,
	body: { reward_credits?: number | null; admin_notes?: string | null }
): Promise<FeedbackTicketAdmin> {
	return api.post<FeedbackTicketAdmin>(
		`${BASE}/admin/feedback/tickets/${id}/close`,
		body
	);
}
