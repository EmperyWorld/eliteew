import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUgsBillingStats } from '../../hooks/api/useUgsBillingStats';
import { log } from '../../utils/logger';

export function useAvailableCredits() {
	const { user, isAuthenticated } = useAuth();
	const [billingCredits, setBillingCredits] = useState<number | null>(null);

	const rawUserCredits = useMemo(() => {
		const creditsField =
			user && typeof user === 'object' && 'credits' in user
				? (user as { credits?: unknown }).credits
				: undefined;
		const value = Number(creditsField ?? 0);
		if (Number.isNaN(value)) {
			return 0;
		}
		return value;
	}, [user]);

	const {
		data: billingStats,
		isLoading,
		error,
		refetch,
	} = useUgsBillingStats();

	useEffect(() => {
		if (!isAuthenticated) {
			setBillingCredits(null);
			return;
		}

		if (error) {
			if (process.env.NODE_ENV !== 'production') {
				log.info(
					'useAvailableCredits: billing stats недоступны, используем fallback по данным пользователя',
					(error as unknown as Error).message ?? 'Unknown error'
				);
			}
			setBillingCredits(null);
			return;
		}

		if (!billingStats) {
			if (!isLoading) {
				void refetch();
			}
			return;
		}

		const value = Number(
			billingStats.available_credits ?? billingStats.credits_remaining ?? 0
		);
		setBillingCredits(Number.isNaN(value) ? 0 : value);
	}, [billingStats, isLoading, error, refetch, isAuthenticated]);

	const credits = useMemo(() => {
		if (billingCredits !== null) {
			if (billingCredits <= 0 && rawUserCredits > 0) {
				return rawUserCredits;
			}
			return billingCredits;
		}

		return rawUserCredits > 0 ? rawUserCredits : 0;
	}, [billingCredits, rawUserCredits]);

	const formattedCredits = useMemo(
		() =>
			new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
				credits
			),
		[credits]
	);

	return {
		credits,
		formattedCredits,
		isLoading,
		refetchCredits: refetch,
	};
}
