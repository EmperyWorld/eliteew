import React from 'react';
import {
	CheckCircleIcon,
	CubeIcon,
	ExclamationCircleIcon,
	TruckIcon,
} from '@heroicons/react/24/outline';
import { formatRubles } from '../../utils/formatCurrency';

// Define Order type locally if not exported, but ideally should be shared.
// For now, I'll copy the interface from OrdersPage to a types file or keep it here if I can't extract yet.
// Since I can't easily extract without editing OrdersPage first, I will define a minimal interface here or rely on 'any' temporarily
// but better to be type safe. I'll ask to create a types file first.

export interface OrderItem {
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

export interface Order {
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

interface OrdersKanbanBoardProps {
	orders: Order[];
	onViewDetails: (order: Order) => void;
}

const COLUMNS = [
	{
		id: 'PENDING',
		title: 'Новые',
		icon: ExclamationCircleIcon,
		color:
			'bg-yellow-100/60 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
	},
	{
		id: 'CONFIRMED',
		title: 'Подтверждены',
		icon: CheckCircleIcon,
		color:
			'bg-blue-100/60 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
	},
	{
		id: 'PROCESSING',
		title: 'В сборке',
		icon: CubeIcon,
		color:
			'bg-purple-100/60 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
	},
	{
		id: 'SHIPPED',
		title: 'Отправлены',
		icon: TruckIcon,
		color:
			'bg-indigo-100/60 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
	},
	{
		id: 'DELIVERED',
		title: 'Выполнены',
		icon: CheckCircleIcon,
		color:
			'bg-green-100/60 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-300',
	},
];

export const OrdersKanbanBoard: React.FC<OrdersKanbanBoardProps> = ({
	orders,
	onViewDetails,
}) => {
	const getOrdersByStatus = (status: string) => {
		return orders.filter((o) => o.status === status);
	};

	return (
		<div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-200px)] snap-x snap-mandatory md:snap-none">
			{COLUMNS.map((col) => {
				const colOrders = getOrdersByStatus(col.id);
				const Icon = col.icon;

				return (
					<div
						key={col.id}
						className="min-w-[280px] w-[min(300px,85vw)] shrink-0 flex flex-col gap-3 snap-start"
					>
						<div
							className={`flex items-center justify-between p-3 rounded-xl ${col.color} border border-neutral-200/60 dark:border-slate-700/70 shadow-sm`}
						>
							<div className="flex items-center gap-2 font-medium">
								<Icon width={18} height={18} />
								<span>{col.title}</span>
							</div>
							<span className="bg-white/90 dark:bg-slate-900/80 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
								{colOrders.length}
							</span>
						</div>

						<div className="flex-1 space-y-3">
							{colOrders.map((order) => (
								<button
									type="button"
									key={order.id}
									onClick={() => onViewDetails(order)}
									className="w-full text-left bg-white/95 dark:bg-slate-900/90 p-3 rounded-xl border border-neutral-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer transition-[box-shadow,transform,border-color] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 group backdrop-blur-sm"
								>
									<div className="flex justify-between items-start mb-2">
										<span className="font-mono text-xs font-bold text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
											#{order.orderNumber}
										</span>
										<span className="text-xs text-neutral-400 dark:text-slate-500">
											{new Date(order.createdAt).toLocaleDateString('ru-RU', {
												day: 'numeric',
												month: 'short',
											})}
										</span>
									</div>

									<div className="font-medium text-sm mb-1 line-clamp-1 text-neutral-900 dark:text-white">
										{order.customerName}
									</div>

									<div className="text-xs text-neutral-500 dark:text-slate-400 mb-2">
										{order.items.length} тов. •{' '}
										{formatRubles(order.totalPrice, 'full')}
									</div>

									<div className="flex items-center justify-between text-xs">
										<span
											className={`px-1.5 py-0.5 rounded ${
												order.paymentStatus === 'PAID'
													? 'bg-green-100 text-green-700 dark:bg-emerald-900/40 dark:text-emerald-300'
													: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
											}`}
										>
											{order.paymentStatus === 'PAID'
												? 'Оплачен'
												: 'Не оплачен'}
										</span>

										{order.deliveryMethod === 'delivery' && (
											<TruckIcon
												width={14}
												height={14}
												className="text-neutral-400 dark:text-slate-500"
											/>
										)}
									</div>
								</button>
							))}

							{colOrders.length === 0 && (
								<div className="h-24 border-2 border-dashed border-neutral-200/80 dark:border-slate-700/80 rounded-xl flex items-center justify-center text-neutral-400 dark:text-slate-500 text-sm">
									Пусто
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
};
