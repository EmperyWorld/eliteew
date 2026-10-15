/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Task tree panel for agentic session observability in companion operations.
 *
 * Invariants:
 * - Missing or malformed tree nodes degrade to an empty panel, never a Desktop error-boundary crash.
 * - While sessionStatus is non-terminal, panel polls /tree so nodes appear without waiting for run_revision.
 * - Completed file_create nodes open the created document when a content id is known.
 *
 * Related:
 * - src/features/ewa/agentic/agenticTraceApi.ts
 * - src/features/ewa/agentic/agenticObservabilityActive.ts
 */

import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AGENTIC_OBSERVABILITY_POLL_MS,
	isAgenticObservabilitySessionActive,
} from '@/features/ewa/agentic/agenticObservabilityActive';
import { resolveAgenticObservabilityEmptyMessage } from '@/features/ewa/agentic/agenticObservabilityEmptyState';
import {
	agenticCheckpointSummaryLooksLikeMarkdown,
	formatAgenticNodeStatus,
	humanizeAgenticCheckpointSummary,
} from '@/features/ewa/agentic/agenticObservabilityUi';
import {
	type AgenticCheckpointRow,
	type AgenticTreeNodeRow,
	fetchAgenticSessionTrace,
	fetchAgenticSessionTree,
} from '@/features/ewa/agentic/agenticTraceApi';
import type { AgenticCreatedDocument } from '@/features/ewa/companionOperations/companionOperationsUi';
import { EwaCompanionChatMarkdown } from '@/features/ewa/EwaCompanionChatMarkdown';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type AgenticTaskTreePanelProps = {
	sessionId: string;
	sessionStatus?: string;
	traceCheckpointCount?: number;
	refreshToken?: number;
	documents?: AgenticCreatedDocument[];
	onOpenDocEditor?: (unifiedContentId: string) => void;
};

function latestActSummaryForNode(
	nodeId: string,
	checkpoints: AgenticCheckpointRow[]
): { summary: string; contentId: string; tool: string } | null {
	for (let i = checkpoints.length - 1; i >= 0; i -= 1) {
		const row = checkpoints[i];
		if ((row.kind || '').trim() !== 'act') continue;
		const payload = row.payload_json;
		if (!payload || typeof payload !== 'object') continue;
		const bound =
			String(row.node_id || payload.node_id || '').trim() === nodeId;
		if (!bound) continue;
		return {
			summary: String(payload.summary || '').trim(),
			contentId: String(
				payload.created_unified_content_id || payload.unified_content_id || ''
			).trim(),
			tool: String(payload.tool || payload.tool_name || '').trim(),
		};
	}
	return null;
}

