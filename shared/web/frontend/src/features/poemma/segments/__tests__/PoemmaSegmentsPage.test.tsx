/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for /segments screen: owner edit, share warning, ACL (P-605).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPoemmaRepository } from '../../poemmaRepository';
import { PoemmaSegmentsPage } from '../PoemmaSegmentsPage';

describe('PoemmaSegmentsPage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	async function seedWorkspace(userId: string): Promise<string> {
		const repo = getPoemmaRepository(userId);
		const workspace = await repo.initializeWorkspace({
			displayName: 'Тест',
			ownerDisplayName: 'Зоя',
		});
		await repo.saveSegments(workspace.org.id, [
			{
				id: 'seg-1',
				orgId: workspace.org.id,
				name: 'Локальные',
				sharePercent: 40,
				note: 'центр',
			},
			{
				id: 'seg-2',
				orgId: workspace.org.id,
				name: 'Туристы',
				sharePercent: 30,
			},
			{
				id: 'seg-3',
				orgId: workspace.org.id,
				name: 'B2B сети',
				sharePercent: 20,
			},
			{
				id: 'seg-4',
				orgId: workspace.org.id,
				name: 'Прочие',
				sharePercent: 5,
			},
		]);
		return workspace.org.id;
	}

	it('denies non-owner roles', async () => {
		render(
			<PoemmaSegmentsPage
				ownerUserId="user-segments-team"
				userRole="team"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByText('Только для собственника')
		).toBeInTheDocument();
	});

	it('shows share sum warning when total is not 100', async () => {
		await seedWorkspace('user-segments-warn');

		render(
			<PoemmaSegmentsPage
				ownerUserId="user-segments-warn"
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		expect(
			await screen.findByRole('heading', { name: 'Кто покупает' })
		).toBeInTheDocument();
		expect(screen.getByText('Сумма 95%')).toBeInTheDocument();
		expect(
			screen.getByText('Доли сегментов должны в сумме давать 100%.')
		).toBeInTheDocument();
	});

	it('persists segment edits for owner', async () => {
		const userId = 'user-segments-save';
		const orgId = await seedWorkspace(userId);
		const repo = getPoemmaRepository(userId);

		render(
			<PoemmaSegmentsPage
				ownerUserId={userId}
				userRole="owner"
				onNavigate={vi.fn()}
			/>
		);

		const note = await screen.findByLabelText('Заметка сегмента 1');
		fireEvent.change(note, { target: { value: 'Лэтуаль' } });

		const share = screen.getByLabelText('Доля сегмента 4');
		fireEvent.change(share, { target: { value: '10' } });

		fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

		await waitFor(() => {
			expect(screen.getByText('Сегменты сохранены')).toBeInTheDocument();
		});

		const saved = await repo.listSegments(orgId);
		expect(saved.find((segment) => segment.id === 'seg-1')?.note).toBe(
			'Лэтуаль'
		);
		expect(saved.find((segment) => segment.id === 'seg-4')?.sharePercent).toBe(
			10
		);
	});

	it('navigates back to home', async () => {
		await seedWorkspace('user-segments-nav');
		const onNavigate = vi.fn();

		render(
			<PoemmaSegmentsPage
				ownerUserId="user-segments-nav"
				userRole="owner"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '← Карта' }));
		expect(onNavigate).toHaveBeenCalledWith('/');
	});
});
