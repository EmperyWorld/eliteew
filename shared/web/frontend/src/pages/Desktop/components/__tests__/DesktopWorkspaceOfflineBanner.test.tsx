/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rendered DOM lock for canvas offline banner — P13 durability copy in the view (P17).
 *
 * Invariants:
 * - Banner mounts with data-testid; body mentions browser layout (not “all changes”).
 *
 * Related:
 * - `DesktopWorkspaceOfflineBanner.tsx`
 * - `desktopOfflineDurabilityCopy.p13.test.ts`
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DesktopWorkspaceOfflineBanner } from '../DesktopWorkspaceOfflineBanner';

const offlineCopy = vi.hoisted(() => {
	const { readFileSync } = require('node:fs') as typeof import('node:fs');
	const { resolve } = require('node:path') as typeof import('node:path');
	const en = JSON.parse(
		readFileSync(
			resolve(process.cwd(), 'src/i18n/locales/en/desktopUi.json'),
			'utf8'
		)
	) as {
		workspace: {
			offlineBannerTitle: string;
			offlineBannerBody: string;
			offlineBannerRetry: string;
		};
	};
	return en.workspace;
});

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => {
				const map: Record<string, string> = {
					'workspace.offlineBannerTitle': offlineCopy.offlineBannerTitle,
					'workspace.offlineBannerBody': offlineCopy.offlineBannerBody,
					'workspace.offlineBannerRetry': offlineCopy.offlineBannerRetry,
				};
				return map[key] ?? key;
			},
		}),
	};
});

describe('DesktopWorkspaceOfflineBanner', () => {
	it('renders offline banner with browser-layout durability copy and retry', async () => {
		const onRetry = vi.fn();
		const user = userEvent.setup();
		render(<DesktopWorkspaceOfflineBanner onRetry={onRetry} />);

		expect(screen.getByTestId('desktop-offline-banner')).toBeInTheDocument();
		expect(
			screen.getByText(offlineCopy.offlineBannerTitle)
		).toBeInTheDocument();
		const body = screen.getByText(offlineCopy.offlineBannerBody);
		expect(body).toBeInTheDocument();
		expect(body.textContent?.toLowerCase()).toContain('browser');
		expect(body.textContent?.toLowerCase()).not.toContain(
			'all changes on this device'
		);

		await user.click(
			screen.getByRole('button', { name: offlineCopy.offlineBannerRetry })
		);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
