import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { AppStore } from '../AppStore';

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({
		isAuthenticated: false,
		token: null,
	}),
}));

describe('AppStore loading skeleton', () => {
	it('uses motion-safe pulse with reduced-motion guard on skeleton blocks', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const { container } = render(
			<QueryClientProvider client={client}>
				<AppStore
					isOpen
					onClose={() => {}}
					apps={[]}
					isLoading
					onInstall={async () => {}}
					onUninstall={async () => {}}
				/>
			</QueryClientProvider>
		);
		expect(
			screen.getByRole('status', { name: /Загрузка каталога|Loading catalog/i })
		).toBeInTheDocument();
		const html = container.innerHTML;
		expect(html).toContain('motion-safe:animate-pulse');
		expect(html).toContain('motion-reduce:animate-none');
	});

	it('renders the shared error state and retries an unavailable catalog', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const onCatalogRetry = vi.fn();

		render(
			<QueryClientProvider client={client}>
				<AppStore
					isOpen
					onClose={() => {}}
					apps={undefined}
					isLoading={false}
					catalogError={new Error('catalog request failed')}
					onInstall={async () => {}}
					onUninstall={async () => {}}
					onCatalogRetry={onCatalogRetry}
				/>
			</QueryClientProvider>
		);

		expect(
			screen.getByText(
				/Не удалось загрузить каталог|Could not load the catalog/i
			)
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: /Повторить загрузку каталога|Retry loading catalog/i,
			})
		);
		expect(onCatalogRetry).toHaveBeenCalledOnce();
	});
});
