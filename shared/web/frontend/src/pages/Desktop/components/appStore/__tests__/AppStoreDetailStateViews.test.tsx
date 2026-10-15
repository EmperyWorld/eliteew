/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock App Store detail early states: loading / error retry / not-found empty.
 *
 * Related:
 * - ../AppStoreDetailStateViews.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { AppStoreDetailStateViews } from '../AppStoreDetailStateViews';

const t = ((key: string) => key) as TFunction<'appStore'>;

describe('AppStoreDetailStateViews', () => {
	it('renders loading state with product loading panel', () => {
		render(
			<AppStoreDetailStateViews
				detailShellClass="shell"
				loading
				loadError={null}
				hasDetail={false}
				onBack={vi.fn()}
				onRetry={vi.fn()}
				t={t}
			/>
		);
		expect(screen.getByLabelText('loading.appDetail')).toBeInTheDocument();
		expect(screen.getByText('loading.appDetail')).toBeInTheDocument();
	});

	it('renders error with retry that calls onRetry', async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();
		render(
			<AppStoreDetailStateViews
				detailShellClass="shell"
				loading={false}
				loadError="boom"
				hasDetail={false}
				onBack={vi.fn()}
				onRetry={onRetry}
				t={t}
			/>
		);
		expect(screen.getByText('boom')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'retry' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('renders notFound as empty state, not error role', () => {
		render(
			<AppStoreDetailStateViews
				detailShellClass="shell"
				loading={false}
				loadError={null}
				hasDetail={false}
				onBack={vi.fn()}
				onRetry={vi.fn()}
				t={t}
			/>
		);
		expect(screen.getByText('detail.notFound')).toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
