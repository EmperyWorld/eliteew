import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { apiClient } from '@services/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckCircleIcon,
	ClockIcon,
	CubeIcon,
	CurrencyDollarIcon,
	FunnelIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	ShoppingBagIcon,
	Squares2X2Icon,
	TruckIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { AdminLink as Link } from '../components/AdminLink';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminSectionCard } from '../components/AdminSectionCard';
import { formatRubles } from '../utils/formatCurrency';
import { OrderCard } from './components/OrderCard';
import { OrderDetailModal } from './components/OrderDetailModal';
import { OrdersKanbanBoard } from './components/OrdersKanbanBoard';
import { OrdersSkeleton } from './components/OrdersSkeleton';
import { useOrdersSummary } from './useOrdersSummary';

function OrderListStaggerItem({
	index,
	children,
}: {
	index: number;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.animationDelay = `${index * 50}ms`;
		el.style.animationFillMode = 'backwards';
	}, [index]);
	return (
		<div ref={ref} className="animate-in fade-in slide-in-from-bottom-2">
			{children}
		</div>
	);
}

/** Edge Tools: literal `aria-pressed` (no `{expression}`). */
function OrdersFilterToggle({
	pressed,
	className,
	children,
	...rest
}: Omit<React.ComponentProps<'button'>, 'aria-pressed'> & {
	pressed: boolean;
}) {
	return pressed ? (
		<button type="button" aria-pressed="true" className={className} {...rest}>
			{children}
		</button>
	) : (
		<button type="button" aria-pressed="false" className={className} {...rest}>
			{children}
		</button>
	);
}

interface OrderItem {
	id: string;
	quantity: number;
	price: number;
	volume?: string;
	product: {
		id: string;
		name: string;
		title?: string;
		image?: string;
		imageUrl?: string;
	};
	variant?: {
		id: string;
		volume: string;
		price: number;
	};
}

interface Order {
	id: string;
	orderNumber: string;
	customerName: string;
	customerEmail?: string;
	customerPhone: string;
	deliveryMethod: string;
	deliveryAddress?: string;
	deliveryCity?: string;
	paymentMethod: string;
	subtotal: number;
	deliveryPrice: number;
	totalPrice: number;
	status: string;
	paymentStatus: string;
	notes?: string;
	items: OrderItem[];
	user?: {
		id: string;
		name: string;
		email: string;
	};
	createdAt: string;
}

const statusLabels: Record<string, string> = {
	PENDING: 'Новый',
	CONFIRMED: 'Подтверждён',
	PROCESSING: 'В обработке',
	SHIPPED: 'Отправлен',
	DELIVERED: 'Доставлен',
	CANCELLED: 'Отменён',
};

