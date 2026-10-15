/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Localized enum select options and CSV header rows for MarketingCabinetPage forms.
 *
 * Invariants:
 * - Option values match backend/marketing enum contracts; labels come from i18n only.
 *
 * Related:
 * - MarketingCabinetPage.tsx, marketingCabinetPageTypes.ts
 */

import { useMemo } from 'react';
import type { TFunction } from 'i18next';

export function useMarketingCabinetFormSelectOptions(
	t: TFunction<'marketing'>
) {
	const companySizeSelectOptions = useMemo(
		() =>
			(['startup', 'small', 'medium', 'large', 'enterprise'] as const).map(
				(value) => ({
					value,
					label: t(`enums.companySize.${value}`),
				})
			),
		[t]
	);

	const projectCategorySelectOptions = useMemo(
		() =>
			(
				[
					'marketing_campaign',
					'market_research',
					'competitive_analysis',
					'product_development',
					'business_transformation',
					'other',
				] as const
			).map((value) => ({
				value,
				label: t(`enums.projectCategory.${value}`),
			})),
		[t]
	);

	const projectFormPriorityOptions = useMemo(
		() =>
			(['low', 'medium', 'high', 'urgent'] as const).map((value) => ({
				value,
				label: t(`enums.priority.${value}`),
			})),
		[t]
	);

	const projectTeamRoleInviteOptions = useMemo(
		() =>
			(['admin', 'editor', 'member', 'viewer'] as const).map((value) => ({
				value,
				label: t(`cabinetPage.setup.teamRole.${value}`),
			})),
		[t]
	);

	const jobStoryCategorySelectOptions = useMemo(
		() =>
			(['functional', 'emotional', 'social', 'hybrid'] as const).map(
				(value) => ({
					value,
					label: t(`enums.jobCategory.${value}`),
				})
			),
		[t]
	);

	const jobStoryPrioritySelectOptions = useMemo(
		() =>
			(['low', 'medium', 'high', 'critical'] as const).map((value) => ({
				value,
				label: t(`enums.priority.${value}`),
			})),
		[t]
	);

	const competitorTypeSelectOptions = useMemo(
		() =>
			(['direct', 'indirect', 'adjacent', 'replacement'] as const).map(
				(value) => ({
					value,
					label: t(`enums.competitorType.${value}`),
				})
			),
		[t]
	);

	const valuePropInlineStatusOptions = useMemo(
		() =>
			(['draft', 'testing', 'active', 'paused', 'archived'] as const).map(
				(value) => ({
					value,
					label: t(`enums.status.${value}`),
				})
			),
		[t]
	);

	const csvJtbdHeaderRow = useMemo(
		() => t('cabinetPage.csvJtbdHeaders', { returnObjects: true }) as string[],
		[t]
	);
	const csvSwotHeaderRow = useMemo(
		() => t('cabinetPage.csvSwotHeaders', { returnObjects: true }) as string[],
		[t]
	);
	const csvResearchHeaderRow = useMemo(
		() =>
			t('cabinetPage.csvResearchHeaders', { returnObjects: true }) as string[],
		[t]
	);
	const csvValuePropHeaderRow = useMemo(
		() =>
			t('cabinetPage.csvValuePropHeaders', { returnObjects: true }) as string[],
		[t]
	);
	const csvCompetitorHeaderRow = useMemo(
		() =>
			t('cabinetPage.csvCompetitorHeaders', {
				returnObjects: true,
			}) as string[],
		[t]
	);

	return {
		companySizeSelectOptions,
		projectCategorySelectOptions,
		projectFormPriorityOptions,
		projectTeamRoleInviteOptions,
		jobStoryCategorySelectOptions,
		jobStoryPrioritySelectOptions,
		competitorTypeSelectOptions,
		valuePropInlineStatusOptions,
		csvJtbdHeaderRow,
		csvSwotHeaderRow,
		csvResearchHeaderRow,
		csvValuePropHeaderRow,
		csvCompetitorHeaderRow,
	};
}
