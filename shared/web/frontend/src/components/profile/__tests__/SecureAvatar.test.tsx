/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for SecureAvatar strict-origin boundary — block external avatar URLs.
 *
 * Invariants:
 * - Gravatar/external URLs render bundled placeholder, never external `<img src>`.
 * - Valid `/api/v1/content/.../download` loads via authenticated blob helper.
 *
 * Related:
 * - src/components/profile/SecureAvatar.tsx
 * - src/utils/avatarUrlGuard.ts
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_AVATAR_PLACEHOLDER_SRC } from '../defaultAvatarPlaceholder';
import { SecureAvatar } from '../SecureAvatar';

const getAvatarDownloadObjectUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/profileService', () => ({
	default: {
		getAvatar: vi.fn(),
		getAvatarDownloadObjectUrl: getAvatarDownloadObjectUrlMock,
	},
}));

describe('SecureAvatar', () => {
	beforeEach(() => {
		getAvatarDownloadObjectUrlMock.mockReset();
	});

	it('falls back to bundled placeholder for external Gravatar URL', () => {
		render(
			<SecureAvatar
				avatarUrl="https://www.gravatar.com/avatar/abc123?s=200&d=identicon"
				alt="User"
			/>
		);

		const img = screen.getByRole('img', { name: 'User' });
		expect(img).toHaveAttribute('src', DEFAULT_AVATAR_PLACEHOLDER_SRC);
		expect(img.getAttribute('src')).not.toContain('gravatar.com');
		expect(getAvatarDownloadObjectUrlMock).not.toHaveBeenCalled();
	});

	it('loads trusted /api/v1/content download via blob helper', async () => {
		const blobUrl = 'blob:http://localhost/fake-avatar';
		getAvatarDownloadObjectUrlMock.mockResolvedValue(blobUrl);

		render(
			<SecureAvatar
				avatarUrl="/api/v1/content/content-uuid/download"
				alt="Profile"
			/>
		);

		await waitFor(() => {
			expect(getAvatarDownloadObjectUrlMock).toHaveBeenCalledWith(
				'/api/v1/content/content-uuid/download'
			);
		});

		const img = await screen.findByRole('img', { name: 'Profile' });
		expect(img).toHaveAttribute('src', blobUrl);
	});

	it('loads /api/v1/profile/avatar download path via blob helper', async () => {
		const blobUrl = 'blob:http://localhost/profile-avatar';
		getAvatarDownloadObjectUrlMock.mockResolvedValue(blobUrl);

		render(
			<SecureAvatar avatarUrl="/api/v1/profile/avatar" alt="Profile avatar" />
		);

		await waitFor(() => {
			expect(getAvatarDownloadObjectUrlMock).toHaveBeenCalledWith(
				'/api/v1/profile/avatar'
			);
		});

		const img = await screen.findByRole('img', { name: 'Profile avatar' });
		expect(img).toHaveAttribute('src', blobUrl);
	});

	it('uses contentId for API download when provided', async () => {
		const blobUrl = 'blob:http://localhost/content-id-avatar';
		getAvatarDownloadObjectUrlMock.mockResolvedValue(blobUrl);

		render(
			<SecureAvatar contentId="content-uuid" alt="Avatar" avatarUrl={null} />
		);

		await waitFor(() => {
			expect(getAvatarDownloadObjectUrlMock).toHaveBeenCalledWith(
				'/api/v1/content/content-uuid/download'
			);
		});

		const img = await screen.findByRole('img', { name: 'Avatar' });
		expect(img).toHaveAttribute('src', blobUrl);
	});
});
