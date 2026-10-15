/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component coverage for Professional Worlds admin tab navigation.
 *
 * Invariants:
 * - Tab labels and panel titles come from the real i18n namespace; assertions accept EN and RU where copy differs.
 * - API calls are mocked at the admin API boundary; the shell and tab buttons render normally.
 *
 * Related:
 * - ProfessionalWorldsAdminSection.tsx
 * - pages/Admin/ui (New World)
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
	assignProfessionalWorldsModule: vi.fn(),
	createProfessionalWorldsAiAction: vi.fn(),
	createProfessionalWorldsModule: vi.fn(),
	listProfessionalWorldsAudit: vi.fn(),
	listProfessionalWorldsPackVersions: vi.fn(),
	listProfessionalWorldsRollouts: vi.fn(),
	loadProfessionalWorldsAdminSnapshot: vi.fn(),
	testProfessionalWorldsAiAction: vi.fn(),
	updateProfessionalWorldsIntegration: vi.fn(),
}));

vi.mock('./api', () => apiMock);

import { ProfessionalWorldsAdminSection } from './ProfessionalWorldsAdminSection';
import type { ProfessionalWorldsAdminSnapshot } from './types';

function makeSnapshot(): ProfessionalWorldsAdminSnapshot {
	return {
		overview: {
			verticals_count: 1,
			modules_count: 1,
			ai_actions_count: 0,
			photo_presets_count: 0,
			enabled_integrations_count: 0,
			pack_versions_count: 0,
			pack_releases_count: 0,
			published_releases_count: 0,
			active_rollouts_count: 0,
			broken_bindings: [],
		},
		verticals: [
			{
				id: 'vertical-1',
				slug: 'realtor',
				name: 'Realtor',
				description: null,
				icon_key: 'home',
				is_active: true,
				profile_schema: {},
				workspace_template: {},
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		modules: [
			{
				id: 'module-1',
				module_key: 'objects',
				name: 'Objects',
				description: 'Listing workspace.',
				category: 'core',
				icon_key: 'home',
				default_config: { depends_on: ['profile'] },
				is_active: true,
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		assignments: [],
		schemas: [
			{
				id: 'schema-1',
				vertical_slug: 'realtor',
				schema_key: 'realtor_profile',
				version: 1,
				title: 'Realtor profile',
				schema_json: { type: 'object', properties: {} },
				ui_schema: {},
				is_active: true,
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		aiActions: [],
		photoPresets: [
			{
				id: 'photo-1',
				vertical_slug: 'realtor',
				preset_key: 'hero_cover',
				display_name: 'Hero cover',
				description: 'Cover cleanup.',
				category: 'enhance',
				action_type: 'image_edit',
				ugs_type_key: 'image_studio_image_edit',
				prompt_template: 'Improve photo.',
				parameters: {},
				is_active: true,
				sort_order: 1,
				created_at: '2026-05-05T00:00:00Z',
				updated_at: '2026-05-05T00:00:00Z',
			},
		],
		integrations: [],
		audit: [
			{
				id: 'audit-1',
				entity_type: 'photo_preset',
				entity_key: 'hero_cover',
				action: 'update',
				before_data: { display_name: 'Old' },
				after_data: { display_name: 'Hero cover' },
				admin_user_id: null,
				risk_level: 'normal',
				created_at: '2026-05-05T00:00:00Z',
			},
		],
	};
}

describe('ProfessionalWorldsAdminSection tab navigation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		apiMock.loadProfessionalWorldsAdminSnapshot.mockResolvedValue(
			makeSnapshot()
		);
		apiMock.listProfessionalWorldsPackVersions.mockResolvedValue([]);
		apiMock.listProfessionalWorldsRollouts.mockResolvedValue([]);
		apiMock.listProfessionalWorldsAudit.mockResolvedValue([]);
	});

	it('renders the admin tablist and opens the Packs tab', async () => {
		render(<ProfessionalWorldsAdminSection />);

		const packsTab = await screen.findByRole('tab', { name: /Пакеты|Packs/ });
		expect(
			screen.getByRole('tab', { name: /Выкаты|Rollouts/ })
		).toBeInTheDocument();
		expect(
			screen.getByRole('tab', { name: /Аудит|Audit/ })
		).toBeInTheDocument();

		fireEvent.click(packsTab);

		expect(packsTab).toHaveAttribute('aria-selected', 'true');
		expect(
			await screen.findByText(/Manifest editor|Редактор манифеста/)
		).toBeInTheDocument();
	});

	it('opens the Rollouts tab and marks it active', async () => {
		render(<ProfessionalWorldsAdminSection />);

		const rolloutsTab = await screen.findByRole('tab', {
			name: /Выкаты|Rollouts/,
		});
		fireEvent.click(rolloutsTab);

		expect(rolloutsTab).toHaveAttribute('aria-selected', 'true');
		expect(
			await screen.findByRole('heading', {
				name: /Create rollout|Создать выкат/,
			})
		).toBeInTheDocument();
		expect(
			screen.getByText(/Active rollout controls|Управление активными выкатами/)
		).toBeInTheDocument();
	});

	it('supports arrow-key tab navigation', async () => {
		render(<ProfessionalWorldsAdminSection />);

		const overviewTab = await screen.findByRole('tab', {
			name: /Обзор|Overview/,
		});
		fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });

		const opsTab = screen.getByRole('tab', { name: /Операции|Ops/ });
		await waitFor(() =>
			expect(opsTab).toHaveAttribute('aria-selected', 'true')
		);
		fireEvent.keyDown(opsTab, { key: 'ArrowRight' });

		await waitFor(() =>
			expect(
				screen.getByRole('tab', { name: /Профессии|Professions|Verticals/ })
			).toHaveAttribute('aria-selected', 'true')
		);
	});

	it('labels module metadata editor fields before showing technical configuration', async () => {
		render(<ProfessionalWorldsAdminSection />);

		const modulesTab = await screen.findByRole('tab', {
			name: /Модули|Modules/,
		});
		fireEvent.click(modulesTab);
		fireEvent.click(
			await screen.findByRole('button', { name: /Метаданные|Metadata/ })
		);

		expect(screen.getByText(/Module name|Название модуля/)).toBeInTheDocument();
		expect(
			screen.getByText(/Module category|Категория модуля/)
		).toBeInTheDocument();
		expect(
			screen.getAllByText(/Dependencies|Зависимости/).length
		).toBeGreaterThan(0);
		expect(
			screen.getByText(
				/Module default configuration|Конфигурация модуля по умолчанию/
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Structured details|Структурированные детали/)
		).toBeInTheDocument();
	});

	it('labels vertical schema and photo editors before structured fields', async () => {
		render(<ProfessionalWorldsAdminSection />);

		const verticalsTab = await screen.findByRole('tab', {
			name: /Профессии|Professions|Verticals/,
		});
		fireEvent.click(verticalsTab);
		expect(
			screen.getByText(/Profession name|Название профессии/)
		).toBeInTheDocument();
		expect(screen.getByText(/Icon key|Ключ иконки/)).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: /Схемы|Schemas/ }));
		expect(
			screen.getByText(/Service schema key|Служебный ключ схемы/)
		).toBeInTheDocument();
		expect(screen.getByText(/Schema title|Название схемы/)).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('tab', { name: /Фото-настройки|Photo presets/ })
		);
		expect(
			screen.getByText(/Photo setting name|Название фото-настройки/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Processing instruction|Инструкция обработки/)
		).toBeInTheDocument();
	});

	it('renders audit rows and before/after details with friendly labels', async () => {
		render(<ProfessionalWorldsAdminSection />);

		const auditTab = await screen.findByRole('tab', { name: /Аудит|Audit/ });
		fireEvent.click(auditTab);

		expect(screen.getAllByText(/Updated|Обновление/).length).toBeGreaterThan(0);
		expect(
			screen.getAllByText(
				/Photo setting · hero_cover|Фото-настройка · hero_cover/
			).length
		).toBeGreaterThan(0);
		expect(screen.getByText(/Before|До/)).toBeInTheDocument();
		expect(screen.getByText(/After|После/)).toBeInTheDocument();
	});
});
