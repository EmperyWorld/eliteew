import { ScrollToTopOnNavigate } from '@components/atoms/ScrollToTopOnNavigate';
import { MainLayout } from '@components/layouts/MainLayout';
import { AboutPage } from '@pages/about/AboutPage';
import { ConsultationDetailPage } from '@pages/consultations/ConsultationDetailPage';
import { ConsultationsPage } from '@pages/consultations/ConsultationsPage';
import { ContactsPage } from '@pages/contacts/ContactsPage';
import { NotFoundPage } from '@pages/error/NotFoundPage';
import { HomePage } from '@pages/home/HomePage';
import { MasterclassDetailPage } from '@pages/masterclasses/MasterclassDetailPage';
import { MasterclassesPage } from '@pages/masterclasses/MasterclassesPage';
import { PresentationViewPage } from '@pages/presentations/PresentationViewPage';
import { ShopPage } from '@pages/shop/ShopPage';
import { CartPage } from '@pages/shop/cart/CartPage';
import { CheckoutPage } from '@pages/shop/checkout/CheckoutPage';
import { ProductDetailPage } from '@pages/shop/product/ProductDetailPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
// Auth pages
import { ForgotPasswordPage } from '@pages/auth/ForgotPasswordPage';
import { LoginPage } from '@pages/auth/LoginPage';
import { RegisterPage } from '@pages/auth/RegisterPage';
// Account pages
import { ADMIN_ROUTES } from '@constants/adminRoutes';
import { ROUTES } from '@constants/routes';
import { BookingsPage as UserBookingsPage } from '@pages/account/BookingsPage';
import { FavoritesPage } from '@pages/account/FavoritesPage';
import { OrdersPage } from '@pages/account/OrdersPage';
import { ProfilePage } from '@pages/account/ProfilePage';
import { SettingsPage as UserSettingsPage } from '@pages/account/SettingsPage';
// Admin pages
import {
    AdminLoginPage,
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
} from '@pages/admin';
import { AdminRouteGuard } from '@pages/admin/AdminRouteGuard';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount: number, error: unknown) => {
        // Не повторять запросы при ошибках подключения в dev режиме
        if (import.meta.env.DEV) {
          const axiosError = error as { code?: string; message?: string; name?: string };
          const isConnectionError =
            axiosError.code === 'ERR_NETWORK' ||
            axiosError.code === 'ECONNREFUSED' ||
            axiosError.name === 'NetworkError' ||
            axiosError.message?.includes('ERR_CONNECTION_REFUSED') ||
            axiosError.message?.includes('ERR_NETWORK') ||
            axiosError.message?.includes('Network Error') ||
            axiosError.message?.includes('Failed to fetch') ||
            axiosError.message?.includes('timeout');
          if (isConnectionError) {
            return false;
          }
        }
        return failureCount < 1;
      },
    },
  },
  // Глобальный обработчик ошибок для подавления логирования ошибок подключения
  ...(import.meta.env.DEV && {
    logger: {
      log: (...args: unknown[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : JSON.stringify(arg)
          )
          .join(' ');
        if (
          message.includes('ERR_CONNECTION_REFUSED') ||
          message.includes('ERR_NETWORK') ||
          message.includes('Network Error') ||
          message.includes('ECONNREFUSED') ||
          message.includes('Failed to fetch') ||
          args.some(
            (arg) =>
              arg instanceof Error &&
              (arg.message.includes('ERR_CONNECTION_REFUSED') ||
                arg.message.includes('ERR_NETWORK'))
          )
        ) {
          return;
        }
        console.log(...args);
      },
      warn: (...args: unknown[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : JSON.stringify(arg)
          )
          .join(' ');
        if (
          message.includes('ERR_CONNECTION_REFUSED') ||
          message.includes('ERR_NETWORK') ||
          message.includes('Network Error') ||
          message.includes('ECONNREFUSED')
        ) {
          return;
        }
        console.warn(...args);
      },
      error: (...args: unknown[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'string' ? arg : arg instanceof Error ? arg.message : JSON.stringify(arg)
          )
          .join(' ');
        if (
          message.includes('ERR_CONNECTION_REFUSED') ||
          message.includes('ERR_NETWORK') ||
          message.includes('Network Error') ||
          message.includes('ECONNREFUSED') ||
          message.includes('Failed to fetch') ||
          args.some(
            (arg) =>
              arg instanceof Error &&
              (arg.message.includes('ERR_CONNECTION_REFUSED') ||
                arg.message.includes('ERR_NETWORK') ||
                arg.message.includes('Network Error'))
          )
        ) {
          return;
        }
        console.error(...args);
      },
    },
  }),
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTopOnNavigate />
        <Routes>
          {/* Presentation route - без Layout (полноэкранный режим) */}
          <Route path="/presentations/:slug" element={<PresentationViewPage />} />

          {/* Main site routes */}
          <Route element={<MainLayout />}>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.SHOP} element={<ShopPage />} />
            <Route path={ROUTES.SHOP_CATALOG} element={<ShopPage />} />
            <Route path={ROUTES.SHOP_MATERIALS} element={<ShopPage />} />
            <Route path={ROUTES.SHOP_ACCESSORIES} element={<ShopPage />} />
            <Route path={ROUTES.LEGACY_SHOP_PERFUMES} element={<ShopPage />} />
            <Route path={ROUTES.LEGACY_SHOP_INGREDIENTS} element={<ShopPage />} />
            <Route path="/shop/:id" element={<ProductDetailPage />} />
            <Route path={ROUTES.CART} element={<CartPage />} />
            <Route path={ROUTES.CHECKOUT} element={<CheckoutPage />} />
            <Route path={ROUTES.CONSULTATIONS} element={<ConsultationsPage />} />
            <Route path="/consultations/:id" element={<ConsultationDetailPage />} />
            <Route path={ROUTES.MASTERCLASSES} element={<MasterclassesPage />} />
            <Route path="/masterclasses/:id" element={<MasterclassDetailPage />} />
            <Route path={ROUTES.CONTACTS} element={<ContactsPage />} />
            <Route path={ROUTES.ABOUT} element={<AboutPage />} />
            <Route path={ROUTES.AUTH_LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.AUTH_REGISTER} element={<RegisterPage />} />
            <Route path={ROUTES.AUTH_FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
            <Route path={ROUTES.ACCOUNT_PROFILE} element={<ProfilePage />} />
            <Route path={ROUTES.ACCOUNT_ORDERS} element={<OrdersPage />} />
            <Route path={ROUTES.ACCOUNT_FAVORITES} element={<FavoritesPage />} />
            <Route path="/account/bookings" element={<UserBookingsPage />} />
            <Route path="/account/settings" element={<UserSettingsPage />} />
            <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
          </Route>

          {/* Admin routes */}
          <Route path={ADMIN_ROUTES.LOGIN} element={<AdminLoginPage />} />
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

          {/* Catch all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
