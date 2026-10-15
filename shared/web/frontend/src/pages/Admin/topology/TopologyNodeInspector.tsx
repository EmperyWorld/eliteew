/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Drawer inspector for a selected topology catalog node (connections + factory).
 *
 * Invariants:
 * - Read-only; edges are catalog-declared only.
 *
 * Related:
 * - TopologyAdminSection.tsx
 * - topologyApi.ts
 */

import { useTranslation } from 'react-i18next';
import { AdminButton, AdminDrawer } from '../ui';
import type { TopologyEdge, TopologyNode } from './topologyApi';
import { TopologyHealthBadge } from './TopologyHealthBadge';
import { TopologyInspectorSection } from './TopologyInspectorSection';
import { adminUiMetaClass, bandAccent } from './topologyAdminHelpers';

export interface TopologyNodeInspectorProps {
	node: TopologyNode | null;
	allNodes: TopologyNode[];
	edges: TopologyEdge[];
	onClose: () => void;
	onNavigateToNode?: (nodeId: string) => void;
	onFocusOnMap?: () => void;
}

function nodeLabel(nodes: TopologyNode[], id: string): string {
	return nodes.find((n) => n.id === id)?.label ?? id;
}

function ConnectionRow({
	edge,
	peerId,
	peerLabel,
	direction,
	onNavigate,
}: {
	edge: TopologyEdge;
	peerId: string;
	peerLabel: string;
	direction: 'incoming' | 'outgoing';
	onNavigate?: (nodeId: string) => void;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	return (
		<li className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]/70 px-2 py-1.5 text-[length:var(--admin-ui-text-sm)]">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<span className="font-mono text-[10px] uppercase text-[var(--admin-ui-fg-dim)]">
						{edge.kind}
					</span>
					<p className="text-[var(--admin-ui-fg)]">
						{direction === 'incoming'
							? t('adminTopology.connectionFrom', {
									peer: peerLabel,
									defaultValue: `From ${peerLabel}`,
								})
							: t('adminTopology.connectionTo', {
									peer: peerLabel,
									defaultValue: `To ${peerLabel}`,
								})}
					</p>
					{edge.topics.length > 0 ? (
						<p className={`mt-0.5 ${adminUiMetaClass}`}>
							{edge.topics.join(', ')}
						</p>
					) : null}
				</div>
				{onNavigate ? (
					<AdminButton
						variant="ghost"
						className="shrink-0 px-2 py-1 text-[11px]"
						onClick={() => onNavigate(peerId)}
					>
						{t('adminTopology.openNode', 'Open')}
					</AdminButton>
				) : null}
			</div>
		</li>
	);
}

