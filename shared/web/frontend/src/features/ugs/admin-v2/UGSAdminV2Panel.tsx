/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Entry component for UGS Admin v2: auth gate + renders the new table-based admin UI.
 *
 * Invariants:
 * - Snapshot/bulk hooks run only after `isUgsAdminAuthorized` is true.
 *
 * Related:
 * - src/pages/Admin/UnifiedAdminPage.tsx
 * - src/features/ugs/admin-v2/UGSAdminV2PanelBody.tsx
 */

import * as React from 'react';
import { useMemo } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import { isUgsAdminAuthorized } from '@/utils/ugsAdminAccess';

import { UgsAdminV2PanelBody } from './UGSAdminV2PanelBody';

export default function UGSAdminV2Panel(): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const { user, isAuthenticated, loading } = useAuth();
	const authorized = useMemo(
		() => isUgsAdminAuthorized({ user, isAuthenticated, loading }),
		[loading, isAuthenticated, user]
	);

	if (!authorized) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<ShieldCheckIcon className="mx-auto h-12 w-12 text-(--desktop-text-muted)" />
					<h2 className="mt-4 text-xl font-semibold text-(--desktop-text-primary)">
						{t('accessDenied.title')}
					</h2>
					<p className="mt-2 text-(--desktop-text-muted)">
						{t('accessDenied.description')}
					</p>
				</div>
			</div>
		);
	}

	return <UgsAdminV2PanelBody />;
}
