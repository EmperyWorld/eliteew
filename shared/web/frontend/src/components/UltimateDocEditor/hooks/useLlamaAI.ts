/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Streaming AI helper for Ultimate Doc Editor completions, partial recovery,
 * manual stop, and document analysis calls.
 *
 * Invariants:
 * - Only one streaming request is active per hook instance; a new request aborts the previous one.
 * - Unmount aborts the active stream so reader/network resources do not outlive the panel.
 *
 * Related:
 * - src/components/UltimateDocEditor/Panels/AIAssistantPanel.tsx
 * - src/services/api/client.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_PATHS } from '../../../services/api/config';
import { api, apiFetchWithAuth } from '../../../services/api/client';
import { useEditorStoreShallow } from '../store/editorStoreContext';
import { selectLlamaAISlice } from '../store/editorStoreSelectors';
import type { UseLlamaAIReturn } from '../types/editor.types';
import type { AIGenerationMeta } from '../types/editor.types';
import { log } from '../../../utils/logger';
import {
	clearDocAiStreamDraft,
	mergeDocAiStreamDraft,
	type DocAiActionMode,
	type DocAiContextScope,
} from '../utils/docAiStreamRecovery';

const API_BASE = API_PATHS.DOC_EDITOR;

/**
 * Hook for Llama AI text completion and analysis
 *
 * @example
 * ```tsx
 * const { isStreaming, streamingText, completeText } = useLlamaAI();
 *
 * // Get AI completion with streaming
 * await completeTextStreaming('Improve this text', 'Original text here', (chunk) => {
 *   log.info('Received chunk:', chunk);
 * });
 * ```
 */
