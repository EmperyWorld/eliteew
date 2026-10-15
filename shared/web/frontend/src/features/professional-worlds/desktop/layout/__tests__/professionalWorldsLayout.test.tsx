/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke tests for Professional Worlds layout chrome components.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsSidebarNav,
	ProfessionalWorldsStatePanel,
	ProfessionalWorldsActionCard,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSubtabs,
} from '../index';
import {
	PW_PANEL_EMBEDDED_CLASS,
	PW_MEDIA_MODAL_BACKDROP_CLASS,
	PW_MEDIA_OVERLAY_BADGE_CLASS,
	PW_MEDIA_SPLIT_HANDLE_CLASS,
	PW_VISIBLE_HERO_CLASS,
	PW_VISIBLE_PROGRESS_RAIL_CLASS,
	PW_TONE_LABEL_CLASS,
	pwJobProgressEventSurfaceClass,
} from '../professionalWorldsLayoutTokens';

describe('ProfessionalWorldsWorkspaceSubtabs', () => {
	it('calls onSelect when a tab is clicked', () => {
		const onSelect = vi.fn();
		render(
			<ProfessionalWorldsWorkspaceSubtabs
				active="a"
				ariaLabel="Test tabs"
				items={[
					{ id: 'a', label: 'Tab A' },
					{ id: 'b', label: 'Tab B' },
				]}
				onSelect={onSelect}
			/>
		);
		fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
		expect(onSelect).toHaveBeenCalledWith('b');
	});
});

describe('ProfessionalWorldsSidebarNav', () => {
	it('keeps locked modules focusable with a visible reason and no activation', () => {
		const onSelect = vi.fn();
		render(
			<ProfessionalWorldsSidebarNav
				activeView="overview"
				navLabel="Workspace"
				safetyTitle="Safety"
				safetyBody="Review before publishing."
				navItems={[
					{ id: 'overview', label: 'Overview' },
					{
						id: 'media',
						label: 'Media',
						disabled: true,
						locked: true,
						lockReason: 'Enable the media module in this pack.',
					},
				]}
				onSelectView={onSelect}
			/>
		);

		const locked = screen.getByRole('button', { name: /^Media,/ });
		expect(locked).toHaveAttribute('aria-disabled', 'true');
		expect(locked).not.toBeDisabled();
		expect(
			screen.getByText('Enable the media module in this pack.')
		).toHaveAttribute('id', locked.getAttribute('aria-describedby'));

		fireEvent.click(locked);
		expect(onSelect).not.toHaveBeenCalledWith('media');
	});

	it('groups vertical navigation into visible work stages', () => {
		render(
			<ProfessionalWorldsSidebarNav
				activeView="overview"
				navLabel="Workspace"
				safetyTitle="Safety"
				safetyBody="Review before publishing."
				navItems={[
					{ id: 'overview', label: 'Overview' },
					{ id: 'profile', label: 'Profile' },
					{ id: 'properties', label: 'Listings' },
					{ id: 'clients', label: 'Clients' },
					{ id: 'learning', label: 'Learning' },
					{ id: 'artifacts', label: 'Results' },
				]}
				onSelectView={vi.fn()}
			/>
		);

		// Default Vitest i18n locale is English; group labels may share text with nav items.
		expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('Listings').length).toBeGreaterThanOrEqual(1);
		expect(
			screen.getAllByText('Clients & deals').length
		).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('My image').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('Drafts').length).toBeGreaterThanOrEqual(1);
	});
});

describe('ProfessionalWorlds visible primitives', () => {
	it('renders action cards and readiness rail with accessible actions', () => {
		const onAction = vi.fn();
		render(
			<>
				<ProfessionalWorldsActionCard
					eyebrow="Next"
					title="Complete profile"
					description="Add the basics before client materials."
					actionLabel="Open profile"
					onAction={onAction}
				/>
				<ProfessionalWorldsProgressRail
					title="Readiness"
					items={[
						{
							id: 'profile',
							label: 'Profile',
							value: 'Ready',
							complete: true,
						},
						{
							id: 'portfolio',
							label: 'Portfolio',
							value: '0',
							complete: false,
						},
					]}
				/>
			</>
		);

		fireEvent.click(screen.getByRole('button', { name: /Complete profile/i }));
		expect(onAction).toHaveBeenCalledTimes(1);
		expect(screen.getByText('1/2')).toBeInTheDocument();
	});
});

