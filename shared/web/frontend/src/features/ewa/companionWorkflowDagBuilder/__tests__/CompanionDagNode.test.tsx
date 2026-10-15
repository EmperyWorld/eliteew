/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks user-facing DAG node cards against leaking raw schema slugs.
 *
 * Invariants:
 * - The semantic node type may remain a data attribute, but never visible card text.
 *
 * Related:
 * - ../canvas/nodes/CompanionDagNode.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionDagNode } from '@/features/ewa/companionWorkflowDagBuilder/canvas/nodes/CompanionDagNode';
import type { CompanionDagFlowNode } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import type { NodeProps } from '@xyflow/react';

vi.mock('@xyflow/react', () => ({
	Handle: () => <span data-testid="flow-handle" />,
	Position: { Top: 'top', Bottom: 'bottom' },
}));

describe('CompanionDagNode', () => {
	it('shows a friendly title without rendering the raw node type', () => {
		const props = {
			id: 'n1',
			type: 'companionDagNode',
			data: { nodeType: 'prompt_gen', title: 'Write a response' },
			selected: false,
			dragging: false,
			zIndex: 0,
			selectable: true,
			deletable: true,
			draggable: true,
			isConnectable: true,
			positionAbsoluteX: 0,
			positionAbsoluteY: 0,
		} as NodeProps<CompanionDagFlowNode>;

		render(<CompanionDagNode {...props} />);

		expect(screen.getByText('Write a response')).toBeInTheDocument();
		expect(screen.queryByText('prompt_gen')).not.toBeInTheDocument();
		expect(screen.getByTestId('ewa-dag-node-card')).toHaveAttribute(
			'data-node-type',
			'prompt_gen'
		);
	});
});