export const useLlamaAI = (): UseLlamaAIReturn => {
	const {
		aiStreaming,
		aiStreamingText,
		error,
		completeText: storeComplete,
	} = useEditorStoreShallow(selectLlamaAISlice);
	const abortControllerRef = useRef<AbortController | null>(null);
	const [isStreamingLocal, setIsStreamingLocal] = useState(false);
	const [lastResponseMeta, setLastResponseMeta] =
		useState<AIGenerationMeta | null>(null);

	const completeText = useCallback(
		async (prompt: string, context?: string): Promise<void> => {
			await storeComplete(prompt, context);
		},
		[storeComplete]
	);

	const completeTextStreaming = useCallback(
		async (
			prompt: string,
			context?: string,
			onChunk?: (chunk: string) => void,
			options?: {
				actionMode?: 'rewrite' | 'expand' | 'summarize' | 'translate' | 'free';
				contextScope?: 'selection' | 'section' | 'document';
				model?: string;
				documentId?: string;
			}
		): Promise<{
			aborted: boolean;
			meta: AIGenerationMeta | null;
			partialText?: string;
		}> => {
			abortControllerRef.current?.abort();
			const controller = new AbortController();
			abortControllerRef.current = controller;
			setIsStreamingLocal(true);
			setLastResponseMeta(null);
			const response = await apiFetchWithAuth(`${API_BASE}/ai/complete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					context,
					model: options?.model,
					action_mode: options?.actionMode,
					context_scope: options?.contextScope,
					document_id: options?.documentId,
					stream: true,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				if (response.status === 404) {
					log.warn(
						'UltimateDocEditor',
						'AI completion endpoint not available (404)'
					);
					throw new Error('AI completion endpoint not available');
				}
				throw new Error('AI completion failed');
			}

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('No reader available');
			}

			const docId = options?.documentId ?? null;
			const actionMode: DocAiActionMode = options?.actionMode ?? 'free';
			const contextScope: DocAiContextScope =
				options?.contextScope ?? 'selection';

			mergeDocAiStreamDraft(docId, {
				userMessage: prompt,
				context: context || '',
				actionMode,
				contextScope,
				partialResponse: '',
				inProgress: true,
			});

			let buffer = '';
			let latestMeta: AIGenerationMeta | null = null;
			let accumulated = '';
			let debounceId: ReturnType<typeof setTimeout> | null = null;

			const persistPartial = (partial: string, inProgress: boolean): void => {
				mergeDocAiStreamDraft(docId, {
					userMessage: prompt,
					context: context || '',
					actionMode,
					contextScope,
					partialResponse: partial,
					inProgress,
				});
			};

			const queuePersistPartial = (partial: string): void => {
				if (debounceId) clearTimeout(debounceId);
				debounceId = setTimeout(() => {
					debounceId = null;
					persistPartial(partial, true);
				}, 320);
			};

			const updateMeta = (payload: unknown): void => {
				if (!payload || typeof payload !== 'object') {
					return;
				}
				const maybeMeta = (payload as { meta?: unknown }).meta;
				if (maybeMeta && typeof maybeMeta === 'object') {
					latestMeta = maybeMeta as AIGenerationMeta;
					setLastResponseMeta(latestMeta);
				}
			};

			const handleSseLine = (line: string): void => {
				const trimmedLine = line.trim();
				if (!trimmedLine.startsWith('data: ')) {
					return;
				}

				const data = trimmedLine.slice(6).trim();
				if (!data || data === '[DONE]') {
					return;
				}

				try {
					const parsed = JSON.parse(data);
					if (typeof parsed.error === 'string' && parsed.error.trim()) {
						throw new Error(parsed.error);
					}
					const text = parsed.text || parsed.response || '';
					if (text) {
						accumulated += text;
						if (onChunk) {
							onChunk(text);
						}
						queuePersistPartial(accumulated);
					}
				} catch (error) {
					if (error instanceof Error) {
						throw error;
					}
					// Ignore malformed partial data; buffered parsing should handle normal chunking.
				}
			};

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmedLine = line.trim();
						if (!trimmedLine.startsWith('data: ')) {
							continue;
						}
						const data = trimmedLine.slice(6).trim();
						if (!data || data === '[DONE]') {
							continue;
						}
						let parsed: Record<string, unknown> | null = null;
						try {
							parsed = JSON.parse(data) as Record<string, unknown>;
						} catch {
							// malformed partial chunk
						}
						updateMeta(parsed);
						handleSseLine(line);
					}
				}

				buffer += decoder.decode();
				if (buffer.trim()) {
					const parsedLine = buffer.trim();
					if (parsedLine.startsWith('data: ')) {
						const payload = parsedLine.slice(6).trim();
						if (payload && payload !== '[DONE]') {
							let parsed: Record<string, unknown> | null = null;
							try {
								parsed = JSON.parse(payload) as Record<string, unknown>;
							} catch {
								// malformed trailing payload
							}
							updateMeta(parsed);
						}
					}
					handleSseLine(buffer);
				}
				if (debounceId) {
					clearTimeout(debounceId);
					debounceId = null;
				}
				clearDocAiStreamDraft(docId);
				return { aborted: false, meta: latestMeta };
			} catch (error) {
				if (debounceId) {
					clearTimeout(debounceId);
					debounceId = null;
				}
				if (error instanceof DOMException && error.name === 'AbortError') {
					persistPartial(accumulated, false);
					return { aborted: true, meta: latestMeta, partialText: accumulated };
				}
				persistPartial(accumulated, false);
				throw error;
			} finally {
				if (abortControllerRef.current === controller) {
					abortControllerRef.current = null;
				}
				setIsStreamingLocal(false);
			}
		},
		[]
	);

	const stopStreaming = useCallback((): void => {
		abortControllerRef.current?.abort();
	}, []);

	useEffect(
		() => () => {
			abortControllerRef.current?.abort();
			abortControllerRef.current = null;
		},
		[]
	);

	const analyzeDocument = useCallback(
		async (documentId: string, analysisType: string): Promise<unknown> => {
			return api.post(`${API_BASE}/ai/analyze`, {
				document_id: documentId,
				analysis_type: analysisType,
			});
		},
		[]
	);

	return {
		isStreaming: aiStreaming || isStreamingLocal,
		streamingText: aiStreamingText,
		error,
		completeText,
		completeTextStreaming,
		stopStreaming,
		lastResponseMeta,
		analyzeDocument,
	};
};
