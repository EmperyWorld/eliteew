/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin drawer that runs playbook dry-run (saved or draft steps) and shows resolved action metadata.
 *
 * Invariants:
 * - Does not invoke generation; only calls `POST …/admin/playbooks/.../dry-run`.
 * - Draft preview sends `steps` in the POST body so operators validate before saving.
 * - Does not import adminUiShared (Wave 3 New World tab helper).
 *
 * Related:
 * - src/features/professional-worlds/admin/tabs/PlaybooksTab.tsx
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	AdminButton,
	AdminDrawer,
	AdminJsonPreview,
	AdminStatusBanner,
} from '@/pages/Admin/ui';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { postAdminProfessionalPlaybookDryRun } from '../api';
import type {
	AdminProfessionalPlaybookStep,
	ProfessionalPlaybookDryRunOut,
} from '../types';

export function PlaybookDryRunDrawer({
	open,
	verticalSlug,
	playbookKey,
	mode,
	draftSteps,
	onClose,
}: {
	open: boolean;
	verticalSlug: string;
	playbookKey: string;
	mode: 'draft' | 'saved';
	draftSteps: AdminProfessionalPlaybookStep[];
	onClose: () => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ProfessionalPlaybookDryRunOut | null>(
		null
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		setError(null);
		setResult(null);
		setLoading(true);
		const body = mode === 'draft' ? { steps: draftSteps } : undefined;
		void postAdminProfessionalPlaybookDryRun(verticalSlug, playbookKey, body)
			.then((row) => {
				setResult(row);
			})
			.catch((err) => {
				setError(
					err instanceof Error ? err.message : t('admin.errors.dryRunFailed')
				);
			})
			.finally(() => setLoading(false));
	}, [open, verticalSlug, playbookKey, mode, draftSteps, t]);

	return (
		<AdminDrawer
			open={open}
			title={t('admin.playbooks.dryRunTitle')}
			onClose={onClose}
			wide
			footer={
				<AdminButton variant="secondary" onClick={onClose}>
					{t('admin.actions.cancel')}
				</AdminButton>
			}
		>
			<p className="mb-2 text-xs text-(--admin-ui-fg-muted)">
				{mode === 'draft'
					? t('admin.playbooks.dryRunDraftHint')
					: t('admin.playbooks.dryRunSavedHint')}
			</p>
			{loading && (
				<p className="text-sm text-(--admin-ui-fg-muted)">
					{t('admin.status.loading')}
				</p>
			)}
			{error ? (
				<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
			) : null}
			{!loading && !error && result ? (
				<AdminJsonPreview
					value={result}
					title={t('admin.playbooks.dryRunTitle')}
				/>
			) : null}
		</AdminDrawer>
	);
}
