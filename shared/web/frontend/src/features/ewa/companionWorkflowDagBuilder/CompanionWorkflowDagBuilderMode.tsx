/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual DAG builder shell for companion user workflows (Phase 3.3).
 *
 * Invariants:
 * - Semantic graph stored as v2 nodes/edges; layout in builder_meta on save.
 * - Unsaved exits are confirmed; presets replace the graph; React Flow is canvas-only.
 *
 * Related:
 * - services/ewa/companionUserWorkflowsApi.ts
 */
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import {
	useCallback,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type DragEvent,
	type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	ReactFlowProvider,
	type Connection,
	type Edge,
	type EdgeChange,
	type NodeChange,
	type Viewport,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from '@xyflow/react';

import { CompanionDagCanvas } from '@/features/ewa/companionWorkflowDagBuilder/canvas/CompanionDagCanvas';
import {
	COMPANION_DAG_NODE_TYPE,
	clearCompanionDagNodeDragPayload,
	connectEdge,
	defaultNodePosition,
	definitionToCanvas,
	disconnectFlowEdge,
	parseCompanionDagNodeDragType,
	semanticEdgeFlowId,
	writeCompanionDagNodeDragPayload,
	type CompanionDagFlowNode,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { DagInspectorPanel } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagInspectorPanel';
import { DagNodePalette } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagNodePalette';
import { DagPresetsPanel } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagPresetsPanel';
import { DagPickerController } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagPickerController';
import {
	createDefaultDagNode,
	getDagNodeCatalogEntry,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import {
	DagBuilderEditorProvider,
	useDagBuilderEditor,
} from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';
import {
	createDagBuilderDirtySnapshot,
	isDagBuilderDirty,
	type DagBuilderDirtySnapshot,
} from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderDirtyState';
import { useCompanionDagBuilderLoadSave } from '@/features/ewa/companionWorkflowDagBuilder/useCompanionDagBuilderLoadSave';
import { useCompanionDagBuilderPresets } from '@/features/ewa/companionWorkflowDagBuilder/useCompanionDagBuilderPresets';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeTypeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';
import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import { CompanionWorkflowFormField } from '@/features/ewa/companionOutputSurface/CompanionWorkflowFormField';
import { CompanionGlassSection } from '@/features/ewa/companionPremiumPrimitives';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { useNotifications } from '@/notifications';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionUserWorkflow } from '@/services/ewa/companionUserWorkflowsApi';

type Props = {
	workflowId?: string;
	duplicateFromId?: string;
	onSaved: (workflow: CompanionUserWorkflow) => void;
	onBackToChat: () => void;
	onExitToWorkflows: () => void;
};

export function CompanionWorkflowDagBuilderMode(props: Props) {
	return (
		<ReactFlowProvider>
			<CompanionWorkflowDagBuilderModeInner {...props} />
		</ReactFlowProvider>
	);
}

function CompanionWorkflowDagBuilderModeInner({
	workflowId,
	duplicateFromId,
	onSaved,
	onBackToChat,
	onExitToWorkflows,
}: Props) {
	const { i18n, t } = useTranslation('marketing');
	const { notify } = useNotifications();
	const isRu = i18n.language.startsWith('ru');

	const [name, setName] = useState('');
	const [triggerPhrase, setTriggerPhrase] = useState('');
	const [semanticNodes, setSemanticNodes] = useState<CompanionWorkflowNodeV2[]>(
		[]
	);
	const [semanticEdges, setSemanticEdges] = useState<CompanionWorkflowEdgeV2[]>(
		[]
	);
	const [viewport, setViewport] = useState<Viewport | undefined>();

	const [flowNodes, setFlowNodes] = useNodesState<CompanionDagFlowNode>([]);
	const [flowEdges, setFlowEdges] = useEdgesState<Edge>([]);

	const syncFlowNodeTitle = useCallback(
		(nodeId: string, title: string) => {
			setFlowNodes((current) =>
				current.map((node) =>
					node.id === nodeId
						? {
								...node,
								data: { ...node.data, title: title || node.data.nodeType },
							}
						: node
				)
			);
		},
		[setFlowNodes]
	);

	return (
		<DagBuilderEditorProvider
			nodes={semanticNodes}
			edges={semanticEdges}
			setNodes={setSemanticNodes}
			setEdges={setSemanticEdges}
			onFlowNodeTitle={syncFlowNodeTitle}
		>
			<CompanionWorkflowDagBuilderWorkspace
				workflowId={workflowId}
				duplicateFromId={duplicateFromId}
				onSaved={onSaved}
				onBackToChat={onBackToChat}
				onExitToWorkflows={onExitToWorkflows}
				name={name}
				setName={setName}
				triggerPhrase={triggerPhrase}
				setTriggerPhrase={setTriggerPhrase}
				semanticNodes={semanticNodes}
				setSemanticNodes={setSemanticNodes}
				semanticEdges={semanticEdges}
				setSemanticEdges={setSemanticEdges}
				viewport={viewport}
				setViewport={setViewport}
				flowNodes={flowNodes}
				setFlowNodes={setFlowNodes}
				flowEdges={flowEdges}
				setFlowEdges={setFlowEdges}
				isRu={isRu}
				t={t}
				notify={notify}
			/>
		</DagBuilderEditorProvider>
	);
}

type WorkspaceProps = Props & {
	name: string;
	setName: (value: string) => void;
	triggerPhrase: string;
	setTriggerPhrase: (value: string) => void;
	semanticNodes: CompanionWorkflowNodeV2[];
	setSemanticNodes: Dispatch<SetStateAction<CompanionWorkflowNodeV2[]>>;
	semanticEdges: CompanionWorkflowEdgeV2[];
	setSemanticEdges: Dispatch<SetStateAction<CompanionWorkflowEdgeV2[]>>;
	viewport: Viewport | undefined;
	setViewport: (value: Viewport | undefined) => void;
	flowNodes: ReturnType<typeof useNodesState<CompanionDagFlowNode>>[0];
	setFlowNodes: ReturnType<typeof useNodesState<CompanionDagFlowNode>>[1];
	flowEdges: ReturnType<typeof useEdgesState<Edge>>[0];
	setFlowEdges: ReturnType<typeof useEdgesState<Edge>>[1];
	isRu: boolean;
	t: TFunction<'marketing'>;
	notify: ReturnType<typeof useNotifications>['notify'];
};

function CompanionWorkflowDagBuilderWorkspace({
	workflowId,
	duplicateFromId,
	onSaved,
	onBackToChat,
	onExitToWorkflows,
	name,
	setName,
	triggerPhrase,
	setTriggerPhrase,
	semanticNodes,
	setSemanticNodes,
	semanticEdges,
	setSemanticEdges,
	viewport,
	setViewport,
	flowNodes,
	setFlowNodes,
	flowEdges,
	setFlowEdges,
	isRu,
	t,
	notify,
}: WorkspaceProps) {
	const { selection, setSelection, closePicker } = useDagBuilderEditor();
	const { screenToFlowPosition } = useReactFlow();
	const dirtyBaselineRef = useRef<DagBuilderDirtySnapshot | null>(null);
	const [presetsOpen, setPresetsOpen] = useState(false);

	const currentDirtySnapshot = useMemo(
		() =>
			createDagBuilderDirtySnapshot({
				name,
				triggerPhrase,
				nodes: semanticNodes,
				edges: semanticEdges,
			}),
		[name, triggerPhrase, semanticNodes, semanticEdges]
	);

	const isDirty = isDagBuilderDirty(
		currentDirtySnapshot,
		dirtyBaselineRef.current
	);

	const setDirtyBaseline = useCallback((snapshot: DagBuilderDirtySnapshot) => {
		dirtyBaselineRef.current = snapshot;
	}, []);

	const confirmLeaveIfDirty = useCallback((): boolean => {
		if (!isDirty) return true;
		return window.confirm(t('ewaCompanion.workflowDag.unsavedConfirm'));
	}, [isDirty, t]);

	const handleBackToChat = useCallback(() => {
		if (!confirmLeaveIfDirty()) return;
		onBackToChat();
	}, [confirmLeaveIfDirty, onBackToChat]);

	const handleExitToWorkflows = useCallback(() => {
		if (!confirmLeaveIfDirty()) return;
		onExitToWorkflows();
	}, [confirmLeaveIfDirty, onExitToWorkflows]);

	const syncFlowFromSemantic = useCallback(
		(
			nodes: CompanionWorkflowNodeV2[],
			edges: CompanionWorkflowEdgeV2[],
			builderMeta?: {
				node_positions?: Record<string, { x: number; y: number }>;
				viewport?: Viewport;
			}
		) => {
			const fakeDefinition = {
				schema_version: 2 as const,
				workflow_id: 'preview',
				version: 1,
				title_ru: name || 'preview',
				title_en: name || 'preview',
				enabled: false,
				triggers: [{ type: 'regex', pattern: 'preview' }],
				nodes,
				edges,
				builder_meta: builderMeta
					? {
							schema_version: 1 as const,
							node_positions: builderMeta.node_positions,
							viewport: builderMeta.viewport,
						}
					: undefined,
			};
			const canvas = definitionToCanvas(fakeDefinition);
			setFlowNodes(canvas.nodes);
			setFlowEdges(canvas.edges);
			if (canvas.viewport) setViewport(canvas.viewport);
		},
		[name, setFlowEdges, setFlowNodes, setViewport]
	);

	const {
		loading,
		saving,
		loadError,
		validationErrors,
		setValidationErrors,
		maxNodesAllowed,
		retryLoad,
		handleSave,
	} = useCompanionDagBuilderLoadSave({
		workflowId,
		duplicateFromId,
		onSaved,
		onExitToWorkflows,
		t,
		isRu,
		notify,
		name,
		setName,
		triggerPhrase,
		setTriggerPhrase,
		semanticNodes,
		setSemanticNodes,
		semanticEdges,
		setSemanticEdges,
		flowNodes,
		viewport,
		syncFlowFromSemantic,
		setDirtyBaseline,
	});

	const onNodesChange = useCallback(
		(changes: NodeChange<CompanionDagFlowNode>[]) => {
			setFlowNodes((current) => applyNodeChanges(changes, current));
			for (const change of changes) {
				if (change.type === 'remove') {
					setSemanticNodes((nodes) =>
						nodes.filter((node) => node.id !== change.id)
					);
					setSemanticEdges((edges) =>
						edges.filter(
							(edge) =>
								edge.source_node_id !== change.id &&
								edge.target_node_id !== change.id
						)
					);
				}
			}
		},
		[setFlowNodes, setSemanticNodes, setSemanticEdges]
	);

	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			setFlowEdges((current) => {
				for (const change of changes) {
					if (change.type === 'remove') {
						const removed = current.find((edge) => edge.id === change.id);
						if (removed) {
							setSemanticEdges((edges) => disconnectFlowEdge(edges, removed));
						}
					}
				}
				return applyEdgeChanges(changes, current);
			});
		},
		[setFlowEdges, setSemanticEdges]
	);

	const handleAddNodeAt = useCallback(
		(
			type: CompanionWorkflowNodeV2['type'],
			position: { x: number; y: number }
		) => {
			if (semanticNodes.length >= maxNodesAllowed) {
				notify.warning(
					t('ewaCompanion.workflowDag.nodeLimitTitle'),
					t('ewaCompanion.workflowDag.nodeLimitBody', {
						count: maxNodesAllowed,
					})
				);
				return null;
			}
			if (!getDagNodeCatalogEntry(type)) {
				return null;
			}
			const node = createDefaultDagNode(type);
			setSemanticNodes((current) => [...current, node]);
			setFlowNodes((current) => [
				...current,
				{
					id: node.id,
					type: COMPANION_DAG_NODE_TYPE,
					position,
					data: {
						nodeType: node.type,
						title:
							node.title_ru || getDagNodeCatalogEntry(type)?.labelRu || type,
					},
				},
			]);
			closePicker();
			setSelection({ kind: 'node', nodeId: node.id });
			return node;
		},
		[
			closePicker,
			maxNodesAllowed,
			notify,
			semanticNodes.length,
			setFlowNodes,
			setSemanticNodes,
			setSelection,
			t,
		]
	);

	const handleAddNode = useCallback(
		(type: CompanionWorkflowNodeV2['type']) => {
			handleAddNodeAt(type, defaultNodePosition(semanticNodes.length));
		},
		[handleAddNodeAt, semanticNodes.length]
	);

	const handlePaletteDragStart = useCallback(
		(
			event: DragEvent<HTMLButtonElement>,
			type: CompanionWorkflowNodeTypeV2
		) => {
			writeCompanionDagNodeDragPayload(event.dataTransfer, type);
		},
		[]
	);

	const handleCanvasDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!parseCompanionDagNodeDragType(event.dataTransfer)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
		},
		[]
	);

	const handleCanvasDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			const rawType = parseCompanionDagNodeDragType(event.dataTransfer);
			clearCompanionDagNodeDragPayload();
			if (!rawType) return;
			if (!getDagNodeCatalogEntry(rawType as CompanionWorkflowNodeV2['type'])) {
				return;
			}
			const position = screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			});
			handleAddNodeAt(rawType as CompanionWorkflowNodeV2['type'], position);
		},
		[handleAddNodeAt, screenToFlowPosition]
	);

	const handleConnect = useCallback(
		(connection: Connection) => {
			const source = connection.source;
			const target = connection.target;
			if (!source || !target) return;
			setSemanticEdges((edges) => {
				const next = connectEdge(edges, source, target);
				const newEdge = next[next.length - 1];
				if (newEdge) {
					const flowId = semanticEdgeFlowId(newEdge, next.length - 1);
					setFlowEdges((flow) =>
						addEdge({ ...connection, id: flowId, type: 'smoothstep' }, flow)
					);
				}
				return next;
			});
			closePicker();
			setSelection({ kind: 'node', nodeId: target });
		},
		[closePicker, setFlowEdges, setSelection, setSemanticEdges]
	);

	const handleLoadPreset = useCompanionDagBuilderPresets({
		name,
		triggerPhrase,
		semanticNodes,
		semanticEdges,
		maxNodesAllowed,
		isRu,
		t,
		notify,
		setName,
		setTriggerPhrase,
		setSemanticNodes,
		setSemanticEdges,
		setFlowNodes,
		setFlowEdges,
		setViewport,
		setValidationErrors,
		setSelection,
		closePicker,
		setDirtyBaseline,
	});

	const headerActions = useMemo(
		() => (
			<div className="flex flex-wrap items-center gap-2">
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={handleExitToWorkflows}
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
					{t('ewaCompanion.workflowDag.exit')}
				</DesktopAppButton>
				{isDirty ? (
					<span className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-100">
						{t('ewaCompanion.workflowDag.unsaved')}
					</span>
				) : null}
			</div>
		),
		[handleExitToWorkflows, isDirty, t]
	);

	return (
		<CompanionSurfacePanel
			title={t('ewaCompanion.workflowDag.title')}
			subtitle={t('ewaCompanion.workflowDag.subtitle', {
				count: maxNodesAllowed,
			})}
			onBack={handleBackToChat}
			backLabel={t('ewaCompanion.workflowDag.backToChat')}
			headerActions={headerActions}
			testId="ewa-companion-dag-builder"
			footer={
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					{isDirty ? (
						<span className="text-[12px] text-amber-100">
							{t('ewaCompanion.workflowDag.unsavedFooter')}
						</span>
					) : (
						<span className="text-[12px] text-(--companion-text-soft)">
							{t('ewaCompanion.workflowDag.savedFooter')}
						</span>
					)}
					<DesktopAppButton
						type="button"
						variant="accent"
						disabled={loading || saving}
						onClick={() => void handleSave()}
					>
						{saving
							? t('ewaCompanion.workflowDag.saving')
							: t('ewaCompanion.workflowDag.save')}
					</DesktopAppButton>
				</div>
			}
		>
			{loading ? (
				<p
					className="py-6 text-center text-[13px] text-(--companion-text-soft)"
					role="status"
					aria-live="polite"
				>
					{t('ewaCompanion.workflowDag.loading')}
				</p>
			) : loadError ? (
				<div
					className="flex flex-col items-center gap-3 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-6 text-center"
					role="alert"
				>
					<p className={EWA_COMPANION_TYPOGRAPHY.label}>
						{t('ewaCompanion.workflowDag.loadErrorTitle')}
					</p>
					<p className="text-xs text-(--companion-text-soft)">
						{t('ewaCompanion.workflowDag.loadErrorBody')}
					</p>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={retryLoad}
					>
						{t('ewaCompanion.workflowDag.retry')}
					</DesktopAppButton>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
					<div className="flex w-full shrink-0 flex-col gap-3 lg:w-56">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							aria-expanded={presetsOpen}
							onClick={() => setPresetsOpen((open) => !open)}
						>
							{t('ewaCompanion.workflowDag.presetsDisclosure')}
						</DesktopAppButton>
						{presetsOpen ? (
							<DagPresetsPanel
								disabled={loading || saving}
								onLoadPreset={handleLoadPreset}
							/>
						) : null}
						<DagNodePalette
							disabled={
								loading || saving || semanticNodes.length >= maxNodesAllowed
							}
							disabledReason={
								semanticNodes.length >= maxNodesAllowed
									? t('ewaCompanion.workflowDag.nodeLimitBody', {
											count: maxNodesAllowed,
										})
									: undefined
							}
							onAddNode={handleAddNode}
							onDragNodeType={handlePaletteDragStart}
						/>
					</div>
					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
						<CompanionGlassSection tone="mission" className="p-3">
							<div className="grid gap-3 md:grid-cols-2">
								<CompanionWorkflowFormField
									kind="text"
									label={t('ewaCompanion.workflowDag.nameLabel')}
									value={name}
									onChange={setName}
								/>
								<CompanionWorkflowFormField
									kind="text"
									label={t('ewaCompanion.workflowDag.triggerLabel')}
									value={triggerPhrase}
									onChange={setTriggerPhrase}
								/>
							</div>
						</CompanionGlassSection>
						<div className="relative min-h-0 flex-1">
							<CompanionDagCanvas
								nodes={flowNodes}
								edges={flowEdges}
								selection={selection}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								onConnect={handleConnect}
								onNodeSelect={(nodeId) => {
									closePicker();
									setSelection({ kind: 'node', nodeId });
								}}
								onEdgeSelect={(flowEdgeId) => {
									closePicker();
									setSelection({ kind: 'edge', flowEdgeId });
								}}
								onPaneClick={() => {
									closePicker();
									setSelection({ kind: 'none' });
								}}
								onDragOver={handleCanvasDragOver}
								onDrop={handleCanvasDrop}
								onViewportChange={setViewport}
								defaultViewport={viewport}
							/>
							{semanticNodes.length === 0 ? (
								<div
									className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
									data-testid="ewa-dag-canvas-empty"
								>
									<div className="max-w-sm rounded-2xl border border-(--companion-divider) bg-(--desktop-surface-panel)/75 px-5 py-4 text-center backdrop-blur">
										<p className={EWA_COMPANION_TYPOGRAPHY.label}>
											{t('ewaCompanion.workflowDag.emptyCanvas')}
										</p>
									</div>
								</div>
							) : null}
						</div>
						{validationErrors.length > 0 ? (
							<ul
								className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100"
								role="status"
								aria-live="polite"
							>
								{validationErrors.map((err) => (
									<li key={err}>{err}</li>
								))}
							</ul>
						) : null}
					</div>
					<DagInspectorPanel />
				</div>
			)}
			<DagPickerController />
		</CompanionSurfacePanel>
	);
}
