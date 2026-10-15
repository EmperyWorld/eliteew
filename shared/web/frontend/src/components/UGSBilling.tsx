/**
 * 🔥💰 UGS BILLING - CREDIT PACKAGE PURCHASE SYSTEM 💰🔥
 *
 * Полноценная система покупки кредитов для UGS с пакетами,
 * историей покупок и управлением балансом.
 *
 * Features:
 * - Просмотр доступных пакетов кредитов
 * - Покупка пакетов с подтверждением
 * - История покупок
 * - Текущий баланс и статистика
 * - Интеграция с платежными системами
 *
 * Author: EliteEW Team
 * Date: 2025-10-22
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
	ArrowPathIcon,
	ArrowTrendingUpIcon,
	BanknotesIcon,
	ChartBarSquareIcon,
	CreditCardIcon,
	CubeIcon,
	DocumentTextIcon,
	ShoppingCartIcon,
	SignalIcon,
	StarIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../services/api';
import { useNotifications } from '@/notifications';
import { createAPIClient } from '../services/api/client';
import { API_CONFIG } from '../services/api/config';
import { useUgsBillingStats } from '../hooks/api/useUgsBillingStats';
import { log } from '../utils/logger';
const ugsBillingClient = createAPIClient({ baseURL: API_CONFIG.ugsBaseURL });

interface CreditPackage {
	id: string;
	package_name: string;
	display_name: string;
	description: string;
	credits_amount: number;
	price_usd: number;
	currency: string;
	is_active: boolean;
	is_visible: boolean;
	/** Server-derived: USD per 1000 credits. */
	price_per_1k_credits?: number | null;
}

interface PurchaseHistory {
	id: string;
	transaction_type: string;
	amount: number;
	balance_after: number;
	created_at: string;
	package_name?: string;
	display_name?: string;
	payment_method?: string;
	payment_id?: string;
	description?: string;
}

