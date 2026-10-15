/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component coverage for the Professional Worlds AI action test drawer.
 *
 * Invariants:
 * - Drawer validation must reject invalid JSON before invoking the dry-run callback.
 *
 * Related:
 * - AiActionsTab.tsx
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProfessionalWorldsAdminSnapshot } from '../types';
import { AiActionsTab } from './AiActionsTab';

const apiMock = vi.hoisted(() => ({
	updateProfessionalWorldsAiAction: vi.fn(),
}));

vi.mock('../api', () => apiMock);

const baseDraft = {
	module_key: 'objects',
	action_key: '',
	display_name: '',
	prompt_template: 'Use {{property}} and {{instruction}}.',
};

function makeSnapshot(): ProfessionalWorldsAdminSnapshot {
	return {
		overview: {
			verticals_count: 1,
			modules_count: 1,
			ai_actions_count: 1,
			photo_presets_count: 0,
			enabled_integrations_count: 0,
			pack_versions_count: 0,
			pack_releases_count: 0,
			published_releases_count: 0,
			active_rollouts_count: 0,
			broken_bindings: [],
		},
		verticals: [],
		modules: [
			{
				id: 'module-1',
				module_key: 'objects',
				name: 'Objects',
				description: null,
				category: 'core',
				icon_key: 'home',
				default_config: {},
				is_active: true,
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		assignments: [],
		schemas: [],
		aiActions: [
			{
				id: 'action-1',
				vertical_slug: 'realtor',
				module_key: 'objects',
				action_key: 'listing_quality_audit',
				display_name: 'Listing quality audit',
				description: 'Checks listing quality.',
				ugs_type_key: 'professional_ai_action',
				workflow_slug: 'listing_quality_audit',
				prompt_template: 'Audit this listing.',
				input_schema: {},
				output_schema: {},
				safety_rules: [],
				artifact_kind: 'audit',
				billing_hint: {},
				is_active: true,
				sort_order: 10,
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		photoPresets: [],
		integrations: [],
		audit: [],
	};
}

function renderAiActionsTab(onTestAction = vi.fn()) {
	return {
		onTestAction,
		...render(
			<AiActionsTab
				snapshot={makeSnapshot()}
				verticalSlug="realtor"
				aiActionDraft={baseDraft}
				setAiActionDraft={vi.fn()}
				onCreateAiAction={vi.fn()}
				onTestAction={onTestAction}
				onChanged={vi.fn()}
			/>
		),
	};
}

describe('AiActionsTab test drawer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('labels module selector options with names and service keys', () => {
		renderAiActionsTab();

		expect(
			screen.getByText(/Action module|Модуль действия/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Service action key|Служебный ключ действия/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Action name|Название действия/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Prompt template|Шаблон запроса/)
		).toBeInTheDocument();

		const moduleSelect = screen.getByRole('combobox', {
			name: /Module this action belongs to|Модуль, к которому относится действие/,
		});

		expect(
			within(moduleSelect).getByRole('option', {
				name: /Objects · key objects|Objects · ключ objects/,
			})
		).toBeInTheDocument();
	});

	it('opens with a sample payload and runs the selected action after validation', () => {
		const onTestAction = vi.fn();
		renderAiActionsTab(onTestAction);

		fireEvent.click(
			screen.getByRole('button', {
				name: /Test payload|Тестовые входные данные/,
			})
		);

		const dialog = screen.getByRole('dialog', {
			name: /AI action test payload|Тестовые входные данные действия ИИ/,
		});
		expect(
			within(dialog).getByDisplayValue(/listing_quality_audit/)
		).toBeInTheDocument();

		fireEvent.click(
			within(dialog).getByRole('button', {
				name: /Run dry-run|Запустить пробную проверку/,
			})
		);

		expect(onTestAction).toHaveBeenCalledWith('listing_quality_audit');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('keeps the drawer open and shows a JSON error for invalid payload text', () => {
		const onTestAction = vi.fn();
		renderAiActionsTab(onTestAction);

		fireEvent.click(
			screen.getByRole('button', {
				name: /Test payload|Тестовые входные данные/,
			})
		);
		const dialog = screen.getByRole('dialog', {
			name: /AI action test payload|Тестовые входные данные действия ИИ/,
		});
		fireEvent.change(within(dialog).getByRole('textbox'), {
			target: { value: '{"vertical_slug":' },
		});
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: /Validate payload|Проверить входные данные/,
			})
		);

		expect(onTestAction).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText(/JSON error|Ошибка JSON/)).toBeInTheDocument();
	});
});
