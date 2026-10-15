import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { AppStore } from '../AppStore';

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({
		isAuthenticated: false,
		token: null,
	}),
}));

describe('AppStore page variant', () => {
	it('renders embedded loading state without requiring onClose', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={client}>
				<AppStore
					isOpen
					apps={[]}
					isLoading
					onInstall={async () => {}}
					onUninstall={async () => {}}
					variant="page"
				/>
			</QueryClientProvider>
		);

		expect(
			screen.getByRole('status', { name: /Загрузка каталога|Loading catalog/i })
		).toBeInTheDocument();
	});
});