const UGSBilling: React.FC = () => {
	const [packages, setPackages] = useState<CreditPackage[]>([]);
	const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
	const [loadingSupplementary, setLoadingSupplementary] = useState(true);
	const [purchasing, setPurchasing] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'packages' | 'history' | 'stats'>(
		'packages'
	);

	const { error: showError, success: showSuccess } = useNotifications();

	const {
		data: billingStats,
		isLoading: billingStatsLoading,
		isError: billingStatsError,
		error: billingStatsErrorObject,
		refetch: refetchBillingStats,
	} = useUgsBillingStats();

	const loadSupplementaryData = useCallback(async () => {
		try {
			setLoadingSupplementary(true);

			// Load credit packages
			const { data: packagesData } = await ugsBillingClient.get<{
				packages: CreditPackage[];
			}>('/billing/packages');
			setPackages(packagesData.packages || []);

			// Load purchase history
			const { data: historyData } = await ugsBillingClient.get<{
				purchase_history: PurchaseHistory[];
			}>('/billing/purchase-history');
			setPurchaseHistory(historyData.purchase_history || []);
		} catch (error) {
			log.error('Failed to load billing data:', error as unknown as string);
			showError('Failed to load billing data');
		} finally {
			setLoadingSupplementary(false);
		}
	}, [showError]);

	useEffect(() => {
		loadSupplementaryData();
	}, [loadSupplementaryData]);

	const handlePurchase = async (packageName: string): Promise<void> => {
		try {
			setPurchasing(packageName);

			const response = await apiClient.post<{
				purchase_details?: { display_name?: string };
			}>(`/api/v1/ugs/billing/packages/${packageName}/purchase`);

			const displayName =
				response.data.purchase_details?.display_name ?? packageName;
			showSuccess(`Successfully purchased ${displayName}!`);

			// Reload billing data to show updated balance
			await Promise.all([loadSupplementaryData(), refetchBillingStats()]);
		} catch (error: unknown) {
			log.error('Purchase failed:', error as unknown as string);
			const errorResponse = error as {
				response?: { data?: { detail?: string } };
			};
			const message =
				errorResponse.response?.data?.detail ?? 'Не удалось купить пакет';
			showError(message);
		} finally {
			setPurchasing(null);
		}
	};

	const formatCurrency = (amount: number, currency = 'USD'): string => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency,
		}).format(amount);
	};

	const formatDate = (dateString: string): string => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const isLoading = loadingSupplementary || billingStatsLoading;

	const billingStatsErrorMessage = useMemo(() => {
		if (!billingStatsError) {
			return null;
		}
		return (
			billingStatsErrorObject?.message ??
			'Не удалось загрузить статистику биллинга'
		);
	}, [billingStatsError, billingStatsErrorObject]);

	const statsSummary = useMemo(() => {
		if (!billingStats) {
			return null;
		}

		const dailyUsagePercent =
			billingStats.daily_limit > 0
				? (billingStats.daily_used / billingStats.daily_limit) * 100
				: 0;

		const monthlyUsagePercent =
			billingStats.monthly_limit > 0
				? (billingStats.monthly_used / billingStats.monthly_limit) * 100
				: 0;

		return {
			availableCredits: billingStats.available_credits ?? 0,
			dailyUsed: billingStats.daily_used ?? 0,
			dailyLimit: billingStats.daily_limit ?? 0,
			dailyUsagePercent,
			monthlyUsed: billingStats.monthly_used ?? 0,
			monthlyLimit: billingStats.monthly_limit ?? 0,
			monthlyUsagePercent,
			totalUsed: billingStats.total_used ?? 0,
		};
	}, [billingStats]);

	// ✅ FIX: Все хуки должны быть вызваны до любых условных возвратов
	const billingCreditsLabel: string | null = useMemo(() => {
		if (!statsSummary) {
			return null;
		}

		return statsSummary.availableCredits.toLocaleString();
	}, [statsSummary]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="flex items-center space-x-2">
					<ArrowPathIcon className="w-6 h-6 animate-spin" />
					<span>Загрузка биллинга...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full p-6 space-y-6">
			{/* Header */}
			<div className="bg-linear-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold flex items-center gap-2">
							<CreditCardIcon className="w-8 h-8" />
							Биллинг UGS
						</h1>
						<p className="text-purple-100 mt-2">
							Покупка кредитов и контроль расхода UGS
						</p>
					</div>

					{statsSummary && !billingStatsError && (
						<div className="text-right">
							<div className="text-2xl font-bold flex items-center gap-2">
								<BanknotesIcon className="w-6 h-6" />
								{billingCreditsLabel} кред.
							</div>
							<div className="text-sm text-purple-200">
								Сегодня: {statsSummary.dailyUsed}/{statsSummary.dailyLimit}{' '}
								использовано
							</div>
						</div>
					)}
					{billingStatsErrorMessage && (
						<div className="text-right text-sm text-red-100">
							{billingStatsErrorMessage}
						</div>
					)}
				</div>
			</div>

			{/* Navigation Tabs */}
			<div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
				{[
					{ id: 'packages', label: 'Пакеты кредитов', icon: CubeIcon },
					{ id: 'history', label: 'История покупок', icon: DocumentTextIcon },
					{
						id: 'stats',
						label: 'Статистика использования',
						icon: ArrowTrendingUpIcon,
					},
				].map((tab) => (
					<button
						type="button"
						key={tab.id}
						onClick={() =>
							setActiveTab(tab.id as 'packages' | 'history' | 'stats')
						}
						className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
							activeTab === tab.id
								? 'bg-white text-gray-900 shadow-xs'
								: 'text-gray-600 hover:text-gray-900'
						}`}
					>
						<tab.icon className="w-4 h-4" />
						{tab.label}
					</button>
				))}
			</div>

			{/* Content */}
			<AnimatePresence mode="wait">
				{activeTab === 'packages' && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className="space-y-6"
					>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{packages.map((pkg) => (
								<motion.div
									key={pkg.id}
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow"
								>
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-2">
											<CubeIcon className="w-5 h-5 text-blue-600" />
											<h3 className="font-semibold text-lg">
												{pkg.display_name}
											</h3>
										</div>
										{pkg.credits_amount >= 1000 && (
											<StarIcon className="w-5 h-5 text-yellow-500" />
										)}
									</div>

									<p className="text-gray-600 text-sm mb-4">
										{pkg.description}
									</p>

									<div className="space-y-2 mb-6">
										<div className="flex items-center justify-between">
											<span className="text-gray-600">Кредиты:</span>
											<span className="font-semibold text-lg text-green-600">
												{pkg.credits_amount.toLocaleString()}
											</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-gray-600">Стоимость:</span>
											<span className="font-semibold text-xl">
												{formatCurrency(pkg.price_usd, pkg.currency)}
											</span>
										</div>
										<div className="text-xs text-gray-500">
											$
											{(
												pkg.price_per_1k_credits ??
												(pkg.credits_amount > 0
													? (pkg.price_usd / pkg.credits_amount) * 1000
													: 0)
											).toFixed(2)}{' '}
											за 1K кредитов
										</div>
									</div>

									<button
										type="button"
										onClick={() => handlePurchase(pkg.package_name)}
										disabled={purchasing === pkg.package_name}
										className="w-full bg-linear-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
									>
										{purchasing === pkg.package_name ? (
											<>
												<ArrowPathIcon className="w-4 h-4 animate-spin" />
												Обработка...
											</>
										) : (
											<>
												<ShoppingCartIcon className="w-4 h-4" />
												Купить пакет
											</>
										)}
									</button>
								</motion.div>
							))}
						</div>
					</motion.div>
				)}

				{activeTab === 'history' && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
					>
						<div className="p-6 border-b border-gray-200">
							<h2 className="text-xl font-semibold flex items-center gap-2">
								<DocumentTextIcon className="w-5 h-5" />
								История покупок
							</h2>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Дата
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Пакет
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Кредиты
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Сумма
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Баланс после
										</th>
									</tr>
								</thead>
								<tbody className="bg-white divide-y divide-gray-200">
									{purchaseHistory.map((purchase) => (
										<tr key={purchase.id} className="hover:bg-gray-50">
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{formatDate(purchase.created_at)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
												{purchase.display_name || purchase.package_name}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
												+{purchase.amount.toLocaleString()}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{purchase.payment_method && (
													<span className="capitalize">
														{purchase.payment_method}
													</span>
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{purchase.balance_after.toLocaleString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</motion.div>
				)}

				{activeTab === 'stats' && statsSummary && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
					>
						<div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600">
										Доступно кредитов
									</p>
									<p className="text-2xl font-bold text-green-600">
										{statsSummary.availableCredits.toLocaleString()}
									</p>
								</div>
								<BanknotesIcon className="w-8 h-8 text-green-600" />
							</div>
						</div>

						<div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600">
										Дневное использование
									</p>
									<p className="text-2xl font-bold text-blue-600">
										{statsSummary.dailyUsed}/{statsSummary.dailyLimit}
									</p>
									<p className="text-xs text-gray-500">
										{statsSummary.dailyLimit > 0
											? `${statsSummary.dailyUsagePercent.toFixed(1)}% использовано`
											: 'Дневной лимит не задан'}
									</p>
								</div>
								<ArrowTrendingUpIcon className="w-8 h-8 text-blue-600" />
							</div>
						</div>

						<div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600">
										Месячное использование
									</p>
									<p className="text-2xl font-bold text-purple-600">
										{statsSummary.monthlyUsed}/{statsSummary.monthlyLimit}
									</p>
									<p className="text-xs text-gray-500">
										{statsSummary.monthlyLimit > 0
											? `${statsSummary.monthlyUsagePercent.toFixed(1)}% использовано`
											: 'Месячный лимит не задан'}
									</p>
								</div>
								<SignalIcon className="w-8 h-8 text-purple-600" />
							</div>
						</div>

						<div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600">
										Использовано всего
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{statsSummary.totalUsed.toLocaleString()}
									</p>
									<p className="text-xs text-gray-500">За всё время</p>
								</div>
								<ChartBarSquareIcon className="w-8 h-8 text-gray-600" />
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default UGSBilling;
