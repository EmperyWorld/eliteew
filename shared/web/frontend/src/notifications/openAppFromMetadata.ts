/**
 * Builds a `desktop-open-app` detail from server notification metadata / source.
 * Shapes align with `DesktopOpenAppDetail` (`pages/Desktop/utils/desktopDeepLink`).
 */

import type { NotificationOpenAppIntent } from './types';

export function openAppDetailFromNotification(
	source: string | undefined,
	metadata: Record<string, unknown> | undefined
): NotificationOpenAppIntent | undefined {
	const meta = metadata && typeof metadata === 'object' ? metadata : undefined;
	const raw = meta?.open_app;
	if (
		raw &&
		typeof raw === 'object' &&
		typeof (raw as NotificationOpenAppIntent).appComponent === 'string' &&
		String((raw as NotificationOpenAppIntent).appComponent).trim()
	) {
		const intent = {
			...(raw as Record<string, unknown>),
		} as NotificationOpenAppIntent;
		const component = String(intent.appComponent).trim();
		if (component === 'MusicGenerator' || component === 'MusicEvolutionApp') {
			intent.appComponent = 'MusicForgeApp';
			const evolutionRunId = (raw as Record<string, unknown>)
				.musicEvolutionRunId;
			if (
				typeof evolutionRunId === 'string' &&
				evolutionRunId.trim() &&
				typeof intent.musicForgeRunId !== 'string'
			) {
				intent.musicForgeRunId = evolutionRunId.trim();
			}
		}
		return intent;
	}

	const src = (source || '').toLowerCase();
	if (src === 'friends') {
		return { appComponent: 'SocialHubApp' };
	}
	if (src === 'ugs') {
		const tk = typeof meta?.type_key === 'string' ? meta.type_key : '';
		if (
			tk.startsWith('music_generator') ||
			tk.startsWith('music_generator_forge')
		) {
			return { appComponent: 'MusicForgeApp' };
		}
		return { appComponent: 'UGSHubApp' };
	}
	if (src === 'music_evolution' || src === 'music_forge') {
		const runId = meta?.musicForgeRunId ?? meta?.musicEvolutionRunId;
		if (typeof runId === 'string' && runId.trim()) {
			return {
				appComponent: 'MusicForgeApp',
				musicForgeRunId: runId.trim(),
			};
		}
		return { appComponent: 'MusicForgeApp' };
	}
	if (src === 'business_intelligence') {
		return { appComponent: 'StudioGU' };
	}
	if (src === 'gaf_chat') {
		const cid = meta?.chat_id;
		if (typeof cid === 'string' && cid.trim()) {
			return { appComponent: 'GAFChatApp', targetChatId: cid.trim() };
		}
		return { appComponent: 'GAFChatApp' };
	}
	if (src === 'doc_editor' || meta?.kind === 'doc_collaboration_invite') {
		const docId = meta?.document_id;
		if (typeof docId === 'string' && docId.trim()) {
			return { appComponent: 'DocEditor', documentId: docId.trim() };
		}
	}
	if (src === 'desktop_ai_chat' || meta?.kind === 'desktop_ai_chat_invite') {
		const chatId = meta?.chat_id;
		if (typeof chatId === 'string' && chatId.trim()) {
			return {
				appComponent: 'DesktopAiChatApp',
				desktopAiChatId: chatId.trim(),
			};
		}
		return { appComponent: 'DesktopAiChatApp' };
	}
	return undefined;
}
