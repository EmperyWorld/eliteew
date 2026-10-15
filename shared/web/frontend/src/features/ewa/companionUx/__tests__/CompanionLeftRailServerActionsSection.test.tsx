/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionLeftRailServerActionsSection (U8.3 slice 9).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CompanionLeftRailServerActionsSection } from '@/features/ewa/companionUx/CompanionLeftRailServerActionsSection';

const labels = {
	musicStudioOpen: 'Music studio',
	appOpen: 'App',
	themeSet: 'Theme',
	docCreate: 'Doc',
	docInsert: 'Insert',
	fileRename: 'Rename',
	fileDelete: 'Delete',
	planCreate: 'Plan',
	planTaskComplete: 'Task',
	operationsStatus: 'Status',
	operationCancel: 'Cancel',
	generic: (tool: string) => tool,
	statusOk: 'ok',
	statusNeedsConfirm: 'confirm',
};

describe('CompanionLeftRailServerActionsSection', () => {
	it('renders server actions strip when entries exist', () => {
		render(
			<CompanionLeftRailServerActionsSection
				actions={[
					{
						tool: 'music_studio_open',
						branch: 'music_studio_open',
						status: 'ok',
						summary: 'Opened studio',
						ts: '2026-06-22T00:00:00.000Z',
					},
				]}
				labels={labels}
				leftRailExpanded={null}
				onToggleSection={() => {}}
				reducedMotion={true}
			/>
		);
		expect(
			screen.getByTestId('ewa-companion-server-actions-strip')
		).toBeInTheDocument();
	});

	it('returns null when action list is empty', () => {
		const { container } = render(
			<CompanionLeftRailServerActionsSection
				actions={[]}
				labels={labels}
				leftRailExpanded={null}
				onToggleSection={() => {}}
				reducedMotion={true}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});
