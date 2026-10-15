/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSE transport for Desktop AI Chat (`POST …/stream`) with one network retry.
 *
 * Invariants:
 * - Legacy overload (5-arg without useWebSearch) remains supported.
 * - AbortError never retries; classifyDesktopStreamError gates retryable network.
 *
 * Related:
 * - ./streamErrors.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import { apiFetchWithAuth } from '../../../../services/api/client';

import { BASE } from './shared';
import { classifyDesktopStreamError } from './streamErrors';
import {
	DesktopAiSseTerminalError,
	type DesktopAiStreamOptions,
} from './types';

async function streamDesktopAiChatOnce(
	chatId: string,
	content: string,
	useTools: boolean,
	useWebSearch: boolean,
	onToken: (delta: string) => void,
	onEvent?: (ev: string, payload: unknown) => void,
	signal?: AbortSignal,
	options?: DesktopAiStreamOptions
): Promise<void> {
	const authMod = await import('../../../../services/authSession');
	const authSession = authMod.default;
	await authMod.ensureAccessTokenMinValidity(120);

	const streamPath = `${BASE}/chats/${chatId}/stream`;
	const confirm = options?.ensembleDocumentConfirm;
	const regenerate = options?.regenerate === true && !confirm;
	const body: Record<string, unknown> = {
		content: confirm ? '' : regenerate ? '' : content,
		use_tools: useTools,
		use_web_search: useWebSearch,
		regenerate,
	};
	if (confirm && options.refUserMessageId) {
		body.ensemble_document_confirm = confirm;
		body.ref_user_message_id = options.refUserMessageId;
	}
	if (options?.clientRequestId) {
		body.client_request_id = options.clientRequestId;
	}
	const bodyStr = JSON.stringify(body);

	const buildHeaders = (): Record<string, string> => {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream',
		};
		const t = authSession.token;
		if (t) {
			headers.Authorization = `Bearer ${t}`;
		}
		return headers;
	};

	const doFetch = (): Promise<Response> =>
		apiFetchWithAuth(streamPath, {
			method: 'POST',
			headers: buildHeaders(),
			body: bodyStr,
			credentials: 'include',
			signal,
		});

	let res = await doFetch();
	if (res.status === 401 && authSession.authenticated) {
		try {
			const refreshed = await authSession.updateToken(70);
			if (refreshed) {
				const { clearTokenCache } = await import(
					'../../../../utils/tokenCache'
				);
				clearTokenCache();
			}
		} catch {
			/* second fetch may still fail */
		}
		res = await doFetch();
	}
	if (!res.ok || !res.body) {
		const t = await res.text().catch(() => '');
		let detail = t?.trim() || '';
		try {
			const j = JSON.parse(detail) as { detail?: string; message?: string };
			detail = (j.detail || j.message || detail).trim();
		} catch {
			/* raw */
		}
		throw new Error(
			detail
				? `Stream failed ${res.status}: ${detail.slice(0, 400)}`
				: `Stream failed ${res.status}`
		);
	}
	const reader = res.body.getReader();
	const dec = new TextDecoder();
	let buf = '';
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += dec.decode(value, { stream: true });
		const parts = buf.split('\n\n');
		buf = parts.pop() ?? '';
		for (const block of parts) {
			const lines = block.split('\n');
			for (const line of lines) {
				if (line.startsWith(':')) continue;
				if (!line.startsWith('data:')) continue;
				const raw = line.slice(5).trim();
				if (!raw) continue;
				try {
					const j = JSON.parse(raw) as Record<string, unknown>;
					if (j.event === 'token' && typeof j.delta === 'string') {
						onToken(j.delta);
					} else if (j.event === 'error') {
						const piece =
							typeof j.message === 'string' && j.message.trim()
								? j.message.trim()
								: typeof j.detail === 'string' && j.detail.trim()
									? j.detail.trim()
									: 'stream_error';
						if (onEvent) {
							onEvent('error', j);
						}
						throw new DesktopAiSseTerminalError(piece, j);
					} else if (j.event && onEvent) {
						onEvent(String(j.event), j);
					} else if (j.error) {
						throw new Error(String(j.error));
					}
				} catch (e) {
					if (e instanceof SyntaxError) continue;
					throw e;
				}
			}
		}
	}
}

export async function streamDesktopAiChat(
	chatId: string,
	content: string,
	useTools: boolean,
	useWebSearchOrOnToken: boolean | ((delta: string) => void),
	onTokenOrOnEvent?:
		| ((delta: string) => void)
		| ((ev: string, payload: unknown) => void),
	onEventOrSignal?: ((ev: string, payload: unknown) => void) | AbortSignal,
	signalOrOptions?: AbortSignal | DesktopAiStreamOptions,
	optionsMaybe?: DesktopAiStreamOptions
): Promise<void> {
	const useWebSearch =
		typeof useWebSearchOrOnToken === 'boolean' ? useWebSearchOrOnToken : false;
	const onToken =
		typeof useWebSearchOrOnToken === 'function'
			? useWebSearchOrOnToken
			: (onTokenOrOnEvent as (delta: string) => void);
	const onEvent =
		typeof useWebSearchOrOnToken === 'function'
			? (onTokenOrOnEvent as
					| ((ev: string, payload: unknown) => void)
					| undefined)
			: (onEventOrSignal as
					| ((ev: string, payload: unknown) => void)
					| undefined);
	const signal =
		typeof useWebSearchOrOnToken === 'function'
			? (onEventOrSignal as AbortSignal | undefined)
			: (signalOrOptions as AbortSignal | undefined);
	const options =
		typeof useWebSearchOrOnToken === 'function'
			? (signalOrOptions as DesktopAiStreamOptions | undefined)
			: optionsMaybe;
	let attempt = 0;
	const max = 2;
	while (attempt < max) {
		try {
			await streamDesktopAiChatOnce(
				chatId,
				content,
				useTools,
				useWebSearch,
				onToken,
				onEvent,
				signal,
				options
			);
			return;
		} catch (e) {
			if (signal?.aborted) {
				throw e;
			}
			const { retryable } = classifyDesktopStreamError(e);
			attempt++;
			if (!retryable || attempt >= max) {
				throw e;
			}
			await new Promise((r) => setTimeout(r, 700));
		}
	}
}
