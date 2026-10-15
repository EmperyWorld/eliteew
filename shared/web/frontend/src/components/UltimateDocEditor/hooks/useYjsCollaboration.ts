/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Creates and manages the Yjs collaboration runtime (Y.Doc + WebsocketProvider)
 * for Ultimate Doc Editor tabs.
 *
 * Invariants:
 * - Provider/doc resources are synchronously destroyed on unmount and on initialization failure.
 * - TipTap may mount only after first sync/seed gate (`yjsEditorReady=true`) to avoid empty-doc race.
 *
 * Related:
 * - src/components/UltimateDocEditor/hooks/useCollaboration.ts
 * - src/components/UltimateDocEditor/EditorCore/collabSeedYDoc.ts
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { API_PATHS } from '../../../services/api/config';
import { getToken } from '../../../services/authSession';
import { log } from '../../../utils/logger';
import { seedYDocDefaultFragmentFromHtml } from '../EditorCore/collabSeedYDoc';

interface UseYjsCollaborationOptions {
	documentId: string;
	enabled?: boolean;
	/** Current document HTML so the first Yjs client does not start from an empty Y.Doc */
	seedHtml?: string | null;
	/** Инкремент для повторной попытки после сбоя инициализации Yjs */
	retryNonce?: number;
	onStatusChange?: (
		status: 'connecting' | 'connected' | 'disconnected'
	) => void;
}

interface UseYjsCollaborationReturn {
	ydoc: Y.Doc | null;
	provider: WebsocketProvider | null;
	/** false пока не прошёл первый sync+seed — иначе TipTap монтируется на пустой Y.Doc и остаётся пустым */
	yjsEditorReady: boolean;
	isConnected: boolean;
	awareness: WebsocketProvider['awareness'] | null;
	error: Error | null;
}

export const useYjsCollaboration = ({
	documentId,
	enabled = true,
	seedHtml = null,
	retryNonce = 0,
	onStatusChange,
}: UseYjsCollaborationOptions): UseYjsCollaborationReturn => {
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
	const [provider, setProvider] = useState<WebsocketProvider | null>(null);
	const [yjsEditorReady, setYjsEditorReady] = useState(false);
	const onStatusChangeRef = useRef(onStatusChange);
	onStatusChangeRef.current = onStatusChange;
	/** Tracks last created provider; reset in cleanup so Strict Mode remount does not skip init. */
	const lastParamsRef = useRef<{ documentId: string; enabled: boolean }>({
		documentId: '',
		enabled: false,
	});
	const seedHtmlRef = useRef(seedHtml ?? '');
	seedHtmlRef.current = seedHtml ?? '';

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryNonce must re-run Yjs init after recover
	useEffect(() => {
		if (!enabled || !documentId) {
			lastParamsRef.current = { documentId: '', enabled: false };
			setYdoc(null);
			setProvider(null);
			setYjsEditorReady(false);
			setError(null);
			setIsConnected(false);
			return;
		}
		lastParamsRef.current = { documentId, enabled };
		setError(null);
		setYjsEditorReady(false);

		let mounted = true;
		let doc: Y.Doc | null = null;
		let prov: WebsocketProvider | null = null;
		let fallbackSeedTimer: number | null = null;

		const safeSetState = <T>(setter: (v: T) => void, value: T): void => {
			if (mounted) setter(value);
		};

		const destroyYjsResources = (context: string): void => {
			if (fallbackSeedTimer !== null) {
				window.clearTimeout(fallbackSeedTimer);
				fallbackSeedTimer = null;
			}
			if (prov) {
				try {
					prov.destroy();
				} catch (e) {
					log.warn(
						'UseYjsCollaboration',
						`${context}: Yjs provider destroy`,
						e
					);
				}
				prov = null;
			}
			if (doc) {
				try {
					doc.destroy();
				} catch (e) {
					log.warn('UseYjsCollaboration', `${context}: Yjs doc destroy`, e);
				}
				doc = null;
			}
		};

		try {
			const localDoc = new Y.Doc();
			doc = localDoc;
			// Не сидим HTML до синка с сервером: иначе при переподключении локальный сид и состояние комнаты Yjs
			// сливаются в один CRDT и текст дублируется. После sync: если комната пустая — сидим (см. seedYDocDefaultFragmentFromHtml).

			let seededAndReady = false;
			/** Первый sync после монтирования TipTap на пустом Y.Doc не подхватывает сид — ждём sync+seed, затем монтируем редактор. */
			const seedOnceAndMarkEditorReady = (): void => {
				if (!mounted || seededAndReady) return;
				seededAndReady = true;
				seedYDocDefaultFragmentFromHtml(localDoc, seedHtmlRef.current);
				safeSetState(setYjsEditorReady, true);
			};

			const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsHost = window.location.host;
			// Base URL only: y-websocket appends "/" + room and "?" + params itself — avoid duplicating documentId/token
			const wsBaseUrl = `${wsProtocol}//${wsHost}${API_PATHS.DOC_EDITOR}/collaboration`;
			const token = getToken() ?? null;

			prov = new WebsocketProvider(wsBaseUrl, documentId, localDoc, {
				resyncInterval: 30000,
				maxBackoffTime: 15000,
				params: token ? { token } : {},
			});

			prov.on('sync', (synced: boolean) => {
				if (synced) {
					seedOnceAndMarkEditorReady();
				}
			});
			if (prov.synced) {
				seedOnceAndMarkEditorReady();
			}

			fallbackSeedTimer = window.setTimeout(() => {
				if (!mounted) return;
				if (!seededAndReady) {
					log.warn(
						'UseYjsCollaboration',
						'Yjs sync slow: seeding from HTML without confirmed sync (offline or WS delay)'
					);
					seedOnceAndMarkEditorReady();
				}
			}, 4000);

			prov.on('status', (event: { status: string }) => {
				if (!mounted) return;
				const status = event.status as
					| 'connecting'
					| 'connected'
					| 'disconnected';
				safeSetState(setIsConnected, status === 'connected');
				try {
					onStatusChangeRef.current?.(status);
				} catch (e) {
					log.warn(
						'UseYjsCollaboration',
						'Yjs onStatusChange callback error',
						e
					);
				}
			});

			prov.on('connection-error', (_event: Event) => {
				if (!mounted) return;
				safeSetState(setError, new Error('Yjs connection error'));
				log.error(
					'UseYjsCollaboration',
					'Yjs connection error',
					undefined,
					_event
				);
				safeSetState(setIsConnected, false);
			});

			if (!mounted) {
				destroyYjsResources('Yjs teardown before mount commit');
				return;
			}
			setYdoc(doc);
			setProvider(prov);
		} catch (err) {
			const errObj =
				err instanceof Error ? err : new Error('Failed to initialize Yjs');
			log.error('UseYjsCollaboration', 'Yjs initialization error', errObj);
			destroyYjsResources('Yjs teardown after initialization error');
			if (mounted) {
				setError(errObj);
				setYdoc(null);
				setProvider(null);
				setYjsEditorReady(false);
				setIsConnected(false);
			}
		}

		return () => {
			mounted = false;
			lastParamsRef.current = { documentId: '', enabled: false };
			// Sync teardown: delayed destroy stacked with tab switches and Strict Mode remounts and caused duplicate WS/Y.Doc.
			destroyYjsResources('Yjs teardown on cleanup');
		};
	}, [documentId, enabled, retryNonce]);

	return {
		ydoc,
		provider,
		yjsEditorReady,
		isConnected,
		awareness: provider?.awareness ?? null,
		error,
	};
};
