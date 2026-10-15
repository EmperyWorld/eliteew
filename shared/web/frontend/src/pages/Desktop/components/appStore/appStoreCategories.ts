/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Category metadata and label helpers for the App Store catalog sidebar and sections.
 *
 * Invariants:
 * - Category ids align with backend store app `category` field and i18n `appStore.categories.*`.
 *
 * Related:
 * - AppStore.tsx, AppStoreCategoryJumpNav.tsx
 */

import {
	ChartBarSquareIcon,
	ChatBubbleLeftRightIcon,
	CodeBracketIcon,
	Cog6ToothIcon,
	HomeIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { StoreCategoryDef } from './appStoreCatalogTypes';

export function buildStoreCategories(
	t: TFunction<'appStore'>
): StoreCategoryDef[] {
	return [
		{
			id: 'communication',
			name: t('categories.communication'),
			icon: ChatBubbleLeftRightIcon,
		},
		{
			id: 'productivity',
			name: t('categories.productivity'),
			icon: ChartBarSquareIcon,
		},
		{ id: 'widgets', name: t('categories.widgets'), icon: Squares2X2Icon },
		{ id: 'home', name: t('categories.home'), icon: HomeIcon },
		{ id: 'developer', name: t('categories.developer'), icon: CodeBracketIcon },
		{ id: 'system', name: t('categories.system'), icon: Cog6ToothIcon },
	];
}

export function categoryLabel(
	categoryId: string,
	t: TFunction<'appStore'>
): string {
	const k = `categories.${categoryId}`;
	const v = t(k);
	return v === k ? categoryId : v;
}

export function storeSectionIcon(
	categoryId: string,
	categories: StoreCategoryDef[]
) {
	return categories.find((c) => c.id === categoryId)?.icon ?? Squares2X2Icon;
}