describe('ProfessionalWorldsStatusBanner', () => {
	it('renders success and error variants with role status', () => {
		const { rerender } = render(
			<ProfessionalWorldsStatusBanner kind="success">
				Saved
			</ProfessionalWorldsStatusBanner>
		);
		expect(screen.getByRole('status')).toHaveTextContent('Saved');
		expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
		rerender(
			<ProfessionalWorldsStatusBanner kind="error">
				Failed
			</ProfessionalWorldsStatusBanner>
		);
		expect(screen.getByRole('status')).toHaveTextContent('Failed');
	});

	it('renders warning with role alert', () => {
		render(
			<ProfessionalWorldsStatusBanner kind="warning" role="alert">
				Review intake
			</ProfessionalWorldsStatusBanner>
		);
		expect(screen.getByRole('alert')).toHaveTextContent('Review intake');
		expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
	});
});

describe('ProfessionalWorldsStatePanel', () => {
	it('renders error states with retry and support detail disclosure', () => {
		const onRetry = vi.fn();
		render(
			<ProfessionalWorldsStatePanel
				state="error"
				title="Section needs attention"
				description="Refresh this section before continuing."
				supportDetail="network down"
				onRetry={onRetry}
				retryLabel="Retry section"
			/>
		);

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Section needs attention'
		);
		fireEvent.click(screen.getByRole('button', { name: 'Retry section' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(screen.getByText('network down')).toBeInTheDocument();
	});
});

describe('ProfessionalWorldsWorkspacePanel', () => {
	it('embedded mode skips outer panel chrome', () => {
		const { container } = render(
			<ProfessionalWorldsWorkspacePanel embedded>
				<span>Nested body</span>
			</ProfessionalWorldsWorkspacePanel>
		);
		expect(container.firstChild).toHaveClass(
			PW_PANEL_EMBEDDED_CLASS.split(' ')[0]
		);
		expect(screen.getByText('Nested body')).toBeInTheDocument();
	});
});

describe('professionalWorldsLayoutTokens', () => {
	it('maps job and timeline tones to shared palette classes', () => {
		expect(pwJobProgressEventSurfaceClass('error')).toContain('rose-500/30');
		expect(pwJobProgressEventSurfaceClass('done')).toContain('emerald-500/30');
		expect(PW_TONE_LABEL_CLASS.err).toContain('rose-300');
	});

	it('keeps media overlay tokens free of black/white blur dependency', () => {
		const tokenSurface = [
			PW_MEDIA_MODAL_BACKDROP_CLASS,
			PW_MEDIA_OVERLAY_BADGE_CLASS,
			PW_MEDIA_SPLIT_HANDLE_CLASS,
		].join(' ');
		expect(tokenSurface).not.toMatch(
			/\bbg-black\/|\btext-white\b|backdrop-blur/
		);
		expect(PW_MEDIA_SPLIT_HANDLE_CLASS).toContain('--desktop-accent-rgb');
	});

	it('keeps visible redesign tokens low-gpu friendly', () => {
		const tokenSurface = [
			PW_VISIBLE_HERO_CLASS,
			PW_VISIBLE_PROGRESS_RAIL_CLASS,
		].join(' ');
		expect(tokenSurface).not.toMatch(
			/\bbg-black\/|\btext-white\b|backdrop-blur/
		);
		expect(PW_VISIBLE_HERO_CLASS).toContain('--desktop-accent-rgb');
	});

	it('keeps reduced-motion proof in progress and admin controls', () => {
		const sources = [
			'src/features/professional-worlds/desktop/JobProgressStream.tsx',
			'src/pages/Admin/ui/adminTokens.ts',
		]
			.map((filePath) => readFileSync(join(process.cwd(), filePath), 'utf8'))
			.join('\n');
		expect(sources).toContain('motion-reduce:transition-none');
	});
});
