/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vertical-aware dashboard metrics for Professional Worlds Overview workspace.
 *
 * Invariants:
 * - Realtor vertical uses full listing-aware metrics; other verticals use CRM-lite counts only.
 *
 * Related:
 * - realtorLogic.ts
 * - OverviewWorkspacePanel.tsx
 */

import {
	buildRealtorDashboardMetrics,
	type RealtorDashboardMetrics,
} from './realtorLogic';
import type {
	ProfessionalArtifact,
	ProfessionalClient,
	ProfessionalDeal,
	ProfessionalLearningCourse,
	RealtorProperty,
	SpecialistProfile,
} from './types';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';

export type VerticalDashboardMetrics = RealtorDashboardMetrics;

export function buildVerticalDashboardMetrics(input: {
	verticalSlug: string;
	profile: SpecialistProfile | null;
	properties: RealtorProperty[];
	clients: ProfessionalClient[];
	deals: ProfessionalDeal[];
	courses: ProfessionalLearningCourse[];
	artifacts: ProfessionalArtifact[];
}): VerticalDashboardMetrics {
	if (input.verticalSlug === PROFESSIONAL_WORLDS_VERTICAL_REALTOR) {
		return buildRealtorDashboardMetrics(input);
	}
	const learningTotal = input.courses.reduce(
		(total, course) => total + (course.lessons ?? []).length,
		0
	);
	const learningCompleted = input.courses.reduce(
		(total, course) =>
			total +
			(course.lessons ?? []).filter((lesson) => lesson.completed).length,
		0
	);
	return {
		propertiesTotal: 0,
		activeClients: input.clients.filter(
			(client) => client.status !== 'archived'
		).length,
		openDeals: input.deals.filter((deal) => deal.stage !== 'closed').length,
		artifactsTotal: input.artifacts.length,
		learningCompleted,
		learningTotal,
		profileReady:
			input.profile?.vertical_slug === input.verticalSlug &&
			Boolean(input.profile.display_name?.trim()),
	};
}
