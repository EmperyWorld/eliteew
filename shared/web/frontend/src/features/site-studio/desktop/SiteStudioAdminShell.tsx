import { ADMIN_ROUTES } from '@constants/adminRoutes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminStore } from '@store/slices/adminSlice';
import {
	activateSiteStudioProxy,
	deactivateSiteStudioProxy,
	publicOriginFromSiteUrl,
	setSiteStudioPublicUploadsOrigin,
} from '@/services/api/siteStudioProxy';
import {
	AdminOrdersPage,
	BookingsPage,
	ConfigPage,
	ConsultationEditPage,
	ConsultationsListPage,
	ContentPage,
	CustomizationPage,
	DashboardPage,
	GalleryPage,
	MasterclassEditPage,
	MasterclassesListPage,
	PresentationEditPage,
	PresentationsListPage,
	ProductEditPage,
	ProductsListPage,
	SchedulePage,
	SettingsPage,
} from '@/features/site-studio/admin';
import {
	AdminNavigate,
	EmbeddedAdminRouterProvider,
	useAdminNavigate,
	useEmbeddedAdminLocation,
} from '@/features/site-studio/admin/AdminEmbeddedRouter';
import { AdminShellModeProvider } from '@/features/site-studio/admin/AdminShellModeContext';
import { AdminRouteGuard } from '@/features/site-studio/admin/AdminRouteGuard';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router';
import { EliteRecoveryScreen } from '@/components/ui/EliteRecoveryScreen';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

const AutoReconnectPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const login = useAdminStore((state) => state.login);
	const navigate = useAdminNavigate();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const reconnect = useCallback(async () => {
		setLoading(true);
		setError(null);
		const success = await login('', { forceRefresh: true });
		if (success) {
			navigate(ADMIN_ROUTES.ROOT, { replace: true });
			setLoading(false);
			return;
		}
		setError(t('adminShell.reconnectError'));
		setLoading(false);
	}, [login, navigate, t]);

	useEffect(() => {
		reconnect().catch(() => {
			setLoading(false);
			setError(t('adminShell.reconnectError'));
		});
	}, [reconnect, t]);

	if (loading) {
		return (
			<div className="flex h-full min-h-[18rem] items-center justify-center p-8">
				<EliteRecoveryScreen
					fullScreen={false}
					title={t('adminShell.connecting')}
					statusLabel={t('adminShell.connecting')}
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-[18rem] items-center justify-center p-8">
			<EliteRecoveryScreen
				fullScreen={false}
				title={t('adminShell.reconnectTitle')}
				description={error ?? t('adminShell.reconnectBody')}
				actionLabel={t('adminShell.reconnectAction')}
				onAction={() => {
					void reconnect();
				}}
			/>
		</div>
	);
};

const EmbeddedAdminRoutes: React.FC = () => {
	const location = useEmbeddedAdminLocation();

	return (
		<Routes location={location}>
			<Route path={ADMIN_ROUTES.LOGIN} element={<AutoReconnectPage />} />
			<Route path={ADMIN_ROUTES.ROOT} element={<AdminRouteGuard />}>
				<Route index element={<DashboardPage />} />
				<Route path="consultations" element={<ConsultationsListPage />} />
				<Route path="consultations/:id" element={<ConsultationEditPage />} />
				<Route path="masterclasses" element={<MasterclassesListPage />} />
				<Route path="masterclasses/:id" element={<MasterclassEditPage />} />
				<Route path="products" element={<ProductsListPage />} />
				<Route path="products/:id" element={<ProductEditPage />} />
				<Route path="orders" element={<AdminOrdersPage />} />
				<Route path="schedule" element={<SchedulePage />} />
				<Route path="bookings" element={<BookingsPage />} />
				<Route path="gallery" element={<GalleryPage />} />
				<Route path="content" element={<ContentPage />} />
				<Route path="presentations" element={<PresentationsListPage />} />
				<Route path="presentations/:id" element={<PresentationEditPage />} />
				<Route path="customization" element={<CustomizationPage />} />
				<Route path="settings" element={<SettingsPage />} />
				<Route path="config" element={<ConfigPage />} />
			</Route>
			<Route
				path="*"
				element={<AdminNavigate to={ADMIN_ROUTES.ROOT} replace />}
			/>
		</Routes>
	);
};

type SiteStudioAdminShellProps = {
	/** KIRS (and similar) wrap the shell and own proxy scope + activate/deactivate — avoid double counting. */
	skipProxyLifecycle?: boolean;
	/** Публичный URL витрины (instance.public_url) — для `/uploads/*` в img без Bearer. Не нужен при skipProxyLifecycle + KIRS (задаётся в KirsSiteStudioAdminPanel). */
	publicSiteUrl?: string | null;
};

export const SiteStudioAdminShell: React.FC<SiteStudioAdminShellProps> = ({
	skipProxyLifecycle = false,
	publicSiteUrl,
}) => {
	const ensureSession = useAdminStore((state) => state.ensureSession);

	useEffect(() => {
		if (!skipProxyLifecycle) {
			activateSiteStudioProxy();
		}
		ensureSession().catch(() => undefined);
		return () => {
			if (!skipProxyLifecycle) {
				deactivateSiteStudioProxy();
			}
		};
	}, [ensureSession, skipProxyLifecycle]);

	useEffect(() => {
		if (skipProxyLifecycle) {
			return;
		}
		setSiteStudioPublicUploadsOrigin(publicOriginFromSiteUrl(publicSiteUrl));
		return () => {
			setSiteStudioPublicUploadsOrigin(null);
		};
	}, [skipProxyLifecycle, publicSiteUrl]);

	return (
		<QueryClientProvider client={queryClient}>
			<AdminShellModeProvider mode="desktop-embedded">
				<MemoryRouter initialEntries={[ADMIN_ROUTES.ROOT]}>
					<EmbeddedAdminRouterProvider>
						<div className="h-full">
							<EmbeddedAdminRoutes />
						</div>
					</EmbeddedAdminRouterProvider>
				</MemoryRouter>
			</AdminShellModeProvider>
		</QueryClientProvider>
	);
};
