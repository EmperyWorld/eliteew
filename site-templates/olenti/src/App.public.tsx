import { ScrollToTopOnNavigate } from '@components/atoms/ScrollToTopOnNavigate';
import { MainLayout } from '@components/layouts/MainLayout';
import { BookingsPage as UserBookingsPage } from '@pages/account/BookingsPage';
import { FavoritesPage } from '@pages/account/FavoritesPage';
import { OrdersPage } from '@pages/account/OrdersPage';
import { ProfilePage } from '@pages/account/ProfilePage';
import { SettingsPage as UserSettingsPage } from '@pages/account/SettingsPage';
import { AboutPage } from '@pages/about/AboutPage';
import { ForgotPasswordPage } from '@pages/auth/ForgotPasswordPage';
import { LoginPage } from '@pages/auth/LoginPage';
import { RegisterPage } from '@pages/auth/RegisterPage';
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
import { ROUTES } from '@constants/routes';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount: number, error: unknown) => {
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

function AppPublic() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTopOnNavigate />
        <Routes>
          <Route path="/presentations/:slug" element={<PresentationViewPage />} />

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

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default AppPublic;
