/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Selection and variable-picker session types for the DAG visual builder.
 *
 * Related:
 * - DagBuilderEditorContext.tsx
 */

export type DagSelection =
	| { kind: 'none' }
	| { kind: 'node'; nodeId: string }
	| { kind: 'edge'; flowEdgeId: string };

export type PickerAnchor =
	| { kind: 'node_input'; nodeId: string; inputKey: string }
	| { kind: 'node_config'; nodeId: string; configKey: string }
	| { kind: 'edge_mapping'; flowEdgeId: string; mappingKey: string };

export type PickerSession = {
	anchor: PickerAnchor;
	anchorRect: DOMRect | null;
} | null;

export function selectionEquals(a: DagSelection, b: DagSelection): boolean {
	if (a.kind !== b.kind) return false;
	if (a.kind === 'none' || b.kind === 'none') return true;
	if (a.kind === 'node' && b.kind === 'node') return a.nodeId === b.nodeId;
	if (a.kind === 'edge' && b.kind === 'edge')
		return a.flowEdgeId === b.flowEdgeId;
	return false;
}
