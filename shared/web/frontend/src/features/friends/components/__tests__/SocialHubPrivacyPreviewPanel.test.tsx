/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Social Hub privacy preview empty-state recovery and
 * SecureAvatar wiring (no raw authenticated download `<img src>`).
 *
 * Invariants:
 * - Empty privacy preview must stay actionable through the same React Query refetch contract.
 * - Overview identity strip routes `/api/v1/content/.../download` through SecureAvatar.
 * - Tests do not reconstruct privacy audiences client-side.
 *
 * Related:
 * - ../SocialHubPrivacyPreviewPanel.tsx
 * - @/components/profile/SecureAvatar.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';

import SocialHubPrivacyPreviewPanel from '../SocialHubPrivacyPreviewPanel';
import { fetchSocialHubPrivacyPreview } from '../../api/socialHubFeedApi';

vi.mock('../../api/socialHubFeedApi', () => ({
	fetchSocialHubPrivacyPreview: vi.fn(),
}));

const secureAvatarSpy = vi.fn();

vi.mock('@/components/profile/SecureAvatar', () => ({
	SecureAvatar: (props: { avatarUrl?: string | null; className?: string }) => {
		secureAvatarSpy(props);
		return (
			<img
				data-testid="secure-avatar"
				alt=""
				data-avatar-url={props.avatarUrl ?? ''}
				className={props.className}
			/>
		);
	},
}));

function renderPrivacyPreview(
	props: Parameters<typeof SocialHubPrivacyPreviewPanel>[0] = {}
) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<SocialHubPrivacyPreviewPanel {...props} />
		</QueryClientProvider>
	);
}

describe('SocialHubPrivacyPreviewPanel', () => {
	beforeEach(() => {
		vi.mocked(fetchSocialHubPrivacyPreview).mockReset();
		secureAvatarSpy.mockReset();
	});

	it('keeps an empty privacy preview recoverable', async () => {
		const fetchMock = vi.mocked(fetchSocialHubPrivacyPreview);
		fetchMock.mockResolvedValue(null as never);

		renderPrivacyPreview();

		expect(
			await screen.findByText(
				/Превью недоступно|No preview available|Preview unavailable/i
			)
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', { name: /Повторить|Try again|Retry/i })
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
	});

	it('uses SecureAvatar for overview identity strip content download URLs', async () => {
		vi.mocked(fetchSocialHubPrivacyPreview).mockResolvedValue({
			discoverability: 'public',
			warnings: [],
			audiences: [],
		} as never);

		const downloadPath =
			'/api/v1/content/2f1f62c9-a97f-4cfd-ad66-b895690b8e38/download';

		renderPrivacyPreview({
			variant: 'overview',
			profile: {
				id: 'u1',
				username: 'alice',
				email: 'a@example.com',
				full_name: 'Alice',
				bio: null,
				avatar_url: downloadPath,
				role: 'user',
				is_active: true,
				is_verified: true,
				preferences: {},
				created_at: '2026-01-01T00:00:00Z',
				last_login_at: null,
				login_count: 1,
			},
		});

		expect(await screen.findByTestId('secure-avatar')).toBeInTheDocument();
		expect(secureAvatarSpy).toHaveBeenCalledWith(
			expect.objectContaining({ avatarUrl: downloadPath })
		);
		expect(
			document.querySelector(`img[src="${downloadPath}"]`)
		).not.toBeInTheDocument();
	});
});
