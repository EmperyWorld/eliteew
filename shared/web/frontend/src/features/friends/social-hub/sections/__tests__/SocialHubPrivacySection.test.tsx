/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey lock for Profile Home: primary CTA opens visibility sheet; home widgets mount.
 *
 * Invariants:
 * - Profile Home is the default surface (data-testid=profile-home).
 * - Configure-visibility CTA opens premium privacy editor sheet (not peer UserProfile).
 * - Identity edit opens identity sheet; activity opens activity sheet.
 *
 * Related:
 * - ../SocialHubPrivacySection.tsx
 * - ../../profile-home/ProfileHome.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';

import { fetchSocialHubPrivacyPreview } from '../../../api/socialHubFeedApi';
import SocialHubPrivacySection from '../SocialHubPrivacySection';

vi.mock('../../../api/socialHubFeedApi', () => ({
	fetchSocialHubPrivacyPreview: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({ checkAuthentication: vi.fn() }),
}));

vi.mock('@/services/profileService', () => ({
	default: {
		getProfile: vi.fn().mockResolvedValue({
			id: 'u1',
			username: 'alice',
			email: 'a@example.com',
			full_name: 'Alice',
			bio: 'Hello from home',
			avatar_url: null,
			role: 'user',
			is_active: true,
			is_verified: true,
			preferences: {},
			created_at: '2026-01-01T00:00:00Z',
			last_login_at: '2026-07-01T00:00:00Z',
			login_count: 3,
		}),
		getStatistics: vi.fn().mockResolvedValue({
			account_age_days: 10,
			total_logins: 3,
			last_login: '2026-07-01T00:00:00Z',
			total_chat_sessions: 0,
			total_chat_messages: 0,
			total_chat_tokens: 0,
			total_ai_generations: 0,
			completed_ai_generations: 0,
			failed_ai_generations: 0,
			ai_success_rate: 0,
			total_content_items: 2,
			storage_used_bytes: 0,
			storage_used_mb: 1,
			storage_quota_mb: 100,
		}),
		getActivityLog: vi.fn().mockResolvedValue({
			activities: [
				{
					id: 'a1',
					action: 'login',
					description: 'Signed in',
					ip_address: null,
					user_agent: null,
					metadata: {},
					created_at: '2026-07-01T00:00:00Z',
				},
			],
			total: 1,
			page: 1,
			per_page: 3,
			total_pages: 1,
		}),
	},
}));

vi.mock('@/components/profile/ProfilePrivacySection', () => ({
	default: () => <div data-testid="privacy-editor">privacy-editor</div>,
}));

vi.mock('@/components/profile/ProfileIdentityPanel', () => ({
	default: () => <div data-testid="identity-editor">identity-editor</div>,
}));

vi.mock('@/components/profile/ProfileActivityPanel', () => ({
	default: () => <div data-testid="activity-editor">activity-editor</div>,
}));

vi.mock('@/components/profile/ProfilePasswordResetSection', () => ({
	default: () => <div data-testid="password-reset">password-reset</div>,
}));

function renderSection() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<SocialHubPrivacySection />
		</QueryClientProvider>
	);
}

describe('SocialHubPrivacySection Profile Home', () => {
	beforeEach(() => {
		vi.mocked(fetchSocialHubPrivacyPreview).mockResolvedValue({
			discoverability: 'public',
			warnings: [],
			fields: {
				avatar: { visibility: 'everyone', circle_id: null },
				full_name: { visibility: 'friends_only', circle_id: null },
				bio: { visibility: 'none', circle_id: null },
			},
			audiences: [
				{
					id: 'everyone',
					label: 'Everyone',
					visible_fields: ['avatar'],
					people_count: null,
				},
			],
		} as never);
	});

	it('renders interactive Profile Home with identity and privacy board', async () => {
		renderSection();

		expect(await screen.findByTestId('profile-home')).toBeInTheDocument();
		expect(await screen.findByText('Alice')).toBeInTheDocument();
		expect(await screen.findByText('Hello from home')).toBeInTheDocument();
		expect(
			await screen.findByRole('heading', {
				name: /Кто вас видит|Who can see you/i,
			})
		).toBeInTheDocument();
		expect(
			await screen.findByRole('button', {
				name: /Настроить видимость|Configure visibility/i,
			})
		).toBeInTheDocument();
	});

	it('opens visibility sheet from primary CTA and returns to Home', async () => {
		renderSection();

		const cta = await screen.findByRole('button', {
			name: /Настроить видимость|Configure visibility/i,
		});
		fireEvent.click(cta);

		await waitFor(() => {
			expect(screen.getByTestId('privacy-editor')).toBeInTheDocument();
		});
		expect(screen.queryByTestId('profile-home')).not.toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', { name: /К профилю|Back to profile/i })
		);

		expect(await screen.findByTestId('profile-home')).toBeInTheDocument();
	});

	it('opens identity sheet from edit profile', async () => {
		renderSection();

		fireEvent.click(
			await screen.findByRole('button', {
				name: /Изменить профиль|Edit profile/i,
			})
		);

		await waitFor(() => {
			expect(screen.getByTestId('identity-editor')).toBeInTheDocument();
		});
	});

	it('opens activity sheet from pulse', async () => {
		renderSection();

		fireEvent.click(
			await screen.findByRole('button', {
				name: /Вся активность|All activity/i,
			})
		);

		await waitFor(() => {
			expect(screen.getByTestId('activity-editor')).toBeInTheDocument();
		});
	});
});
