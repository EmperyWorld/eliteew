/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session gate for Site Studio embedded CMS admin routes before rendering AdminLayout.
 *
 * Invariants:
 * - Loading island uses `data-site-studio-cms="island"` and desktop token classes.
 *
 * Related:
 * - AdminLayout.tsx
 * - adminEmbeddedChrome.ts
 */
import { ADMIN_ROUTES } from '@constants/adminRoutes';
import { useAdminStore } from '@store/slices/adminSlice';
import { useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminNavigate } from './AdminEmbeddedRouter';
import { AdminLayout } from './AdminLayout';
import {
	ADMIN_CMS_LOADING_CARD_CLASS,
	ADMIN_CMS_LOADING_ISLAND_CLASS,
} from './adminEmbeddedChrome';

export function AdminRouteGuard() {
	const { t } = useTranslation('siteStudioCms');
	const { isAuthenticated, sessionChecked, ensureSession } = useAdminStore();

	useEffect(() => {
		ensureSession().catch(() => undefined);
	}, [ensureSession]);

	if (!sessionChecked) {
		return (
			<div
				className={ADMIN_CMS_LOADING_ISLAND_CLASS}
				data-site-studio-cms="island"
			>
				<div className={ADMIN_CMS_LOADING_CARD_CLASS}>
					<ArrowPathIcon className="h-8 w-8 animate-spin text-(--desktop-accent-primary)" />
					<p className="text-sm text-(--desktop-text-muted)">
						{t('shell.routeGuard.checkingAccess')}
					</p>
				</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return <AdminNavigate to={ADMIN_ROUTES.LOGIN} replace />;
	}

	return <AdminLayout />;
}
