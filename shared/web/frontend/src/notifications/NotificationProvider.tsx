/**
 * Root provider: notification center store + Sonner Toaster.
 * Mount once in App.tsx.
 */

import { EliteToaster } from '@/components/atoms/Toast/Toast';
import { NotificationCenterSync } from './NotificationCenterSync';
import { NotificationProvider as StoreProvider } from './context';

export function NotificationProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<StoreProvider>
			<NotificationCenterSync />
			{children}
			<EliteToaster />
		</StoreProvider>
	);
}
