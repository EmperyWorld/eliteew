/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Site Studio auto-fill panel user-facing copy.
 *
 * Invariants:
 * - The primary panel must describe auto-fill in product terms, not expose internal codenames.
 *
 * Related:
 * - ../components/ImperorG/ImperorGPanel.tsx
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const imperorGMock = vi.hoisted(() => ({
	state: {
		status: 'idle',
		phases: [],
		currentPhaseIndex: -1,
		errorMessage: null as string | null,
		errorMessageKey: null as string | null,
		pipelineSummary: null as Record<string, unknown> | null,
		pipelineId: null as string | null,
		isLeader: false,
		recoveryHint: null as string | null,
		recoveryHintKey: null as string | null,
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { defaultValue?: string }) =>
			(
				({
					'autofill.panelTitle': 'Автозаполнение сайта',
					'autofill.panelDescription':
						'Соберите структуру, тексты, SEO-основу, визуалы и дополнительную звуковую идею одним последовательным запуском.',
					'autofill.projectDescriptionLabel': 'Описание проекта',
					'autofill.projectDescriptionPlaceholder':
						'Опишите проект, бренд, целевую аудиторию и ключевые особенности...',
					'autofill.audioIdentity': 'Звуковая идентичность',
					'autofill.launchButton': 'Создать черновики сайта',
					'autofill.roadmapRunningBadge': 'выполняется',
					'autofill.error.otherTabRunning':
						'Генерация уже выполняется в другой вкладке браузера.',
					'autofill.recovery.lostConnection':
						'Соединение с автозаполнением потеряно.',
					'autofill.recovery.staleProgress':
						'Прошло много времени с момента последнего прогресса.',
					'autofill.recovery.streamInterrupted':
						'Соединение с автозаполнением оборвалось до финального события.',
				}) as Record<string, string>
			)[key] ??
			opts?.defaultValue ??
			key,
	}),
}));

vi.mock('../components/ImperorG/ContentStudioPicker', () => ({
	ContentStudioPicker: () => <div data-testid="content-studio-picker" />,
}));

vi.mock('../components/ImperorG/useImperorG', () => ({
	useImperorG: () => ({
		...imperorGMock.state,
		launch: vi.fn(),
		cancel: vi.fn(),
		dismissInterrupted: vi.fn(),
	}),
}));

import { ImperorGPanel } from '../components/ImperorG/ImperorGPanel';
import { ImperorGRoadmap } from '../components/ImperorG/ImperorGRoadmap';

describe('ImperorGPanel copy', () => {
	beforeEach(() => {
		Object.assign(imperorGMock.state, {
			status: 'idle',
			phases: [],
			currentPhaseIndex: -1,
			errorMessage: null,
			errorMessageKey: null,
			pipelineSummary: null,
			pipelineId: null,
			isLeader: false,
			recoveryHint: null,
			recoveryHintKey: null,
		});
	});

	it('uses user-facing auto-fill labels in the primary panel', () => {
		const { container } = render(<ImperorGPanel />);

		expect(screen.getByText('Автозаполнение сайта')).toBeInTheDocument();
		expect(screen.getByText('Описание проекта')).toBeInTheDocument();
		expect(screen.getByText('Создать черновики сайта')).toBeInTheDocument();
		expect(container.textContent ?? '').not.toMatch(
			/ImperorG|AI-пайплайн|шедевр/
		);
	});

	it('localizes the roadmap running badge', () => {
		render(
			<ImperorGRoadmap
				currentPhaseIndex={0}
				phases={[
					{
						id: 'collect',
						label: 'Сбор контекста',
						icon: 'search',
						status: 'running',
						steps: [],
					},
				]}
			/>
		);

		expect(screen.getByText('выполняется')).toBeInTheDocument();
		expect(screen.getByText('Сбор контекста')).toBeInTheDocument();
	});

	it('localizes built-in runner error keys', () => {
		Object.assign(imperorGMock.state, {
			status: 'error',
			errorMessageKey: 'autofill.error.otherTabRunning',
		});

		render(<ImperorGPanel />);

		expect(
			screen.getByText('Генерация уже выполняется в другой вкладке браузера.')
		).toBeInTheDocument();
	});

	it('localizes built-in runner recovery keys', () => {
		Object.assign(imperorGMock.state, {
			status: 'interrupted',
			recoveryHintKey: 'autofill.recovery.streamInterrupted',
		});

		render(<ImperorGPanel />);

		expect(
			screen.getByText(
				'Соединение с автозаполнением оборвалось до финального события.'
			)
		).toBeInTheDocument();
	});
});
