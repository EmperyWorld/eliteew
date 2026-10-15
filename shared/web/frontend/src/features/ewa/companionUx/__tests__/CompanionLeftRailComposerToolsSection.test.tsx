/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionLeftRailComposerToolsSection in desktop left guide rail.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionLeftRailComposerToolsSection } from '@/features/ewa/companionUx/CompanionLeftRailComposerToolsSection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('@/features/ewa/ewaIcons/EwaIcon', () => ({
	EwaIcon: ({ name }: { name: string }) => (
		<span data-testid={`ewa-icon-${name}`} />
	),
}));

describe('CompanionLeftRailComposerToolsSection', () => {
	it('toggles web search and opens tools catalog from left guide rail', () => {
		const onWebSearchChange = vi.fn();
		const onOpenToolsCatalog = vi.fn();

		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={onWebSearchChange}
				onAttachImage={vi.fn()}
				onOpenToolsCatalog={onOpenToolsCatalog}
				toolsCatalogCount={22}
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-left-rail-composer-tools')
		).toBeInTheDocument();
		fireEvent.click(screen.getByTestId('ewa-companion-web-search-rail'));
		expect(onWebSearchChange).toHaveBeenCalledWith(true);
		fireEvent.click(screen.getByTestId('ewa-companion-open-tools-catalog'));
		expect(onOpenToolsCatalog).toHaveBeenCalledTimes(1);
	});

	it('shows one-shot hint when web search is enabled', () => {
		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={true}
				webSearchLabel="Web search"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				onAttachImage={vi.fn()}
			/>
		);

		expect(
			screen.getByText('ewaCompanion.webSearchOneShotHint')
		).toBeInTheDocument();
		expect(
			screen.getByText('ewaCompanion.webSearchLabelActive')
		).toBeInTheDocument();
	});

	it('toggles auto-accept tasks when handler is provided', () => {
		const onAutoAcceptTasksChange = vi.fn();

		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				autoAcceptTasks={false}
				onAutoAcceptTasksChange={onAutoAcceptTasksChange}
				onAttachImage={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByTestId('ewa-companion-auto-accept-tasks-rail'));
		expect(onAutoAcceptTasksChange).toHaveBeenCalledWith(true);
	});

	it('hides auto-accept tumbler when handler is omitted', () => {
		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				onAttachImage={vi.fn()}
			/>
		);

		expect(
			screen.queryByTestId('ewa-companion-auto-accept-tasks-rail')
		).not.toBeInTheDocument();
	});

	it('toggles contemplation when handler is provided', () => {
		const onContemplationChange = vi.fn();

		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				contemplationOn={false}
				onContemplationChange={onContemplationChange}
				onAttachImage={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByTestId('ewa-companion-contemplation-rail'));
		expect(onContemplationChange).toHaveBeenCalledWith(true);
	});

	it('shows contemplation hint when mode is on', () => {
		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				contemplationOn={true}
				onContemplationChange={vi.fn()}
				onAttachImage={vi.fn()}
			/>
		);

		expect(
			screen.getByText('ewaCompanion.contemplationHint')
		).toBeInTheDocument();
		expect(
			screen.getByText('ewaCompanion.contemplationLabelActive')
		).toBeInTheDocument();
	});

	it('hides contemplation tumbler when handler is omitted', () => {
		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				onAttachImage={vi.fn()}
			/>
		);

		expect(
			screen.queryByTestId('ewa-companion-contemplation-rail')
		).not.toBeInTheDocument();
	});

	it('opens the visual workflow builder when its launcher is provided', () => {
		const onCreateDagWorkflowChain = vi.fn();
		render(
			<CompanionLeftRailComposerToolsSection
				pending={false}
				useWebSearch={false}
				webSearchLabel="Web"
				webSearchTitle="Web search"
				onWebSearchChange={vi.fn()}
				onAttachImage={vi.fn()}
				onCreateDagWorkflowChain={onCreateDagWorkflowChain}
			/>
		);

		fireEvent.click(
			screen.getByTestId('ewa-companion-create-dag-workflow-chain')
		);
		expect(onCreateDagWorkflowChain).toHaveBeenCalledTimes(1);
	});
});
