/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for UGS Admin v2 route deletion and provider model-field guardrails.
 *
 * Invariants:
 * - Scoped route deletion must emit a patch with `null`, not a full replace.
 * - Non-text providers must keep model fields disabled in the bulk edit UI.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/ModelsTabV2.tsx
 * - src/features/ugs/admin-v2/components/ProvidersBulkEditModal.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '@/i18n/config';

import { ProvidersBulkEditModal } from '../components/ProvidersBulkEditModal';
import { ModelsTabV2 } from '../tabs/ModelsTabV2';
import { OverviewTabV2 } from '../tabs/OverviewTabV2';
import { SettingsTabV2 } from '../tabs/SettingsTabV2';
import type { UgsAdminV2SnapshotDTO } from '@/services/api/ugsAdminV2';

vi.mock('@/services/api/ugsAdmin', () => ({
	getLlamaModels: vi.fn(async () => ['live-model-a', 'live-model-b']),
}));

function makeSnapshot(): UgsAdminV2SnapshotDTO {
	return {
		providers: [
			{
				id: 'provider-1',
				provider_name: 'llama',
				provider_type: 'llama',
				base_url: 'http://stack2-llama-chat:8080',
				api_key_required: false,
				health_endpoint: '/health',
				timeout_seconds: 120,
				max_concurrent: 5,
				enabled: true,
				cost_per_request: 0,
				fallback_priority: 0,
				fallback_for: [],
				config_json: { models: ['provider-model'] },
				display_label: null,
			},
			{
				id: 'provider-2',
				provider_name: 'stable_diffusion',
				provider_type: 'stable_diffusion',
				base_url: 'http://stack2-stable-diffusion:7860',
				api_key_required: false,
				health_endpoint: '/health',
				timeout_seconds: 120,
				max_concurrent: 2,
				enabled: true,
				cost_per_request: 0,
				fallback_priority: 0,
				fallback_for: [],
				config_json: {
					default_model: 'legacy-image-model',
					models: ['legacy-image-model'],
					provider_role: 'text',
					keep: true,
				},
				display_label: null,
			},
		],
		types: [
			{
				id: 'type-1',
				type_key: 'text_chat',
				category: 'text',
				display_name: 'Text chat',
				description: null,
				provider: 'llama',
				model_name: null,
				parameters: {},
				complexity: 'medium',
				estimated_time: 60,
				max_retries: 3,
				priority: 5,
				cost_credits: 0,
				is_active: true,
				metadata: {},
			},
			{
				id: 'type-2',
				type_key: 'text_summary',
				category: 'text',
				display_name: 'Text summary',
				description: null,
				provider: 'llama',
				model_name: null,
				parameters: {},
				complexity: 'medium',
				estimated_time: 60,
				max_retries: 3,
				priority: 5,
				cost_credits: 0,
				is_active: true,
				metadata: {},
			},
		],
		workflows: [],
		settings: { items: [], total: 0 },
		model_routes: {
			global_default_model: null,
			provider_defaults: { llama: 'provider-model' },
			category_defaults: {},
			domain_defaults: {},
			type_overrides: {},
			request_model_override_allowlist: [],
		},
		model_inventory: [
			{
				provider_name: 'llama',
				model_id: 'provider-model',
				label: null,
				enabled: true,
				source: 'provider.config_json',
				capabilities: [],
			},
		],
		resolved_models_by_type: [],
		config_source_audit: [],
		autofix_recommendations: [],
		issues: [],
		generated_at: '2026-05-06T00:00:00Z',
	};
}

