/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock: UnifiedAdminPage mounts for every ADMIN_SHELL_SECTIONS id and swaps on nav click.
 *
 * Invariants:
 * - Lazy section bodies are stubbed; system stays inline and must show status chrome.
 * - Auth gate passes with role `admin`; URL/last-section restore disabled so `initialSection` wins.
 *
 * Related:
 * - pages/Admin/UnifiedAdminPage.tsx
 * - pages/Admin/shell/adminShellConfig.ts
 * - pages/Admin/shell/AdminSectionLazy.tsx
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_SHELL_SECTIONS } from '../shell/adminShellConfig';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('../../../contexts/AuthContext', () => ({
	useAuth: () => ({
		user: { role: 'admin', email: 'admin@example.test' },
		isAuthenticated: true,
		loading: false,
	}),
}));

vi.mock('../../../utils/ugsAdminAccess', () => ({
	isUgsAdminAuthorized: ({
		isAuthenticated,
		loading,
	}: {
		isAuthenticated?: boolean;
		loading?: boolean;
	}) => !loading && Boolean(isAuthenticated),
}));

vi.mock('../shell/useAdminShellNavBadges', () => ({
	useAdminShellNavBadges: () => ({
		feedbackOpen: null,
		socialReportsOpen: null,
		usersOnline: null,
	}),
}));

vi.mock('../shell/adminShellUrl', () => ({
	readAdminSectionFromUrl: () => null,
	syncAdminShellSectionToUrl: vi.fn(),
}));

vi.mock('../shell/adminShellLastSection', () => ({
	loadEmbeddedAdminSection: () => null,
	loadLastAdminSection: () => null,
	saveEmbeddedAdminSection: vi.fn(),
	saveLastAdminSection: vi.fn(),
}));

vi.mock('../desktopAiChat/desktopAiChatAdminUrl', () => ({
	migrateLegacyDesktopAiChatAdminShellUrl: vi.fn(),
}));

vi.mock('../shell/ugsAdminShellUrl', () => ({
	migrateLegacyUgsAdminShellUrl: vi.fn(),
}));

vi.mock('../shell/AdminCommandPalette', () => ({
	AdminCommandPalette: () => null,
}));

vi.mock('../shell/adminShellSectionSelectApi', () => ({
	reportAdminShellSectionSelect: vi.fn(),
}));

vi.mock('../../../services/systemHealth', () => ({
	fetchApiDatabaseStatus: vi.fn(async () => ({ api: 'ok', db: 'ok' })),
}));

vi.mock('../../../services/admin/api', () => ({
	adminApi: {
		cleanupCache: vi.fn(async () => undefined),
	},
}));

vi.mock('../shell/AdminSectionLazy', async () => {
	const React = await import('react');
	const stub = (id: string) => {
		function LazyStub() {
			return React.createElement('div', {
				'data-testid': `admin-lazy-${id}`,
			});
		}
		LazyStub.displayName = `AdminLazyStub_${id}`;
		return LazyStub;
	};
	return {
		LazyAdminUsersHubSection: stub('users'),
		LazyDesktopAppStoreAdminPage: stub('desktop'),
		LazyProfessionalWorldsAdminSection: stub('professionalWorlds'),
		LazyUGSAdminV2Panel: stub('ugsV2'),
		LazyFeedbackAdminSection: stub('feedback'),
		LazySocialReportsAdminSection: stub('socialReports'),
		LazySurveysAdminSection: stub('surveys'),
		LazyAssistantAdminSection: stub('assistant'),
		LazyEwDeskAdminSection: stub('ewdesk'),
		LazyEwaCompanionAdminPanel: stub('ewaCompanion'),
		LazySiteManagerOpsPanel: stub('siteStudio'),
		LazyDocEditorPluginsAdminSection: stub('docEditor'),
		LazySystemGafInstructionSection: stub('gaf'),
		LazyI18nRewriteAdminSection: stub('i18nRewrite'),
		LazySearchAdminSection: stub('search'),
		LazyMusicForgeAdminSection: stub('musicForge'),
		LazyContentAdminSection: stub('content'),
		LazyKbsewAdminSection: stub('kbsew'),
		LazyDesktopAiChatAdminSection: stub('desktopAiChat'),
		LazyWorkersAdminSection: stub('workers'),
		LazyPlatformOpsAdminSection: stub('platformOps'),
		LazyTopologyAdminSection: stub('topology'),
		LazyFactoryAdminSection: stub('factory'),
	};
});

import { UnifiedAdminPage } from '../UnifiedAdminPage';

describe('UnifiedAdminPage section matrix', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			configurable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	afterEach(() => {
		cleanup();
	});

	it.each(ADMIN_SHELL_SECTIONS.map((s) => s.id))(
		'mounts shell for section=%s without throw',
		async (sectionId) => {
			render(<UnifiedAdminPage initialSection={sectionId} />);

			expect(document.querySelector('.eliteew-admin-shell')).toBeTruthy();

			const byData = document.querySelector(
				`[data-nav-section="${sectionId}"]`
			);
			expect(byData).toBeTruthy();
			expect(byData?.getAttribute('aria-current')).toBe('page');

			if (sectionId === 'system') {
				expect(await screen.findByText('adminSystem.statusLabel')).toBeTruthy();
			} else {
				expect(
					await screen.findByTestId(`admin-lazy-${sectionId}`)
				).toBeTruthy();
			}
		}
	);

	it('swaps active section on sidebar click (users → workers)', async () => {
		const user = userEvent.setup();
		render(<UnifiedAdminPage initialSection="users" />);

		expect(
			document
				.querySelector('[data-nav-section="users"]')
				?.getAttribute('aria-current')
		).toBe('page');
		expect(await screen.findByTestId('admin-lazy-users')).toBeTruthy();

		const workersNav = document.querySelector('[data-nav-section="workers"]');
		expect(workersNav).toBeTruthy();
		await user.click(workersNav as HTMLElement);

		await waitFor(() => {
			expect(
				document
					.querySelector('[data-nav-section="workers"]')
					?.getAttribute('aria-current')
			).toBe('page');
		});
		expect(await screen.findByTestId('admin-lazy-workers')).toBeTruthy();
		expect(screen.queryByTestId('admin-lazy-users')).toBeNull();
	});
});
