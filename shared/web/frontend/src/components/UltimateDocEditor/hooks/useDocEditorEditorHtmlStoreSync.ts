/**
 * Versioned analytical pipeline: TipTap editor HTML → Zustand store + live stats.
 * Fast path bumps edit generation and schedules deferred getHTML; stale jobs abort.
 */

import type { Editor } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	type MutableRefObject,
} from 'react';
import type { StoreApi } from 'zustand';

import type { EditorStore } from '../store/editorStore';
import {
	createDocEditorAnalyticalPipeline,
	createPipelineFastStatsBinding,
} from '../utils/docEditorAnalyticalPipeline';
import {
	createDocEditorGenerationController,
	type DocEditorEditGeneration,
} from '../utils/docEditorEditGeneration';
import {
	createDocEditorIncrementalStatsEngine,
	type DocEditorIncrementalStatsEngine,
} from '../utils/docEditorIncrementalStats';
import {
	buildDocEditorOracleSnapshot,
	type DocEditorOracleSnapshot,
} from '../utils/docEditorOracleSnapshot';
import {
	isEffectivelyEmptyDocHtml,
	normalizeContentToHtml,
} from '../utils/htmlComparableText';
import { safeEditorGetHtml } from '../utils/safeEditorGetHtml';

export interface UseDocEditorEditorHtmlStoreSyncParams {
	editorStoreApi: StoreApi<EditorStore>;
	markdownMode: boolean;
	tiptapEditor: Editor | null;
	currentDocumentId?: string | null;
	programmaticUpdateRef: MutableRefObject<boolean>;
	collaborationEnabledForEditorRef: MutableRefObject<boolean>;
	collabYjsBootstrapRef: MutableRefObject<boolean>;
	onOracleStatsCommitted: (stats: {
		words: number;
		characters: number;
	}) => void;
}

export interface UseDocEditorEditorHtmlStoreSyncResult {
	latestEditorHtmlRef: MutableRefObject<string | null>;
	editGenerationRef: MutableRefObject<DocEditorEditGeneration>;
	handleDocumentChange: (payload: {
		editor: Editor;
		transaction: Transaction;
	}) => void;
	handleDocumentFlush: (payload: { editor: Editor }) => void;
	flushPendingEditorHtmlToStore: () => void;
	syncEditorHtmlToStoreBeforeCollab: () => void;
	commitOracleHtmlSnapshot: (html: string) => DocEditorOracleSnapshot;
	initIncrementalStatsFromEditor: (editor: Editor) => void;
	resetEditorAnalyticalPipeline: () => void;
}

function toEditorHtmlSource(editor: Editor) {
	return {
		getHTML: () => safeEditorGetHtml(editor) ?? '',
		isDestroyed: editor.isDestroyed,
		getDoc: () => (editor.isDestroyed ? null : editor.state.doc),
	};
}

function isEffectivelyEmptyEditorDoc(editor: Editor): boolean {
	const doc = editor.state.doc;
	let hasStructuralContent = false;
	doc.descendants((node) => {
		const name = node.type.name;
		if (
			name === 'image' ||
			name === 'table' ||
			name === 'video' ||
			name === 'iframe'
		) {
			hasStructuralContent = true;
			return false;
		}
		return true;
	});
	if (hasStructuralContent) {
		return false;
	}
	return doc.textContent.replace(/\u00a0/g, ' ').trim().length === 0;
}

