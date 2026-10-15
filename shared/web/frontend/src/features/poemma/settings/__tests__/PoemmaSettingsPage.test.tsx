/**
 * Tests for /settings screen: org fields, threshold, JSON backup.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { PoemmaSettingsPage } from '../PoemmaSettingsPage';

describe('PoemmaSettingsPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(userId: string): Promise<void> {
		const repo = getPoemmaRepository(userId);
		await repo.initializeWorkspace({
			displayName: 'Мой бизнес',
			ownerDisplayName: 'Зоя',
		});
	}

	it('shows default experience threshold for owner', async () => {
		await seedWorkspace('user-settings-owner');

		render(
			<PoemmaSettingsPage
				ownerUserId="user-settings-owner"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Мой бизнес' })
		).toBeInTheDocument();
		expect(screen.getByLabelText('Порог опыта в процентах')).toHaveValue('5');
	});

	it('saves org profile and threshold', async () => {
		await seedWorkspace('user-settings-save');

		render(
			<PoemmaSettingsPage
				ownerUserId="user-settings-save"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		await screen.findByLabelText('Порог опыта в процентах');
		fireEvent.change(screen.getByDisplayValue('Мой бизнес'), {
			target: { value: 'Новое имя' },
		});
		fireEvent.change(screen.getByLabelText('Порог опыта в процентах'), {
			target: { value: '8' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

		await waitFor(() => {
			expect(screen.getByText('Настройки сохранены')).toBeInTheDocument();
		});

		const repo = getPoemmaRepository('user-settings-save');
		const org = await repo.getOrg();
		const settings = await repo.getOrgSettings();
		expect(org?.displayName).toBe('Новое имя');
		expect(settings?.experienceBalanceThresholdPercent).toBe(8);
	});

	it('exports backup via repository', async () => {
		await seedWorkspace('user-settings-export');
		const repo = getPoemmaRepository('user-settings-export');
		const backup = await repo.exportStorageBackup();
		expect(backup.userId).toBe('user-settings-export');
		expect(Object.keys(backup.entries).length).toBeGreaterThan(0);
	});

	it('team role sees read-only hint', async () => {
		await seedWorkspace('user-settings-team');

		render(
			<PoemmaSettingsPage
				ownerUserId="user-settings-team"
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByText(/Здесь можно посмотреть настройки/)
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Сохранить' })
		).not.toBeInTheDocument();
	});
});