describe('UGS Admin v2 guardrails', () => {
	it('emits null scoped route patch when deleting provider default', () => {
		const onRequestBulk = vi.fn();
		render(
			<ModelsTabV2 snapshot={makeSnapshot()} onRequestBulk={onRequestBulk} />
		);

		fireEvent.change(screen.getByDisplayValue('global'), {
			target: { value: 'provider' },
		});
		fireEvent.change(
			screen.getByPlaceholderText('provider/category/domain/type_key'),
			{
				target: { value: 'llama' },
			}
		);
		fireEvent.click(
			screen.getByRole('button', { name: /Удалить route|Delete route/i })
		);

		expect(onRequestBulk).toHaveBeenCalledWith([
			{
				kind: 'model_routes.patch',
				routes: expect.objectContaining({
					provider_defaults: { llama: null },
				}),
			},
		]);
	});

	it('emits allowlist-only model_routes.patch', () => {
		const onRequestBulk = vi.fn();
		render(
			<ModelsTabV2 snapshot={makeSnapshot()} onRequestBulk={onRequestBulk} />
		);

		fireEvent.change(screen.getByPlaceholderText('model-a, model-b'), {
			target: { value: 'override-a, override-b' },
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: /Save allowlist|Сохранить allowlist/i,
			})
		);

		expect(onRequestBulk).toHaveBeenCalledWith([
			{
				kind: 'model_routes.patch',
				routes: expect.objectContaining({
					request_model_override_allowlist: ['override-a', 'override-b'],
				}),
			},
		]);
	});

	it('disables model fields for non-text provider bulk edit', () => {
		const onConfirm = vi.fn();
		render(
			<ProvidersBulkEditModal
				open
				snapshot={makeSnapshot()}
				targetProviderNames={['stable_diffusion']}
				onClose={vi.fn()}
				onConfirm={onConfirm}
			/>
		);

		expect(screen.getByLabelText('default_model')).toBeDisabled();
		expect(screen.getByLabelText('models (csv)')).toBeDisabled();
		fireEvent.click(
			screen.getByRole('button', {
				name: /Сформировать очистку config_json|Generate config_json cleanup/i,
			})
		);
		expect(onConfirm).toHaveBeenCalledWith([
			{
				kind: 'provider.patch',
				provider_names: ['stable_diffusion'],
				patch: { config_json: { keep: true } },
			},
		]);
	});

	it('applies provider model to every current provider type via type overrides', () => {
		const onConfirm = vi.fn();
		render(
			<ProvidersBulkEditModal
				open
				snapshot={makeSnapshot()}
				targetProviderNames={['llama']}
				onClose={vi.fn()}
				onConfirm={onConfirm}
			/>
		);

		fireEvent.change(screen.getByLabelText('default_model'), {
			target: { value: 'new-text-model' },
		});
		fireEvent.click(
			screen.getAllByRole('button', {
				name: /Сформировать изменения|Generate changes/i,
			})[0]
		);

		expect(onConfirm).toHaveBeenCalledWith([
			{
				kind: 'model_routes.patch',
				routes: expect.objectContaining({
					provider_defaults: { llama: 'new-text-model' },
					type_overrides: {
						text_chat: 'new-text-model',
						text_summary: 'new-text-model',
					},
				}),
			},
		]);
	});

	it('emits settings.create from Settings tab modal', () => {
		const onRequestBulk = vi.fn();
		render(
			<SettingsTabV2 snapshot={makeSnapshot()} onRequestBulk={onRequestBulk} />
		);

		fireEvent.click(
			screen.getByRole('button', { name: /Добавить настройку|Add setting/i })
		);
		const keySpan = screen
			.getAllByText(/^key$/i)
			.find((element) => element.tagName === 'SPAN');
		const keyField = keySpan?.closest('label')?.querySelector('input');
		expect(keyField).toBeTruthy();
		fireEvent.change(keyField as HTMLInputElement, {
			target: { value: 'queue_limits' },
		});
		fireEvent.click(screen.getByRole('button', { name: /Применить|Apply/i }));

		expect(onRequestBulk).toHaveBeenCalledWith([
			expect.objectContaining({
				kind: 'settings.create',
				setting: expect.objectContaining({
					key: 'queue_limits',
					value: {},
				}),
			}),
		]);
	});

	it('calls bootstrap runtime handler from Overview tab', () => {
		const onBootstrapRuntime = vi.fn();
		render(
			<OverviewTabV2
				snapshot={makeSnapshot()}
				onRequestBulk={vi.fn()}
				onBootstrapRuntime={onBootstrapRuntime}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: /Bootstrap runtime providers/i,
			})
		);
		expect(onBootstrapRuntime).toHaveBeenCalledTimes(1);
	});

	it('requests provider.models.refresh after llama discovery', async () => {
		const onRequestBulk = vi.fn();
		render(
			<ModelsTabV2 snapshot={makeSnapshot()} onRequestBulk={onRequestBulk} />
		);

		fireEvent.click(
			screen.getByRole('button', { name: /Обнаружить модели|Discover models/i })
		);
		await waitFor(() =>
			expect(
				screen.getByText(/Найдено моделей: 2|Models found: 2/i)
			).toBeInTheDocument()
		);

		fireEvent.click(
			screen.getAllByRole('button', {
				name: /Сканировать модели \(записать в БД\)|Scan models \(write to DB\)/i,
			})[0]
		);

		expect(onRequestBulk).toHaveBeenCalledWith([
			{ kind: 'provider.models.refresh', provider_names: ['llama'] },
		]);
	});
});