export function useDocEditorEditorHtmlStoreSync(
	params: UseDocEditorEditorHtmlStoreSyncParams
): UseDocEditorEditorHtmlStoreSyncResult {
	const {
		editorStoreApi,
		markdownMode,
		tiptapEditor,
		currentDocumentId,
		programmaticUpdateRef,
		collaborationEnabledForEditorRef,
		collabYjsBootstrapRef,
		onOracleStatsCommitted,
	} = params;

	const latestEditorHtmlRef = useRef<string | null>(null);
	const generationControllerRef = useRef(createDocEditorGenerationController());
	const editGenerationRef = useRef<DocEditorEditGeneration>(0);
	const incrementalEngineRef = useRef<DocEditorIncrementalStatsEngine>(
		createDocEditorIncrementalStatsEngine()
	);
	const fastStatsBindingRef = useRef(createPipelineFastStatsBinding());
	const markdownModeRef = useRef(markdownMode);
	markdownModeRef.current = markdownMode;

	const applyFastStats = useCallback(
		(stats: { words: number; characters: number }) => {
			fastStatsBindingRef.current.setFastStats(stats);
			editorStoreApi.getState().setDocumentStats(stats);
			onOracleStatsCommitted(stats);
		},
		[editorStoreApi, onOracleStatsCommitted]
	);

	const applyOracleCommitRef = useRef(
		(_html: string, _stats: { words: number; characters: number }) => {}
	);

	const applyOracleCommit = useCallback(
		(html: string, stats: { words: number; characters: number }) => {
			const normalized = normalizeContentToHtml(html);
			latestEditorHtmlRef.current = normalized;
			editorStoreApi.getState().commitAnalyticalSnapshot({
				content: normalized,
				words: stats.words,
				characters: stats.characters,
			});
			onOracleStatsCommitted(stats);
		},
		[editorStoreApi, onOracleStatsCommitted]
	);
	applyOracleCommitRef.current = applyOracleCommit;

	const pipelineRef = useRef(
		createDocEditorAnalyticalPipeline({
			generation: generationControllerRef.current,
			getFastStats: () => fastStatsBindingRef.current.getFastStats(),
			reconcileOracle: ({ oracle, editor }) => {
				const doc = editor.getDoc?.();
				if (!doc) {
					return oracle;
				}
				return incrementalEngineRef.current.reconcileWithOracle(oracle, doc)
					.stats;
			},
			onCommit: (commit) => {
				if (markdownModeRef.current) {
					return;
				}
				fastStatsBindingRef.current.setFastStats(commit.stats);
				applyOracleCommitRef.current(commit.html, commit.stats);
			},
		})
	);

	const initIncrementalStatsFromEditor = useCallback(
		(editor: Editor) => {
			if (editor.isDestroyed) {
				return;
			}
			const stats = incrementalEngineRef.current.resetFromDoc(editor.state.doc);
			applyFastStats(stats);
		},
		[applyFastStats]
	);

	const commitOracleHtmlSnapshot = useCallback(
		(html: string): DocEditorOracleSnapshot => {
			const snapshot = buildDocEditorOracleSnapshot(
				normalizeContentToHtml(html)
			);
			editorStoreApi.getState().commitAnalyticalSnapshot(snapshot);
			latestEditorHtmlRef.current = snapshot.content;
			incrementalEngineRef.current.resetFromOracle({
				words: snapshot.words,
				characters: snapshot.characters,
			});
			if (tiptapEditor && !tiptapEditor.isDestroyed) {
				incrementalEngineRef.current.resetFromDoc(tiptapEditor.state.doc);
			}
			fastStatsBindingRef.current.setFastStats({
				words: snapshot.words,
				characters: snapshot.characters,
			});
			onOracleStatsCommitted({
				words: snapshot.words,
				characters: snapshot.characters,
			});
			return snapshot;
		},
		[editorStoreApi, onOracleStatsCommitted, tiptapEditor]
	);

	const resetEditorAnalyticalPipeline = useCallback(() => {
		pipelineRef.current.cancelPending();
		const next = generationControllerRef.current.reset(0);
		editGenerationRef.current = next;
		incrementalEngineRef.current = createDocEditorIncrementalStatsEngine();
		fastStatsBindingRef.current.setFastStats({ words: 0, characters: 0 });
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset generation/pending jobs when active document changes
	useEffect(() => {
		resetEditorAnalyticalPipeline();
	}, [currentDocumentId, resetEditorAnalyticalPipeline]);

	const handleDocumentChange = useCallback(
		({ editor, transaction }: { editor: Editor; transaction: Transaction }) => {
			if (!transaction.docChanged) {
				return;
			}
			if (programmaticUpdateRef.current) {
				programmaticUpdateRef.current = false;
				return;
			}
			if (
				collaborationEnabledForEditorRef.current &&
				collabYjsBootstrapRef.current &&
				isEffectivelyEmptyEditorDoc(editor)
			) {
				const prev = editorStoreApi.getState().currentDocument?.content ?? '';
				if (!isEffectivelyEmptyDocHtml(prev)) {
					return;
				}
			}
			if (
				collaborationEnabledForEditorRef.current &&
				collabYjsBootstrapRef.current &&
				!isEffectivelyEmptyEditorDoc(editor)
			) {
				collabYjsBootstrapRef.current = false;
			}

			const generation = generationControllerRef.current.bump();
			editGenerationRef.current = generation;

			const delta = incrementalEngineRef.current.applyTransaction(transaction);
			if (delta.deltaApplied) {
				applyFastStats(delta.stats);
			}

			editorStoreApi.setState({ isDirty: true });
			pipelineRef.current.scheduleFromEditor(toEditorHtmlSource(editor));
		},
		[
			programmaticUpdateRef,
			collaborationEnabledForEditorRef,
			collabYjsBootstrapRef,
			editorStoreApi,
			applyFastStats,
		]
	);

	const handleDocumentFlush = useCallback(({ editor }: { editor: Editor }) => {
		pipelineRef.current.flushSyncFromEditor(toEditorHtmlSource(editor));
	}, []);

	const flushPendingEditorHtmlToStore = useCallback(() => {
		if (markdownMode) {
			return;
		}
		const ed = tiptapEditor;
		if (ed && !ed.isDestroyed) {
			const fromStore =
				editorStoreApi.getState().currentDocument?.content ?? '';
			const commit = pipelineRef.current.flushSyncFromEditor(
				toEditorHtmlSource(ed)
			);
			if (commit) {
				return;
			}
			const candidateRaw = safeEditorGetHtml(ed);
			if (candidateRaw == null) {
				return;
			}
			const candidate = normalizeContentToHtml(candidateRaw);
			if (
				isEffectivelyEmptyDocHtml(candidate) &&
				!isEffectivelyEmptyDocHtml(fromStore)
			) {
				return;
			}
			commitOracleHtmlSnapshot(candidate);
			return;
		}
		const fromRef = latestEditorHtmlRef.current;
		if (fromRef == null) {
			return;
		}
		const fromStore = editorStoreApi.getState().currentDocument?.content ?? '';
		const candidate = normalizeContentToHtml(fromRef);
		if (
			isEffectivelyEmptyDocHtml(candidate) &&
			!isEffectivelyEmptyDocHtml(fromStore)
		) {
			return;
		}
		commitOracleHtmlSnapshot(candidate);
	}, [markdownMode, tiptapEditor, editorStoreApi, commitOracleHtmlSnapshot]);

	const syncEditorHtmlToStoreBeforeCollab = useCallback(() => {
		if (markdownMode) {
			return;
		}
		const fromStore = editorStoreApi.getState().currentDocument?.content ?? '';
		const ed = tiptapEditor;
		if (ed && !ed.isDestroyed) {
			const commit = pipelineRef.current.flushSyncFromEditor(
				toEditorHtmlSource(ed)
			);
			if (commit) {
				return;
			}
			let html = safeEditorGetHtml(ed);
			if (html == null) {
				return;
			}
			if (
				isEffectivelyEmptyDocHtml(html) &&
				!isEffectivelyEmptyDocHtml(fromStore)
			) {
				html = normalizeContentToHtml(fromStore);
			}
			commitOracleHtmlSnapshot(html);
			return;
		}
		if (!isEffectivelyEmptyDocHtml(fromStore)) {
			commitOracleHtmlSnapshot(fromStore);
			return;
		}
		flushPendingEditorHtmlToStore();
	}, [
		markdownMode,
		tiptapEditor,
		editorStoreApi,
		commitOracleHtmlSnapshot,
		flushPendingEditorHtmlToStore,
	]);

	return useMemo(
		() => ({
			latestEditorHtmlRef,
			editGenerationRef,
			handleDocumentChange,
			handleDocumentFlush,
			flushPendingEditorHtmlToStore,
			syncEditorHtmlToStoreBeforeCollab,
			commitOracleHtmlSnapshot,
			initIncrementalStatsFromEditor,
			resetEditorAnalyticalPipeline,
		}),
		[
			handleDocumentChange,
			handleDocumentFlush,
			flushPendingEditorHtmlToStore,
			syncEditorHtmlToStoreBeforeCollab,
			commitOracleHtmlSnapshot,
			initIncrementalStatsFromEditor,
			resetEditorAnalyticalPipeline,
		]
	);
}
