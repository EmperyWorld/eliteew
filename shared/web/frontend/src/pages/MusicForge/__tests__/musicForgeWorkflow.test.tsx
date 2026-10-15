/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for MusicForge workflow terminal states and error surfacing.
 *
 * Invariants:
 * - Failed/cancelled runs always show user-facing outcome copy.
 *
 * Related:
 * - src/pages/MusicForge/MusicForgeWorkflow.tsx
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MusicForgeRun } from '@/services/musicForge/musicForgeApi';
import { MusicForgeWorkflow } from '../MusicForgeWorkflow';
import { renderMusicForge } from '../musicForgeTestI18n';

function baseRun(overrides: Partial<MusicForgeRun> = {}): MusicForgeRun {
	return {
		id: 'run-1',
		status: 'failed',
		idea: 'test idea',
		language: 'ru',
		duration_seconds: 120,
		progress_current: 2,
		progress_total: 8,
		normalized_input: {},
		song_blueprint: {},
		lyrics_payload: {},
		style_capsule: {},
		render_payload: {},
		result_payload: {},
		error_payload: {},
		created_at: '2026-06-30T00:00:00Z',
		updated_at: '2026-06-30T00:00:00Z',
		steps: [
			{
				step_index: 1,
				step_kind: 'intent',
				title: 'Идея',
				status: 'completed',
				input_payload: {},
				output_payload: {},
				error_payload: {},
			},
			{
				step_index: 2,
				step_kind: 'render',
				title: 'Рендер',
				status: 'failed',
				input_payload: {},
				output_payload: {},
				error_payload: { message: 'Не удалось собрать аудио' },
			},
		],
		...overrides,
	};
}

describe('MusicForgeWorkflow', () => {
	it('renders failed terminal banner with backend message', () => {
		renderMusicForge(
			<MusicForgeWorkflow
				run={baseRun({
					error_payload: { message: 'Сервис генерации недоступен' },
				})}
			/>
		);
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Сервис генерации недоступен'
		);
		expect(screen.getByText('Генерация не завершилась')).toBeInTheDocument();
	});

	it('renders cancelled banner with fallback when message missing', () => {
		renderMusicForge(
			<MusicForgeWorkflow run={baseRun({ status: 'cancelled' })} />
		);
		expect(screen.getByText('Генерация отменена')).toBeInTheDocument();
		expect(
			screen.getByText(/Создание песни остановлено|остановлено/i)
		).toBeInTheDocument();
	});

	it('shows step error on failed step card', () => {
		renderMusicForge(<MusicForgeWorkflow run={baseRun()} />);
		expect(screen.getByText('Не удалось собрать аудио')).toBeInTheDocument();
	});

	it('invokes retry and new song actions', () => {
		const onRetry = vi.fn();
		const onNewSong = vi.fn();
		renderMusicForge(
			<MusicForgeWorkflow
				run={baseRun()}
				canRetry
				onRetry={onRetry}
				onNewSong={onNewSong}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: /Повторить генерацию/i })
		);
		fireEvent.click(screen.getByRole('button', { name: /Новая песня/i }));
		expect(onRetry).toHaveBeenCalledOnce();
		expect(onNewSong).toHaveBeenCalledOnce();
	});

	it('shows monitor error banner separately from workflow', () => {
		renderMusicForge(
			<MusicForgeWorkflow
				run={baseRun({ status: 'running' })}
				monitorError="Нет сети"
			/>
		);
		expect(screen.getByText('Нет сети')).toBeInTheDocument();
	});

	it('shows honest note when lyrics gate auto-rewrote text', () => {
		renderMusicForge(
			<MusicForgeWorkflow
				run={baseRun({
					status: 'running',
					steps: [
						{
							step_index: 1,
							step_kind: 'lyrics_gate',
							title: 'Проверка текста',
							status: 'completed',
							input_payload: {},
							output_payload: {
								retried: true,
								retry_resolved: true,
							},
							error_payload: {},
						},
					],
				})}
			/>
		);
		expect(
			screen.getByText(/переписали его перед рендером/i)
		).toBeInTheDocument();
	});

	it('collapses step grid when compact and completed', () => {
		renderMusicForge(
			<MusicForgeWorkflow
				compact
				run={baseRun({
					status: 'completed',
					steps: [
						{
							step_index: 1,
							step_kind: 'intent',
							title: 'Идея',
							status: 'completed',
							input_payload: {},
							output_payload: {},
							error_payload: {},
						},
					],
				})}
			/>
		);
		expect(screen.getByText(/Песня готова — 1 шаг/i)).toBeInTheDocument();
		expect(screen.getByText('Показать шаги создания')).toBeInTheDocument();
		expect(screen.getByText('Идея')).not.toBeVisible();
		fireEvent.click(screen.getByText('Показать шаги создания'));
		expect(screen.getByText('Идея')).toBeVisible();
	});
});
