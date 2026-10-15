/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for shared Social Hub layout tokens and badge helpers.
 *
 * Invariants:
 * - Token strings stay stable enough for regression snapshots in UI polish waves.
 *
 * Related:
 * - ../socialHubLayoutTokens.ts
 */

import { describe, expect, it } from 'vitest';

import {
	SH_DIRECTORY_METRIC_ROW_CLASS,
	SH_FEED_EVENT_BADGE_CLASS,
	SH_FEED_TIMESTAMP_CLASS,
	SH_FRIEND_INITIALS_AVATAR_CLASS,
	SH_INBOX_CARD_TITLE_CLASS,
	SH_INBOX_LOADING_GRID_CLASS,
	SH_INBOX_META_CHIP_CLASS,
	SH_KPI_LABEL_CLASS,
	SH_MOBILE_OVERVIEW_GRID_CLASS,
	SH_NAV_BADGE_CLASS,
	SH_PANEL_HEADER_TITLE_CLASS,
	SH_PRIVACY_AUDIENCE_GRID_CLASS,
	SH_PRIVACY_CHIP_ROW_CLASS,
	SH_SECTION_EYEBROW_CLASS,
	SH_SECTION_LEAD_TITLE_CLASS,
	SH_SIDEBAR_SECTION_LABEL_CLASS,
	SH_WORKSPACE_PANEL_CLASS,
	shInboxSeverityPanelClass,
	shMetricTileToneClass,
	shMetricValueToneClass,
	shPeopleSubnavBadgeClass,
	shPrivacyChipClass,
	shPrivacyStatusPanelClass,
	shDirectoryCountBadgeClass,
	shDirectoryFlashPanelClass,
	shDirectoryMetricChipClass,
	shDirectoryPanelGlowClass,
	shFriendCardStatusBadgeClass,
	shFriendCardTabClass,
	shFriendListRowClass,
	shRequestListRowClass,
} from '../socialHubLayoutTokens';

describe('socialHubLayoutTokens', () => {
	it('exports section lead typography tokens', () => {
		expect(SH_SECTION_LEAD_TITLE_CLASS).toContain('font-semibold');
		expect(SH_PANEL_HEADER_TITLE_CLASS).toContain('flex items-center');
	});

	it('exports KPI and nav badge tokens', () => {
		expect(SH_KPI_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_KPI_LABEL_CLASS).toMatch(/tracking-normal/);
		expect(SH_NAV_BADGE_CLASS).toContain('rounded-md');
		expect(SH_NAV_BADGE_CLASS).not.toContain('rounded-full');
	});

	it('keeps section eyebrows sentence-case and workspace panel quiet', () => {
		expect(SH_SECTION_EYEBROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_SIDEBAR_SECTION_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_SIDEBAR_SECTION_LABEL_CLASS).toMatch(/tracking-normal/);
		expect(SH_WORKSPACE_PANEL_CLASS).not.toMatch(/radial-gradient/);
	});

	it('maps people subnav badge tone by subview', () => {
		expect(shPeopleSubnavBadgeClass(true)).toContain('desktop-accent-rgb');
		expect(shPeopleSubnavBadgeClass(false)).toContain('desktop-surface-soft');
	});

	it('maps inbox severity panel tones', () => {
		expect(shInboxSeverityPanelClass('high')).toContain('rose');
		expect(shInboxSeverityPanelClass('medium')).toContain('amber');
		expect(shInboxSeverityPanelClass('low')).toContain('cyan');
	});

	it('exports inbox loading grid layout', () => {
		expect(SH_INBOX_LOADING_GRID_CLASS).toContain('md:grid-cols-2');
	});

	it('exports home feed and friend avatar tokens', () => {
		expect(SH_FRIEND_INITIALS_AVATAR_CLASS).toContain('rounded-full');
		expect(SH_FEED_EVENT_BADGE_CLASS).toContain('uppercase');
		expect(SH_INBOX_META_CHIP_CLASS).toContain('border-current/15');
	});

	it('maps metric tile tones for privacy summary', () => {
		expect(shMetricTileToneClass('success')).toContain('emerald');
		expect(shMetricValueToneClass('warning')).toContain('amber');
		expect(shMetricTileToneClass('info')).toContain('cyan');
	});

	it('maps privacy chips and status panels', () => {
		expect(SH_PRIVACY_CHIP_ROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(shPrivacyChipClass('info')).toContain('cyan');
		expect(shPrivacyChipClass('warning')).toContain('amber');
		expect(shPrivacyChipClass('success')).not.toMatch(/\buppercase\b/);
		expect(shPrivacyStatusPanelClass(true)).toContain('amber');
		expect(shPrivacyStatusPanelClass(false)).toContain('emerald');
		expect(SH_PRIVACY_AUDIENCE_GRID_CLASS).toContain('xl:grid-cols-4');
	});

	it('exports mobile hub and inbox card tokens', () => {
		expect(SH_MOBILE_OVERVIEW_GRID_CLASS).toContain('xl:grid-cols-4');
		expect(SH_INBOX_CARD_TITLE_CLASS).toContain('font-semibold');
		expect(SH_FEED_TIMESTAMP_CLASS).toContain('uppercase');
	});

	it('exports people directory list tokens', () => {
		expect(SH_DIRECTORY_METRIC_ROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(shDirectoryPanelGlowClass('friends')).not.toMatch(/radial-gradient/);
		expect(shDirectoryMetricChipClass('favorite')).toContain('amber');
		expect(shDirectoryMetricChipClass('sent')).toContain('violet');
		expect(shDirectoryMetricChipClass('neutral')).toContain('rounded-md');
		expect(shDirectoryCountBadgeClass('inset', 'incoming')).toContain(
			'emerald'
		);
		expect(shFriendListRowClass(true, 'idle')).toContain('cyan-400');
		expect(shRequestListRowClass('accepted', 'idle')).toContain('emerald');
		expect(shDirectoryFlashPanelClass('danger')).toContain('rose');
	});

	it('exports friend person card tokens', () => {
		expect(shFriendCardStatusBadgeClass('favorite')).toContain('amber');
		expect(shFriendCardStatusBadgeClass('circle')).toContain('cyan');
		expect(shFriendCardTabClass(true)).toContain('desktop-accent-rgb');
		expect(shFriendCardTabClass(false)).toContain('desktop-text-muted');
	});
});
