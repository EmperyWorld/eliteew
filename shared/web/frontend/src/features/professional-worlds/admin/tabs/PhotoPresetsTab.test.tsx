/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component coverage for Professional Worlds photo preset test drawer and content picker handoff.
 *
 * Invariants:
 * - Drawer validation must reject invalid parameter JSON before invoking the dry-run API.
 * - Unified Content selections update the sample content id used by dry-run.
 *
 * Related:
 * - PhotoPresetsTab.tsx
 * - ../api.ts
 */

import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProfessionalWorldsAdminSnapshot } from '../types';
import { PhotoPresetsTab } from './PhotoPresetsTab';

const apiMock = vi.hoisted(() => ({
	createProfessionalWorldsPhotoPreset: vi.fn(),
	testProfessionalWorldsPhotoPreset: vi.fn(),
	updateProfessionalWorldsPhotoPreset: vi.fn(),
}));

vi.mock('../api', () => apiMock);

vi.mock('@/components/UnifiedContent/picker/UnifiedContentPickerModal', () => ({
	UnifiedContentPickerModal: ({
		open,
		onConfirm,
		title,
		confirmLabel,
	}: {
		open: boolean;
		onConfirm: (items: { id: string }[]) => void;
		title: string;
		confirmLabel: string;
	}) =>
		open ? (
			<div aria-label={title} role="dialog">
				<button
					type="button"
					onClick={() => onConfirm([{ id: 'picked-content-1' }])}
				>
					{confirmLabel}
				</button>
			</div>
		) : null,
}));

function makeSnapshot(): ProfessionalWorldsAdminSnapshot {
	return {
		overview: {
			verticals_count: 1,
			modules_count: 0,
			ai_actions_count: 0,
			photo_presets_count: 1,
			enabled_integrations_count: 0,
			pack_versions_count: 0,
			pack_releases_count: 0,
			published_releases_count: 0,
			active_rollouts_count: 0,
			broken_bindings: [],
		},
		verticals: [],
		modules: [],
		assignments: [],
		schemas: [],
		aiActions: [],
		photoPresets: [
			{
				id: 'preset-1',
				vertical_slug: 'realtor',
				preset_key: 'hero_cover',
				display_name: 'Hero cover',
				description: 'Enhances listing cover photos.',
				category: 'enhance',
				action_type: 'image_edit',
				ugs_type_key: 'image_studio_image_edit',
				prompt_template: 'Make this photo marketplace ready.',
				parameters: { aspect_ratio: '16:9' },
				is_active: true,
				sort_order: 10,
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		integrations: [],
		audit: [],
	};
}

function renderPhotoPresetsTab() {
	return render(
		<PhotoPresetsTab
			snapshot={makeSnapshot()}
			verticalSlug="realtor"
			onChanged={vi.fn()}
		/>
	);
}

describe('PhotoPresetsTab test drawer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		apiMock.testProfessionalWorldsPhotoPreset.mockResolvedValue({
			status: 'ok',
			preset_key: 'hero_cover',
		});
	});

	it('labels editor fields with operator copy', () => {
		renderPhotoPresetsTab();

		expect(
			screen.getByText(/Photo setting name|Название фото-настройки/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Processing type|Тип обработки/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Processing instruction|Инструкция обработки/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Preset parameters|Параметры фото-настройки/)
		).toBeInTheDocument();
	});

	it('runs dry-run with a manual sample Unified Content id', async () => {
		renderPhotoPresetsTab();

		fireEvent.click(
			screen.getByRole('button', { name: /Test preset|Тест фото-настройки/ })
		);
		const dialog = screen.getByRole('dialog', {
			name: /Photo preset test|Тест фото-настройки/,
		});
		fireEvent.change(
			within(dialog).getByPlaceholderText(
				/ID фото из медиатеки|Unified Content photo ID/
			),
			{ target: { value: 'content-42' } }
		);
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: /Run dry-run|Запустить пробную проверку/,
			})
		);

		await waitFor(() => {
			expect(apiMock.testProfessionalWorldsPhotoPreset).toHaveBeenCalledWith(
				'hero_cover',
				'realtor',
				'content-42'
			);
		});
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('updates the sample content id from the Unified Content picker', async () => {
		renderPhotoPresetsTab();

		fireEvent.click(
			screen.getByRole('button', { name: /Test preset|Тест фото-настройки/ })
		);
		const dialog = screen.getByRole('dialog', {
			name: /Photo preset test|Тест фото-настройки/,
		});
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: /Choose from Unified Content|Выбрать из медиатеки/,
			})
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: /Use selected content|Использовать выбранный файл/,
			})
		);

		expect(
			within(dialog).getByDisplayValue('picked-content-1')
		).toBeInTheDocument();
	});

	it('shows a JSON error and skips dry-run when test parameters are invalid', async () => {
		renderPhotoPresetsTab();

		fireEvent.click(
			screen.getByRole('button', { name: /Test preset|Тест фото-настройки/ })
		);
		const dialog = screen.getByRole('dialog', {
			name: /Photo preset test|Тест фото-настройки/,
		});
		fireEvent.change(
			within(dialog).getByLabelText(/Test parameters|Тестовые параметры/),
			{ target: { value: '{"aspect_ratio":' } }
		);
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: /Run dry-run|Запустить пробную проверку/,
			})
		);

		expect(apiMock.testProfessionalWorldsPhotoPreset).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText(/JSON error|Ошибка JSON/)).toBeInTheDocument();
	});
});