export function TopologyNodeInspector({
	node,
	allNodes,
	edges,
	onClose,
	onNavigateToNode,
	onFocusOnMap,
}: TopologyNodeInspectorProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const open = node != null;

	const incoming = node ? edges.filter((e) => e.target === node.id) : [];
	const outgoing = node ? edges.filter((e) => e.source === node.id) : [];
	const connectionCount = incoming.length + outgoing.length;

	return (
		<AdminDrawer open={open} onClose={onClose} title={node?.label ?? ''}>
			{node ? (
				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<TopologyHealthBadge health={node.health} size="md" />
							{node.factory_touch ? (
								<span className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-status-info)]/40 bg-[var(--admin-ui-status-info-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--admin-ui-status-info)]">
									{t('adminTopology.factoryActive', 'Factory active')}
								</span>
							) : null}
						</div>
						{onFocusOnMap ? (
							<AdminButton variant="secondary" onClick={onFocusOnMap}>
								{t('adminTopology.focusOnMap', 'Focus on map')}
							</AdminButton>
						) : null}
					</div>

					<TopologyInspectorSection
						title={t('adminTopology.sectionIdentity', 'Identity')}
						defaultOpen
					>
						<dl className="grid gap-3 sm:grid-cols-2">
							<div>
								<dt className={adminUiMetaClass}>
									{t('adminTopology.fieldId', 'Id')}
								</dt>
								<dd className="mt-0.5 break-all font-mono text-sm text-[var(--admin-ui-fg)]">
									{node.id}
								</dd>
							</div>
							<div>
								<dt className={adminUiMetaClass}>
									{t('adminTopology.fieldBand', 'Band')}
								</dt>
								<dd
									className="mt-0.5 text-sm font-medium"
									style={{ color: bandAccent(node.band) }}
								>
									{node.band}
								</dd>
							</div>
							<div>
								<dt className={adminUiMetaClass}>
									{t('adminTopology.fieldRole', 'Role')}
								</dt>
								<dd className="mt-0.5 text-sm text-[var(--admin-ui-fg)]">
									{node.role}
								</dd>
							</div>
							<div>
								<dt className={adminUiMetaClass}>
									{t('adminTopology.fieldOrigin', 'Origin')}
								</dt>
								<dd className="mt-0.5 text-sm text-[var(--admin-ui-fg)]">
									{node.origin}
								</dd>
							</div>
						</dl>
					</TopologyInspectorSection>

					{node.features.length > 0 ? (
						<TopologyInspectorSection
							title={t('adminTopology.features', 'Features')}
							badge={
								<span className={adminUiMetaClass}>{node.features.length}</span>
							}
						>
							<ul className="flex flex-wrap gap-1.5">
								{node.features.map((feature) => (
									<li
										key={feature}
										className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-ui-fg-muted)]"
									>
										{feature}
									</li>
								))}
							</ul>
						</TopologyInspectorSection>
					) : null}

					{node.factory_touches && node.factory_touches.length > 0 ? (
						<TopologyInspectorSection
							title={t('adminTopology.factoryTouches', 'Factory intentions')}
							badge={
								<span className={adminUiMetaClass}>
									{node.factory_touches.length}
								</span>
							}
						>
							<ul className="space-y-2">
								{node.factory_touches.map((touch) => (
									<li
										key={touch.intention_id}
										className="rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] px-3 py-2"
									>
										<p className="text-sm font-medium text-[var(--admin-ui-fg)]">
											{touch.title || touch.intention_id}
										</p>
										<p className={`mt-0.5 ${adminUiMetaClass}`}>
											{touch.stage} · {touch.status}
										</p>
									</li>
								))}
							</ul>
						</TopologyInspectorSection>
					) : null}

					<TopologyInspectorSection
						title={t('adminTopology.connections', 'Connections')}
						badge={
							connectionCount > 0 ? (
								<span className={adminUiMetaClass}>{connectionCount}</span>
							) : null
						}
						defaultOpen={connectionCount > 0}
					>
						{connectionCount === 0 ? (
							<p className={adminUiMetaClass}>
								{t(
									'adminTopology.noConnections',
									'No declared edges for this node.'
								)}
							</p>
						) : (
							<div className="space-y-3">
								{incoming.length > 0 ? (
									<div>
										<p className={adminUiMetaClass}>
											{t('adminTopology.incoming', 'Incoming')}
										</p>
										<ul className="mt-1 space-y-1.5">
											{incoming.map((edge) => (
												<ConnectionRow
													key={edge.id}
													edge={edge}
													peerId={edge.source}
													peerLabel={nodeLabel(allNodes, edge.source)}
													direction="incoming"
													onNavigate={onNavigateToNode}
												/>
											))}
										</ul>
									</div>
								) : null}
								{outgoing.length > 0 ? (
									<div>
										<p className={adminUiMetaClass}>
											{t('adminTopology.outgoing', 'Outgoing')}
										</p>
										<ul className="mt-1 space-y-1.5">
											{outgoing.map((edge) => (
												<ConnectionRow
													key={edge.id}
													edge={edge}
													peerId={edge.target}
													peerLabel={nodeLabel(allNodes, edge.target)}
													direction="outgoing"
													onNavigate={onNavigateToNode}
												/>
											))}
										</ul>
									</div>
								) : null}
							</div>
						)}
					</TopologyInspectorSection>
				</div>
			) : null}
		</AdminDrawer>
	);
}