function AgenticTaskTreePanelView({
	sessionId,
	sessionStatus = '',
	traceCheckpointCount = 0,
	refreshToken = 0,
	documents = [],
	onOpenDocEditor,
}: AgenticTaskTreePanelProps) {
	const { t } = useTranslation('marketing');
	const [nodes, setNodes] = useState<AgenticTreeNodeRow[]>([]);
	const [checkpoints, setCheckpoints] = useState<AgenticCheckpointRow[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const pollActive = isAgenticObservabilitySessionActive(sessionStatus);

	useEffect(() => {
		let cancelled = false;
		let intervalId: ReturnType<typeof setInterval> | undefined;

		const load = (opts?: { silent?: boolean }) => {
			if (!opts?.silent) {
				setLoading(true);
			}
			setError(null);
			void Promise.all([
				fetchAgenticSessionTree(sessionId),
				fetchAgenticSessionTrace(sessionId, 80),
			])
				.then(([tree, trace]) => {
					if (cancelled) return;
					setNodes(Array.isArray(tree.nodes) ? tree.nodes : []);
					setCheckpoints(
						Array.isArray(trace.checkpoints) ? trace.checkpoints : []
					);
				})
				.catch((err: unknown) => {
					if (!cancelled) {
						setError(err instanceof Error ? err.message : 'load_failed');
					}
				})
				.finally(() => {
					if (!cancelled) setLoading(false);
				});
		};

		void refreshToken;
		load();
		if (pollActive) {
			intervalId = setInterval(
				() => load({ silent: true }),
				AGENTIC_OBSERVABILITY_POLL_MS
			);
		}
		return () => {
			cancelled = true;
			if (intervalId !== undefined) clearInterval(intervalId);
		};
	}, [sessionId, refreshToken, pollActive]);

	const nodeItems = useMemo(
		() =>
			nodes.map((node) => {
				const statusLabel = formatAgenticNodeStatus(node.status, t);
				const isFailed = (node.status || '').trim().toLowerCase() === 'failed';
				const act = latestActSummaryForNode(node.id, checkpoints);
				const toolName = node.tool_name || act?.tool || '';
				let contentId = act?.contentId || '';
				if (
					!contentId &&
					(toolName === 'file_create' || toolName === 'file_save_text') &&
					documents.length === 1
				) {
					contentId = documents[0]?.unifiedContentId || '';
				}
				if (
					!contentId &&
					(toolName === 'file_create' || toolName === 'file_save_text')
				) {
					const byName = documents.find(
						(doc) =>
							doc.name &&
							node.title &&
							doc.name
								.toLowerCase()
								.includes(node.title.slice(0, 24).toLowerCase())
					);
					contentId = byName?.unifiedContentId || '';
				}
				return {
					id: node.id,
					title: node.title,
					statusLabel,
					isFailed,
					toolName,
					contentId,
					summary: act?.summary || '',
				};
			}),
		[nodes, checkpoints, documents, t]
	);

	const selected = nodeItems.find((n) => n.id === selectedId) ?? null;
	const selectedDetailSummary = selected?.summary
		? humanizeAgenticCheckpointSummary(selected.summary, t, { maxChars: 1200 })
		: '';
	const selectedDetailIsMarkdown = agenticCheckpointSummaryLooksLikeMarkdown(
		selectedDetailSummary
	);

	if (loading) {
		return (
			<p className="text-[11px] text-white/50">
				{t('ewaCompanion.agenticTreeLoading', 'Загружаю дерево задач…')}
			</p>
		);
	}
	if (error) {
		return (
			<p className="text-[11px] text-rose-300/90">
				{t(
					'ewaCompanion.agenticTreeError',
					'Не удалось загрузить дерево задач'
				)}
			</p>
		);
	}
	if (nodeItems.length === 0) {
		return (
			<p className="text-[11px] text-white/45">
				{resolveAgenticObservabilityEmptyMessage(
					'tree',
					sessionStatus,
					{ hasSiblingData: traceCheckpointCount > 0 },
					t
				)}
			</p>
		);
	}

	return (
		<div className="mt-1 space-y-2">
			<ul className="space-y-1">
				{nodeItems.map((node) => (
					<li key={node.id}>
						<button
							type="button"
							className={cn(
								'w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-[11px]',
								'hover:border-white/25 hover:bg-white/8',
								selectedId === node.id && 'border-cyan-300/40 bg-cyan-300/10',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => {
								setSelectedId(node.id);
								if (node.contentId && onOpenDocEditor) {
									onOpenDocEditor(node.contentId);
								}
							}}
						>
							<span className="font-medium text-white/90">{node.title}</span>
							<span
								className={cn(
									'ml-2',
									node.isFailed ? 'text-rose-300/90' : 'text-white/50'
								)}
							>
								{node.statusLabel}
							</span>
							{node.toolName ? (
								<span className="ml-2 text-white/40">{node.toolName}</span>
							) : null}
							{node.contentId ? (
								<span className="ml-2 text-emerald-200/80">
									{t('ewaCompanion.agenticNodeOpenHint', 'открыть')}
								</span>
							) : null}
						</button>
					</li>
				))}
			</ul>
			{selected ? (
				<div className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-white/75">
					<p className="font-medium text-white/90">{selected.title}</p>
					{selectedDetailSummary ? (
						selectedDetailIsMarkdown ? (
							<div className="mt-1">
								<EwaCompanionChatMarkdown
									markdown={selectedDetailSummary}
									className={cn(
										'!text-[11px] !leading-snug text-white/75',
										'prose-headings:!mt-1.5 prose-headings:!mb-1 prose-headings:!text-[12px]',
										'prose-p:!my-1'
									)}
								/>
							</div>
						) : (
							<p className="mt-1 whitespace-pre-wrap break-words text-white/65">
								{selectedDetailSummary}
							</p>
						)
					) : (
						<p className="mt-1 text-white/45">
							{t(
								'ewaCompanion.agenticNodeNoResultYet',
								'Подробный результат шага пока не записан в журнал.'
							)}
						</p>
					)}
					{selected.contentId && onOpenDocEditor ? (
						<button
							type="button"
							className={cn(
								'mt-1.5 rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5',
								'text-[10px] text-emerald-100 hover:bg-emerald-400/15',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onOpenDocEditor(selected.contentId)}
						>
							{t('ewaCompanion.agenticOpenCreatedDocument', 'Открыть документ')}
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}

export const AgenticTaskTreePanel = memo(AgenticTaskTreePanelView);