const statusColors: Record<string, string> = {
	PENDING:
		'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
	CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
	PROCESSING:
		'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
	SHIPPED:
		'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
	DELIVERED:
		'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
	CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const paymentStatusLabels: Record<string, string> = {
	pending: 'Ожидает оплаты',
	PAID: 'Оплачен',
	REFUNDED: 'Возврат',
};

const paymentStatusColors: Record<string, string> = {
	pending:
		'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
	PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
	REFUNDED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export const OrdersPage: React.FC = () => {
	const [statusFilter, setStatusFilter] = useState<string>('');
	const [searchQuery, setSearchQuery] = useState('');
	const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
	const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(
		null
	);
	const queryClient = useQueryClient();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	const { data, isLoading, isError, error, refetch } = useQuery<Order[], Error>(
		{
			queryKey: ['admin-orders', statusFilter] as const,
			queryFn: async () => {
				const params = statusFilter ? `?status=${statusFilter}` : '';
				const { data } = await apiClient.get<Order[]>(`/admin/orders${params}`);
				return data;
			},
			retry: 1,
		}
	);
	const { data: ordersSummary } = useOrdersSummary();

	const orders = useMemo(() => data ?? [], [data]);

	// FunnelIcon orders by search
	const filteredOrders = useMemo(() => {
		if (!searchQuery.trim()) return orders;
		const q = searchQuery.toLowerCase();
		return orders.filter(
			(o) =>
				o.orderNumber.toLowerCase().includes(q) ||
				o.customerName.toLowerCase().includes(q) ||
				o.customerPhone.includes(q) ||
				o.customerEmail?.toLowerCase().includes(q)
		);
	}, [orders, searchQuery]);

	// Stats — server summary over full order set
	const stats = useMemo(
		() => ({
			total: ordersSummary?.total ?? orders.length,
			pending: ordersSummary?.pending ?? 0,
			inProgress: ordersSummary?.inProgress ?? 0,
			delivered: ordersSummary?.delivered ?? 0,
			cancelled: ordersSummary?.cancelled ?? 0,
			totalRevenue: ordersSummary?.totalRevenue ?? 0,
		}),
		[ordersSummary, orders.length]
	);

	const exportOrdersCsv = (list: Order[]) => {
		if (list.length === 0) return;
		const cols = [
			'orderNumber',
			'customerName',
			'customerPhone',
			'customerEmail',
			'status',
			'paymentStatus',
			'totalPrice',
			'createdAt',
		] as const;
		const escapeCsvField = (v: string | number) =>
			`"${String(v).replace(/"/g, '""')}"`;
		const header = cols.join(',');
		const body = list
			.map((o) =>
				[
					o.orderNumber,
					o.customerName,
					o.customerPhone,
					o.customerEmail ?? '',
					o.status,
					o.paymentStatus,
					o.totalPrice,
					o.createdAt,
				]
					.map(escapeCsvField)
					.join(',')
			)
			.join('\n');
		const csv = `\ufeff${header}\n${body}`;
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const updateStatusMutation = useMutation({
		mutationFn: async ({
			id,
			status,
			paymentStatus,
		}: {
			id: string;
			status?: string;
			paymentStatus?: string;
		}) => {
			const { data } = await apiClient.patch(`/admin/orders/${id}`, {
				status,
				paymentStatus,
			});
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
			queryClient.invalidateQueries({ queryKey: ['admin-orders-summary'] });
		},
	});

	const deleteOrderMutation = useMutation({
		mutationFn: async (id: string) => {
			const { data } = await apiClient.delete(`/admin/orders/${id}`);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
			queryClient.invalidateQueries({ queryKey: ['admin-orders-summary'] });
			setSelectedOrder(null);
			setDeleteConfirmOrder(null);
		},
	});

	const isMutating =
		updateStatusMutation.isPending || deleteOrderMutation.isPending;

	const handleStatusChange = (status: string) => {
		if (selectedOrder) {
			updateStatusMutation.mutate({ id: selectedOrder.id, status });
		}
	};

	const handlePaymentStatusChange = (paymentStatus: string) => {
		if (selectedOrder) {
			updateStatusMutation.mutate({ id: selectedOrder.id, paymentStatus });
		}
	};

	if (isLoading) {
		return <OrdersSkeleton />;
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
				<div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full">
					<CubeIcon className="w-8 h-8 text-red-400" />
				</div>
				<p className="text-neutral-600 dark:text-slate-300 max-w-md text-sm">
					{error?.message ||
						'Не удалось загрузить заказы. Проверьте соединение и попробуйте снова.'}
				</p>
				<Button onClick={() => refetch()} variant="outline">
					<ArrowPathIcon width={16} height={16} className="mr-2" />
					Повторить загрузку
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow="Продажи"
				title="Заказы"
				titleIcon={
					<ShoppingBagIcon
						className="text-indigo-600 dark:text-indigo-400"
						width={24}
						height={24}
					/>
				}
				titleExtra={
					stats.pending > 0 ? (
						<span className="ml-2 px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full animate-pulse">
							{stats.pending} новых
						</span>
					) : null
				}
				description="Управление заказами магазина и статусами доставки"
				meta={
					<>
						<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-50/90 dark:bg-slate-900/70 border border-neutral-200/70 dark:border-slate-700/80 text-[11px] text-neutral-500 dark:text-slate-400">
							Всего:{' '}
							<span className="font-semibold text-neutral-800 dark:text-white">
								{stats.total}
							</span>
						</span>
						<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50/90 dark:bg-emerald-900/30 border border-emerald-100/80 dark:border-emerald-800/60 text-[11px] text-neutral-500 dark:text-slate-400">
							Выручка:{' '}
							<span className="font-semibold text-emerald-700 dark:text-emerald-300">
								{formatRubles(stats.totalRevenue, 'full')}
							</span>
						</span>
						{stats.cancelled > 0 ? (
							<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50/90 dark:bg-red-900/30 border border-red-100/80 dark:border-red-800/60 text-[11px] text-neutral-500 dark:text-slate-400">
								Отменено:{' '}
								<span className="font-semibold text-red-700 dark:text-red-300">
									{stats.cancelled}
								</span>
							</span>
						) : null}
					</>
				}
				actions={
					<>
						<Button
							type="button"
							variant="outline"
							onClick={() => exportOrdersCsv(filteredOrders)}
							disabled={filteredOrders.length === 0}
							className="dark:border-slate-600 dark:text-slate-200"
						>
							<ArrowDownTrayIcon width={16} height={16} className="mr-2" />
							CSV
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => refetch()}
							disabled={isLoading}
							className="dark:text-slate-300 dark:hover:bg-slate-800"
						>
							<ArrowPathIcon
								width={16}
								height={16}
								className={`mr-2 ${isLoading ? 'animate-spin' : ''}`}
							/>
							Обновить
						</Button>
					</>
				}
			/>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
				<div className="p-4 rounded-2xl border bg-white/90 dark:bg-slate-900/80 border-neutral-200/80 dark:border-slate-700/80 shadow-sm backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
								Всего
							</p>
							<p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
								{stats.total}
							</p>
						</div>
						<div className="p-2 bg-neutral-100 dark:bg-slate-700 rounded-lg">
							<CubeIcon
								width={18}
								height={18}
								className="text-neutral-500 dark:text-slate-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border-amber-200/60 dark:border-amber-700/40 shadow-sm backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
								Новые
							</p>
							<p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
								{stats.pending}
							</p>
						</div>
						<div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
							<ClockIcon
								width={18}
								height={18}
								className="text-amber-600 dark:text-amber-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border-blue-200/60 dark:border-blue-700/40 shadow-sm backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
								В работе
							</p>
							<p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
								{stats.inProgress}
							</p>
						</div>
						<div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
							<TruckIcon
								width={18}
								height={18}
								className="text-blue-600 dark:text-blue-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border-emerald-200/60 dark:border-emerald-700/40 shadow-sm backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
								Доставлено
							</p>
							<p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
								{stats.delivered}
							</p>
						</div>
						<div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
							<CheckCircleIcon
								width={18}
								height={18}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 border-red-200/60 dark:border-red-700/40 shadow-sm backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
								Отменено
							</p>
							<p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
								{stats.cancelled}
							</p>
						</div>
						<div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
							<XCircleIcon
								width={18}
								height={18}
								className="text-red-600 dark:text-red-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-slate-900 border-primary-200/60 dark:border-primary-700/40 shadow-sm backdrop-blur-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider">
								Выручка
							</p>
							<p className="text-xl font-bold text-primary-700 dark:text-primary-300 mt-1">
								{formatRubles(stats.totalRevenue, 'full')}
							</p>
						</div>
						<div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
							<CurrencyDollarIcon
								width={18}
								height={18}
								className="text-primary-600 dark:text-primary-400"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Filters */}
			<AdminSectionCard>
				<div
					className="flex flex-wrap gap-2 mb-4"
					role="toolbar"
					aria-label="Быстрый фильтр по статусу"
				>
					<OrdersFilterToggle
						pressed={statusFilter === ''}
						onClick={() => setStatusFilter('')}
						className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
							statusFilter === ''
								? 'bg-primary-100 text-primary-800 border-primary-300 dark:bg-primary-900/50 dark:text-primary-200 dark:border-primary-700'
								: 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
						}`}
					>
						Все
					</OrdersFilterToggle>
					{Object.entries(statusLabels).map(([value, label]) => (
						<OrdersFilterToggle
							key={value}
							pressed={statusFilter === value}
							onClick={() => setStatusFilter(value)}
							className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
								statusFilter === value
									? 'bg-primary-100 text-primary-800 border-primary-300 dark:bg-primary-900/50 dark:text-primary-200 dark:border-primary-700'
									: 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
							}`}
						>
							{label}
						</OrdersFilterToggle>
					))}
				</div>
				<div className="flex flex-col lg:flex-row gap-4">
					{/* MagnifyingGlassIcon */}
					<div className="relative flex-1">
						<MagnifyingGlassIcon
							className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
							width={18}
							height={18}
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Поиск по номеру, имени, телефону..."
							className="pl-10 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
						/>
					</div>

					{/* Status filter */}
					<div className="flex items-center gap-2">
						<FunnelIcon
							width={18}
							height={18}
							className="text-neutral-400 dark:text-slate-500"
						/>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="px-4 py-2.5 border border-neutral-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-900 text-neutral-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-700"
							aria-label="Фильтр по статусу"
						>
							<option value="">Все статусы</option>
							{Object.entries(statusLabels).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</div>

					{/* View mode toggle */}
					<div className="flex items-center bg-neutral-100/90 dark:bg-slate-800/90 p-1 rounded-xl">
						<button
							type="button"
							onClick={() => setViewMode('list')}
							className={`p-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
								viewMode === 'list'
									? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-primary-400'
									: 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300'
							}`}
							title="Список"
						>
							<ListBulletIcon width={18} height={18} />
						</button>
						<button
							type="button"
							onClick={() => setViewMode('board')}
							className={`p-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
								viewMode === 'board'
									? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-primary-400'
									: 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300'
							}`}
							title="Доска"
						>
							<Squares2X2Icon width={18} height={18} />
						</button>
					</div>
				</div>
			</AdminSectionCard>

			{/* Orders */}
			{filteredOrders.length === 0 ? (
				<div className="p-16 bg-white/95 dark:bg-slate-900/85 rounded-2xl border border-dashed border-neutral-200/90 dark:border-slate-700/80 text-center shadow-sm backdrop-blur-sm">
					<div className="w-20 h-20 mx-auto mb-6 bg-neutral-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner">
						<CubeIcon
							width={40}
							height={40}
							className="text-neutral-400 dark:text-slate-500"
						/>
					</div>
					<h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
						{searchQuery ? 'Заказы не найдены' : 'Заказов пока нет'}
					</h3>
					<p className="text-neutral-500 dark:text-slate-400 mb-4">
						{searchQuery
							? 'Попробуйте изменить параметры поиска'
							: 'Здесь появятся заказы из магазина после оформления на витрине'}
					</p>
					{!searchQuery ? (
						<Link
							to="/"
							className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
						>
							Перейти на витрину
						</Link>
					) : null}
				</div>
			) : viewMode === 'board' ? (
				<OrdersKanbanBoard
					orders={filteredOrders}
					onViewDetails={(order) => setSelectedOrder(order as Order)}
				/>
			) : (
				<div className="space-y-3">
					{filteredOrders.map((order: Order, index: number) => (
						<OrderListStaggerItem key={order.id} index={index}>
							<OrderCard
								order={order}
								statusLabels={statusLabels}
								statusColors={statusColors}
								paymentStatusLabels={paymentStatusLabels}
								paymentStatusColors={paymentStatusColors}
								onViewDetails={(o) => setSelectedOrder(o as Order)}
								onDelete={(o) => setDeleteConfirmOrder(o as Order)}
								isMutating={isMutating}
							/>
						</OrderListStaggerItem>
					))}
				</div>
			)}

			{/* Delete Confirm Modal */}
			{deleteConfirmOrder && (
				<div
					className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
					style={{ zIndex: embeddedModalZ.backdrop }}
				>
					<div
						className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
						style={{ zIndex: embeddedModalZ.content }}
					>
						<div className="w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
							<XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
						</div>
						<div className="text-center">
							<h3 className="text-lg font-bold text-neutral-900 dark:text-white">
								Удалить заказ #{deleteConfirmOrder.orderNumber}?
							</h3>
							<p className="text-sm text-neutral-500 dark:text-slate-400 mt-1">
								Это действие необратимо
							</p>
						</div>
						<div className="flex gap-3 pt-2">
							<Button
								variant="outline"
								fullWidth
								onClick={() => setDeleteConfirmOrder(null)}
								disabled={isMutating}
								className="dark:border-slate-600 dark:text-slate-300"
							>
								Отмена
							</Button>
							<Button
								fullWidth
								onClick={() =>
									deleteOrderMutation.mutate(deleteConfirmOrder.id)
								}
								disabled={isMutating}
								className="bg-red-600 hover:bg-red-700 text-white"
							>
								{isMutating ? (
									<ArrowPathIcon className="w-4 h-4 animate-spin" />
								) : (
									'Удалить'
								)}
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Order Detail Modal */}
			{selectedOrder && (
				<OrderDetailModal
					order={selectedOrder}
					onClose={() => setSelectedOrder(null)}
					onStatusChange={handleStatusChange}
					onPaymentStatusChange={handlePaymentStatusChange}
					onDelete={() => {
						setDeleteConfirmOrder(selectedOrder);
					}}
					isUpdating={isMutating}
				/>
			)}
		</div>
	);
};
