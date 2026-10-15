import { describe, expect, it } from 'vitest';
import {
	appStoreCatalogCardActionClass,
	appStoreCatalogInstallErrorPanelClass,
	appStoreCompactCardTitleClass,
	appStoreDetailCollapsiblePanelClass,
	appStoreDetailErrorPanelClass,
	appStoreDetailInsetPanelClass,
	appStoreDetailLoadingBodyFrameClass,
	appStoreFactoryBadgeClass,
	appStoreHorizontalScrollListClass,
	appStoreInstalledBadgeClass,
	appStoreInstallStatusBarClass,
	appStoreModalTitleClass,
	appStoreNavTitleClass,
	appStoreNewBadgeClass,
	appStorePageHeaderTitleClass,
	appStorePremiumHeroLeadClass,
	appStoreRailOverlineLabelBlockClass,
	appStoreSectionHeadingClass,
	appStoreShortcutBadgeClass,
	appStoreShellDetailSuspenseHeroClass,
	appStoreWalletBalanceClass,
} from '../appStoreCompactCardUi';

describe('appStoreCompactCardUi', () => {
	it('exports shared compact card classes', () => {
		expect(appStoreCompactCardTitleClass).toContain('truncate');
		expect(appStoreHorizontalScrollListClass).toContain('snap-x');
		expect(appStoreCatalogCardActionClass).toContain('h-8');
	});

	it('exports shared status badge classes', () => {
		expect(appStoreInstalledBadgeClass).toContain('rgb(16_185_129)');
		expect(appStoreNewBadgeClass).toContain('rgb(59_130_246)');
		expect(appStoreFactoryBadgeClass).toContain('rgb(234_179_8)');
	});

	it('exports shared shell typography classes', () => {
		expect(appStoreNavTitleClass).toContain('tracking-tight');
		expect(appStoreSectionHeadingClass).toContain('tracking-[-0.02em]');
		expect(appStorePageHeaderTitleClass).toContain('md:text-base');
		expect(appStorePremiumHeroLeadClass).toContain('md:text-[15px]');
	});

	it('exports detail panel and badge classes', () => {
		expect(appStoreDetailErrorPanelClass).toContain('rgb(248_113_113)');
		expect(appStoreCatalogInstallErrorPanelClass).toContain('rounded-lg');
		expect(appStoreShortcutBadgeClass).toContain('rgb(59_130_246)');
		expect(appStoreModalTitleClass).toContain('md:text-xl');
	});

	it('exports rail and status bar classes', () => {
		expect(appStoreRailOverlineLabelBlockClass).toContain('mb-2');
		expect(appStoreRailOverlineLabelBlockClass).not.toMatch(/\buppercase\b/);
		expect(appStoreRailOverlineLabelBlockClass).toMatch(/tracking-normal/);
		expect(appStoreInstallStatusBarClass).toContain('border-l-[3px]');
		expect(appStoreWalletBalanceClass).toContain('tabular-nums');
	});

	it('exports detail layout panel classes', () => {
		expect(appStoreDetailInsetPanelClass).toContain(
			'bg-(--as-premium-panel-bg)'
		);
		expect(appStoreDetailCollapsiblePanelClass).toContain(
			'[&_summary::-webkit-details-marker]:hidden'
		);
		expect(appStoreDetailLoadingBodyFrameClass).toContain('rounded-xl');
		expect(appStoreShellDetailSuspenseHeroClass).toContain(
			'rounded-(--desktop-radius-frame)'
		);
	});
});
