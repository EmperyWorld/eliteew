import { Button } from '@components/atoms/Button';
import React, { useEffect, useRef } from 'react';
import {
	ArrowTopRightOnSquareIcon,
	CalendarIcon,
	ChatBubbleLeftRightIcon,
	CreditCardIcon,
	CubeIcon,
	DocumentDuplicateIcon,
	EnvelopeIcon,
	MapPinIcon,
	PhoneIcon,
	TrashIcon,
	TruckIcon,
	UserIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { OrderStatusTimeline } from './OrderStatusTimeline';

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

interface OrderDetailModalProps {
	order: Order;
	onClose: () => void;
	onStatusChange: (status: string) => void;
	onPaymentStatusChange: (status: string) => void;
	onDelete: () => void;
	isUpdating: boolean;
}

const paymentMethodLabels: Record<string, string> = {
	card: 'Банковская карта',
	cash: 'Наличные',
	transfer: 'Перевод',
};

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
	order,
	onClose,
	onStatusChange,
	onPaymentStatusChange,
	onDelete,
	isUpdating,
}) => {
	const closeBtnRef = useRef<HTMLButtonElement>(null);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	useEffect(() => {
		closeBtnRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [onClose]);

	const formatPrice = (price: number) => `${price.toLocaleString('ru-RU')} ₽`;

	const formatDate = (date: string) => {
		return new Date(date).toLocaleString('ru-RU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const copyOrderNumber = () => {
		navigator.clipboard.writeText(order.orderNumber);
	};

	return (
		<div
			className="fixed inset-0 flex items-start justify-center pt-20 sm:pt-24 px-4 sm:px-6"
			style={{ zIndex: embeddedModalZ.backdrop }}
		>
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
				onClick={onClose}
				aria-hidden
			/>

			{/* Modal */}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="order-detail-title"
				className="relative w-full max-w-3xl max-h-[calc(100vh-7rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300"
				style={{ zIndex: embeddedModalZ.content }}
			>
				{/* Header */}
				<div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-neutral-100 dark:border-slate-800 px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="p-2 bg-linear-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-xl">
								<CubeIcon
									className="text-primary-600 dark:text-primary-400"
									width={20}
									height={20}
								/>
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h2
										id="order-detail-title"
										className="text-xl font-bold text-neutral-900 dark:text-white"
									>
										Заказ #{order.orderNumber}
									</h2>
									<button
										type="button"
										onClick={copyOrderNumber}
										className="p-1 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300"
										title="Копировать номер"
									>
										<DocumentDuplicateIcon width={14} height={14} />
									</button>
								</div>
								<p className="text-sm text-neutral-500 dark:text-slate-400 flex items-center gap-1">
									<CalendarIcon width={12} height={12} />
									{formatDate(order.createdAt)}
								</p>
							</div>
						</div>
						<button
							ref={closeBtnRef}
							type="button"
							onClick={onClose}
							className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-xl text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
							aria-label="Закрыть"
						>
							<XMarkIcon width={20} height={20} />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
					{/* Status Timeline */}
					<div className="bg-neutral-50 dark:bg-slate-800/50 rounded-2xl p-5">
						<h3 className="font-semibold text-neutral-900 dark:text-white mb-4">
							Статус заказа
						</h3>
						<OrderStatusTimeline
							currentStatus={order.status}
							paymentStatus={order.paymentStatus}
							createdAt={order.createdAt}
							onStatusChange={onStatusChange}
							isUpdating={isUpdating}
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Customer Info */}
						<div className="bg-neutral-50 dark:bg-slate-800/50 rounded-2xl p-5">
							<h3 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
								<UserIcon width={16} height={16} className="text-primary-500" />
								Покупатель
							</h3>
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-linear-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
										{order.customerName.charAt(0).toUpperCase()}
									</div>
									<div>
										<p className="font-medium text-neutral-900 dark:text-white">
											{order.customerName}
										</p>
										{order.user && (
											<p className="text-xs text-primary-600 dark:text-primary-400">
												Зарегистрирован
											</p>
										)}
									</div>
								</div>

								<div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-slate-700">
									<a
										href={`tel:${order.customerPhone}`}
										className="flex items-center gap-2 text-sm text-neutral-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
									>
										<PhoneIcon width={14} height={14} />
										{order.customerPhone}
									</a>
									{order.customerEmail && (
										<a
											href={`mailto:${order.customerEmail}`}
											className="flex items-center gap-2 text-sm text-neutral-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
										>
											<EnvelopeIcon width={14} height={14} />
											{order.customerEmail}
										</a>
									)}
								</div>
							</div>
						</div>

						{/* Delivery Info */}
						<div className="bg-neutral-50 dark:bg-slate-800/50 rounded-2xl p-5">
							<h3 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
								<TruckIcon width={16} height={16} className="text-indigo-500" />
								Доставка
							</h3>
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-neutral-500 dark:text-slate-400">
										Способ
									</span>
									<span
										className={`
                    px-2.5 py-1 rounded-full text-xs font-semibold
                    ${
											order.deliveryMethod === 'delivery'
												? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
												: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
										}
                  `}
									>
										{order.deliveryMethod === 'delivery'
											? '🚚 Доставка'
											: '📦 Самовывоз'}
									</span>
								</div>

								{order.deliveryCity && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-neutral-500 dark:text-slate-400">
											Город
										</span>
										<span className="text-sm font-medium text-neutral-900 dark:text-white">
											{order.deliveryCity}
										</span>
									</div>
								)}

								{order.deliveryAddress && (
									<div className="pt-2 border-t border-neutral-200 dark:border-slate-700">
										<div className="flex items-start gap-2 text-sm">
											<MapPinIcon
												width={14}
												height={14}
												className="text-neutral-400 mt-0.5 shrink-0"
											/>
											<span className="text-neutral-700 dark:text-slate-300">
												{order.deliveryAddress}
											</span>
										</div>
									</div>
								)}

								<div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-slate-700">
									<span className="text-sm text-neutral-500 dark:text-slate-400">
										Оплата
									</span>
									<div className="flex items-center gap-1.5">
										<CreditCardIcon
											width={14}
											height={14}
											className="text-neutral-400"
										/>
										<span className="text-sm font-medium text-neutral-900 dark:text-white">
											{paymentMethodLabels[order.paymentMethod] ||
												order.paymentMethod}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Payment Status Quick Toggle */}
					<div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-slate-800/50 rounded-2xl">
						<span className="text-sm font-medium text-neutral-700 dark:text-slate-300">
							Статус оплаты
						</span>
						<div className="flex gap-2">
							{['pending', 'PAID', 'REFUNDED'].map((status) => (
								<button
									type="button"
									key={status}
									onClick={() => onPaymentStatusChange(status)}
									disabled={isUpdating || order.paymentStatus === status}
									className={`
                    px-3 py-1.5 rounded-lg text-xs font-semibold transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none disabled:opacity-50
                    ${
											order.paymentStatus === status
												? status === 'PAID'
													? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
													: status === 'REFUNDED'
														? 'bg-neutral-500 text-white'
														: 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
												: 'bg-neutral-200 dark:bg-slate-700 text-neutral-600 dark:text-slate-400 hover:bg-neutral-300 dark:hover:bg-slate-600'
										}
                  `}
								>
									{status === 'PAID'
										? 'Оплачен'
										: status === 'REFUNDED'
											? 'Возврат'
											: 'Ожидает'}
								</button>
							))}
						</div>
					</div>

					{/* Order Items */}
					<div>
						<h3 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
							<CubeIcon width={16} height={16} className="text-purple-500" />
							Товары ({order.items.length})
						</h3>
						<div className="space-y-3">
							{order.items.map((item) => {
								const productName =
									item.product.name || item.product.title || 'Товар';
								const productImage =
									item.product.image || item.product.imageUrl;
								const volumeDisplay = item.variant?.volume || item.volume;

								return (
									<div
										key={item.id}
										className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-slate-800/50 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors group"
									>
										{/* Image */}
										<div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-200 dark:bg-slate-700 shrink-0">
											{productImage ? (
												<img
													src={productImage}
													alt={productName}
													className="w-full h-full object-cover"
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center">
													<CubeIcon
														width={24}
														height={24}
														className="text-neutral-400 dark:text-slate-500"
													/>
												</div>
											)}
											<div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
												{item.quantity}
											</div>
										</div>

										{/* Info */}
										<div className="flex-1 min-w-0">
											<p className="font-medium text-neutral-900 dark:text-white truncate">
												{productName}
											</p>
											<div className="flex items-center gap-2 mt-1">
												{volumeDisplay && (
													<span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-medium">
														{volumeDisplay}
													</span>
												)}
												<span className="text-sm text-neutral-500 dark:text-slate-400">
													{formatPrice(item.price)} × {item.quantity}
												</span>
											</div>
										</div>

										{/* Total */}
										<div className="text-right">
											<p className="font-bold text-neutral-900 dark:text-white">
												{formatPrice(item.price * item.quantity)}
											</p>
										</div>

										{/* Link to product */}
										<a
											href={`/admin/products/${item.product.id}`}
											className="p-2 opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-slate-700 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300 transition-[color,background-color,opacity] duration-200 motion-reduce:transition-none"
											title="Открыть товар"
										>
											<ArrowTopRightOnSquareIcon width={16} height={16} />
										</a>
									</div>
								);
							})}
						</div>
					</div>

					{/* Total */}
					<div className="bg-linear-to-r from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20 rounded-2xl p-5 border border-primary-100 dark:border-primary-800/30">
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-neutral-600 dark:text-slate-400">
									Товары:
								</span>
								<span className="text-neutral-900 dark:text-white">
									{formatPrice(order.subtotal)}
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-neutral-600 dark:text-slate-400">
									Доставка:
								</span>
								<span className="text-neutral-900 dark:text-white">
									{order.deliveryPrice > 0
										? formatPrice(order.deliveryPrice)
										: 'Бесплатно'}
								</span>
							</div>
							<div className="flex justify-between pt-2 border-t border-primary-200 dark:border-primary-800">
								<span className="text-lg font-bold text-neutral-900 dark:text-white">
									Итого:
								</span>
								<span className="text-xl font-bold text-primary-600 dark:text-primary-400">
									{formatPrice(order.totalPrice)}
								</span>
							</div>
						</div>
					</div>

					{/* Notes */}
					{order.notes && (
						<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
							<h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
								<ChatBubbleLeftRightIcon width={16} height={16} />
								Комментарий к заказу
							</h3>
							<p className="text-sm text-amber-700 dark:text-amber-300">
								{order.notes}
							</p>
						</div>
					)}

					{/* Danger Zone */}
					<div className="border-t border-neutral-200 dark:border-slate-700 pt-6">
						<div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
							<div>
								<p className="font-medium text-red-700 dark:text-red-400">
									Удалить заказ
								</p>
								<p className="text-sm text-red-600/70 dark:text-red-400/70">
									Действие необратимо
								</p>
							</div>
							<Button
								variant="ghost"
								onClick={onDelete}
								className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
							>
								<TrashIcon width={16} height={16} className="mr-1" />
								Удалить
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
