import * as React from 'react';
import {
	ClockIcon,
	CubeIcon,
	EyeIcon,
	MapPinIcon,
	PhoneIcon,
	TrashIcon,
	TruckIcon,
	UserIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@components/atoms/Button';

interface OrderItem {
	id: string;
	quantity: number;
	price: number;
	volume?: string;
	product: {
		id: string;
		name?: string;
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

interface OrderCardProps {
	order: Order;
	statusLabels: Record<string, string>;
	statusColors: Record<string, string>;
	paymentStatusLabels: Record<string, string>;
	paymentStatusColors: Record<string, string>;
	onViewDetails: (order: Order) => void;
	onDelete: (order: Order) => void;
	isMutating?: boolean;
}

const formatPrice = (price: number) => `${price.toLocaleString('ru-RU')} ₽`;

const formatDate = (date: string) => {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffHours < 1) return 'Только что';
	if (diffHours < 24) return `${diffHours}ч назад`;
	if (diffDays < 7) return `${diffDays}д назад`;

	return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export const OrderCard: React.FC<OrderCardProps> = ({
	order,
	statusLabels,
	statusColors,
	paymentStatusLabels,
	paymentStatusColors,
	onViewDetails,
	onDelete,
	isMutating,
}) => {
	const isNew = order.status === 'PENDING';
	const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

	return (
		<div
			className={`
        group relative bg-white dark:bg-slate-800 rounded-2xl border transition-[box-shadow,border-color] duration-300 motion-reduce:transition-none overflow-hidden
        ${
					isNew
						? 'border-amber-300 dark:border-amber-700 shadow-lg shadow-amber-100 dark:shadow-amber-900/20'
						: 'border-neutral-200 dark:border-slate-700 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800'
				}
      `}
		>
			{/* New order indicator */}
			{isNew && (
				<div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-400 to-orange-500" />
			)}

			<div className="p-5">
				<div className="flex items-start justify-between gap-4">
					{/* Left section */}
					<div className="flex items-start gap-4 min-w-0">
						{/* Avatar */}
						<div
							className={`
              w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg
              ${
								isNew
									? 'bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
									: 'bg-linear-to-br from-primary-400 to-primary-600 text-white'
							}
            `}
						>
							{order.customerName.charAt(0).toUpperCase()}
						</div>

						{/* Info */}
						<div className="min-w-0">
							<div className="flex items-center gap-2 mb-1">
								<h3 className="font-bold text-neutral-900 dark:text-white">
									#{order.orderNumber}
								</h3>
								{isNew && (
									<span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full animate-pulse">
										Новый!
									</span>
								)}
							</div>

							<div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-slate-400 mb-2">
								<span className="flex items-center gap-1">
									<UserIcon width={14} height={14} />
									{order.customerName}
								</span>
								<span className="flex items-center gap-1">
									<PhoneIcon width={14} height={14} />
									{order.customerPhone}
								</span>
							</div>

							<div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-500">
								<ClockIcon width={12} height={12} />
								{formatDate(order.createdAt)}
								<span className="text-neutral-300 dark:text-slate-600">•</span>
								{order.deliveryMethod === 'delivery' ? (
									<span className="flex items-center gap-1">
										<TruckIcon width={12} height={12} /> Доставка
									</span>
								) : (
									<span className="flex items-center gap-1">
										<MapPinIcon width={12} height={12} /> Самовывоз
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Right section */}
					<div className="flex flex-col items-end gap-2 shrink-0">
						{/* Status badges */}
						<div className="flex items-center gap-2">
							<span
								className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}
							>
								{statusLabels[order.status]}
							</span>
							<span
								className={`px-2.5 py-1 rounded-full text-xs font-semibold ${paymentStatusColors[order.paymentStatus]}`}
							>
								{order.paymentStatus === 'PAID' ? '✓ ' : ''}
								{paymentStatusLabels[order.paymentStatus] ||
									order.paymentStatus}
							</span>
						</div>

						{/* Price */}
						<p className="text-xl font-bold text-neutral-900 dark:text-white">
							{formatPrice(order.totalPrice)}
						</p>
					</div>
				</div>

				{/* Items Preview */}
				<div className="mt-4 pt-4 border-t border-neutral-100 dark:border-slate-700">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<CubeIcon
								width={14}
								height={14}
								className="text-neutral-400 dark:text-slate-500"
							/>
							<span className="text-sm text-neutral-600 dark:text-slate-400">
								{order.items.slice(0, 2).map((item: OrderItem, i: number) => {
									const productName =
										item.product.name || item.product.title || 'Товар';
									const volume = item.variant?.volume || item.volume;
									return (
										<span key={item.id}>
											{productName}
											{volume ? ` (${volume})` : ''} × {item.quantity}
											{i < Math.min(order.items.length, 2) - 1 ? ', ' : ''}
										</span>
									);
								})}
								{order.items.length > 2 && (
									<span className="text-neutral-400 dark:text-slate-500">
										{' '}
										и ещё {order.items.length - 2}...
									</span>
								)}
							</span>
						</div>
						<span className="text-xs text-neutral-400 dark:text-slate-500 px-2 py-1 bg-neutral-100 dark:bg-slate-700 rounded-full">
							{itemCount}{' '}
							{itemCount === 1 ? 'товар' : itemCount < 5 ? 'товара' : 'товаров'}
						</span>
					</div>
				</div>

				{/* Actions - visible on hover */}
				<div className="mt-4 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onViewDetails(order)}
						disabled={isMutating}
						className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
					>
						<EyeIcon width={14} height={14} className="mr-1.5" />
						Подробнее
					</Button>
					<button
						type="button"
						className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
						onClick={() => onDelete(order)}
						disabled={isMutating}
						aria-label="Удалить заказ"
					>
						<TrashIcon width={16} height={16} />
					</button>
				</div>
			</div>
		</div>
	);
};
