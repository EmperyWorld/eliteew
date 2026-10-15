/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Learning workspace tab intro leads.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import type { ProfessionalLearningCourse } from '../types';
import { LearningWorkspacePanel } from './LearningWorkspacePanel';

vi.mock('../components/ProfessionalLearningCoursesPanel', () => ({
	ProfessionalLearningCoursesPanel: () => (
		<div data-testid="learning-courses-stub">Courses</div>
	),
}));

const sampleCourses = [
	{
		id: 'c1',
		course_key: 'basics',
		vertical_slug: 'realtor',
		title: 'Basics',
		description: null,
		level: 'starter',
		sort_order: 1,
		lessons: [
			{
				id: 'l1',
				lesson_key: 'lesson-1',
				title: 'Lesson 1',
				summary: null,
				content_md: 'Hello',
				exercise: {},
				sort_order: 1,
				completed: true,
			},
			{
				id: 'l2',
				lesson_key: 'lesson-2',
				title: 'Lesson 2',
				summary: null,
				content_md: 'World',
				exercise: {},
				sort_order: 2,
				completed: false,
			},
		],
	},
] satisfies ProfessionalLearningCourse[];

let pwI18n: i18n;

beforeAll(async () => {
	pwI18n = i18next.createInstance();
	await pwI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		interpolation: { escapeValue: false },
		resources: {
			en: { [PROFESSIONAL_WORLDS_NS]: enProfessionalWorlds },
		},
		ns: [PROFESSIONAL_WORLDS_NS],
		defaultNS: PROFESSIONAL_WORLDS_NS,
	});
});

describe('LearningWorkspacePanel', () => {
	it('shows learning hero and progress summary on courses tab', () => {
		render(
			<I18nextProvider i18n={pwI18n}>
				<LearningWorkspacePanel
					courses={sampleCourses}
					onCompleteLesson={vi.fn()}
					onStartCoach={vi.fn()}
				/>
			</I18nextProvider>
		);
		expect(
			screen.getByText(/Continue your profession program/i)
		).toBeInTheDocument();
		expect(screen.getByText('1 of 2 lessons completed.')).toBeInTheDocument();
		expect(screen.getByText(/Practice only/i)).toBeInTheDocument();
	});

	it('shows coach hero primary on coach tab', () => {
		render(
			<I18nextProvider i18n={pwI18n}>
				<LearningWorkspacePanel
					courses={[]}
					onCompleteLesson={vi.fn()}
					onStartCoach={vi.fn()}
				/>
			</I18nextProvider>
		);
		fireEvent.click(screen.getByRole('tab', { name: 'Practice coach' }));
		expect(
			screen.getByText(/Your learning plan will appear here/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Start practice' })
		).toBeInTheDocument();
	});
});
