/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level regression tests for EWA companion quick presets strip chrome/actions.
 *
 * Invariants:
 * - Premium chrome changes must not hide user workflow actions or preset application.
 *
 * Related:
 * - src/features/ewa/EwaCompanionQuickPresetsStrip.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EwaCompanionQuickPresetsStrip } from '@/features/ewa/EwaCompanionQuickPresetsStrip';
import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';

vi.mock('react-i18next', () => ({
	initReactI18next: { type: '3rdParty', init: () => {} },
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === 'ewaCompanion.quickPresetsTitle') {
				return `${String(options?.name ?? 'EWA')} tools:${String(options?.count ?? 0)}`;
			}
			return options?.count != null ? `${key}:${options.count}` : key;
		},
		i18n: { language: 'ru' },
	}),
}));

vi.mock('@/pages/Desktop/context/DesktopShellFrameContext', () => ({
	useDesktopShellFrame: () => 'dark',
}));

vi.mock('@/features/ewa/ewaIcons/EwaIcon', () => ({
	EwaIcon: ({ name }: { name: string }) => (
		<span data-testid={`ewa-icon-${name}`} />
	),
}));

const presets: CompanionQuickPresetChip[] = [
	{
		id: 'user-preset-1',
		label: 'Мой быстрый старт',
		promptText: 'Собери план на сегодня',
		builtin: false,
		sortOrder: 1,
	},
];

const toolPresets: CompanionQuickPresetChip[] = [
	{
		id: 'builtin-tool',
		label: 'Список документов',
		promptText: 'Покажи список документов',
		builtin: true,
		sortOrder: 1,
	},
];

describe('EwaCompanionQuickPresetsStrip', () => {
	it('keeps quick preset and workflow actions visible in the premium shell', () => {
		const onApplyPreset = vi.fn();
		const onOpenWorkflowChains = vi.fn();
		const onCreateWorkflowChain = vi.fn();

		render(
			<EwaCompanionQuickPresetsStrip
				principalId="p1"
				presets={presets}
				draft=""
				pending={false}
				voiceInputBusy={false}
				savingQuickPreset={false}
				deletingQuickPresetId={null}
				renamingQuickPresetId={null}
				onApplyPreset={onApplyPreset}
				onSaveDraft={vi.fn()}
				onDeletePreset={vi.fn()}
				onRenamePreset={vi.fn()}
				onOpenWorkflowChains={onOpenWorkflowChains}
				onCreateWorkflowChain={onCreateWorkflowChain}
				companionDisplayName="Tala"
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-quick-presets-strip')
		).toBeInTheDocument();
		fireEvent.click(screen.getByTestId('ewa-companion-open-workflow-chains'));
		fireEvent.click(screen.getByTestId('ewa-companion-create-workflow-chain'));
		fireEvent.click(screen.getByTitle('Мой быстрый старт'));

		expect(onOpenWorkflowChains).toHaveBeenCalledTimes(1);
		expect(onCreateWorkflowChain).toHaveBeenCalledTimes(1);
		expect(onApplyPreset).toHaveBeenCalledWith(presets[0]);
	});

	it('can render inline inside the composer chrome', () => {
		render(
			<EwaCompanionQuickPresetsStrip
				principalId="p1"
				presets={presets}
				draft=""
				pending={false}
				voiceInputBusy={false}
				savingQuickPreset={false}
				deletingQuickPresetId={null}
				renamingQuickPresetId={null}
				onApplyPreset={vi.fn()}
				onSaveDraft={vi.fn()}
				onDeletePreset={vi.fn()}
				onRenamePreset={vi.fn()}
				companionDisplayName="Tala"
				variant="inline"
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-quick-presets-strip')
		).toBeInTheDocument();
		expect(screen.getByTitle('Мой быстрый старт')).toBeInTheDocument();
	});

	it('hides legacy tools popover when catalog launcher is provided', () => {
		const onOpenToolsCatalog = vi.fn();
		render(
			<EwaCompanionQuickPresetsStrip
				principalId="p1"
				presets={toolPresets}
				draft=""
				pending={false}
				voiceInputBusy={false}
				savingQuickPreset={false}
				deletingQuickPresetId={null}
				renamingQuickPresetId={null}
				onApplyPreset={vi.fn()}
				onSaveDraft={vi.fn()}
				onDeletePreset={vi.fn()}
				onRenamePreset={vi.fn()}
				onOpenToolsCatalog={onOpenToolsCatalog}
				companionDisplayName="Tala"
				variant="inline"
			/>
		);

		expect(
			screen.queryByRole('button', { name: /quickPresetsSuggestedToggle/ })
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByTestId('ewa-companion-open-tools-catalog'));
		expect(onOpenToolsCatalog).toHaveBeenCalledTimes(1);
	});

	it('hides inline launchers when launcherPlacement is external', () => {
		render(
			<EwaCompanionQuickPresetsStrip
				principalId="p1"
				presets={presets}
				draft=""
				pending={false}
				voiceInputBusy={false}
				savingQuickPreset={false}
				deletingQuickPresetId={null}
				renamingQuickPresetId={null}
				onApplyPreset={vi.fn()}
				onSaveDraft={vi.fn()}
				onDeletePreset={vi.fn()}
				onRenamePreset={vi.fn()}
				onOpenToolsCatalog={vi.fn()}
				onOpenMyPhrases={vi.fn()}
				companionDisplayName="Tala"
				variant="inline"
				launcherPlacement="external"
			/>
		);

		expect(
			screen.queryByTestId('ewa-companion-open-tools-catalog')
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-open-my-phrases')
		).not.toBeInTheDocument();
	});

	it('does not duplicate pinned presets in priority expand row', () => {
		const pinned = presets[0];
		render(
			<EwaCompanionQuickPresetsStrip
				principalId="p1"
				presets={presets}
				pinnedPresets={[pinned]}
				draft=""
				pending={false}
				voiceInputBusy={false}
				savingQuickPreset={false}
				deletingQuickPresetId={null}
				renamingQuickPresetId={null}
				onApplyPreset={vi.fn()}
				onSaveDraft={vi.fn()}
				onDeletePreset={vi.fn()}
				onRenamePreset={vi.fn()}
				companionDisplayName="Tala"
				variant="inline"
			/>
		);

		expect(screen.getAllByTitle('Мой быстрый старт')).toHaveLength(1);
	});

	it('opens tool popover and applies a tool prompt', () => {
		const onApplyPreset = vi.fn();
		render(
			<EwaCompanionQuickPresetsStrip
				principalId="p1"
				presets={toolPresets}
				draft=""
				pending={false}
				voiceInputBusy={false}
				savingQuickPreset={false}
				deletingQuickPresetId={null}
				renamingQuickPresetId={null}
				onApplyPreset={onApplyPreset}
				onSaveDraft={vi.fn()}
				onDeletePreset={vi.fn()}
				onRenamePreset={vi.fn()}
				companionDisplayName="Tala"
				variant="inline"
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: /quickPresetsSuggestedToggle/ })
		);
		expect(screen.getByText('Tala tools:1')).toBeInTheDocument();
		expect(screen.queryByText(/EWA tools/)).not.toBeInTheDocument();
		fireEvent.click(screen.getByTitle('Список документов'));
		expect(onApplyPreset).toHaveBeenCalledWith(toolPresets[0]);
	});
});
