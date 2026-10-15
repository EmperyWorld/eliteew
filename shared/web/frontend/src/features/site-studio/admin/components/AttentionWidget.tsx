import { Card } from '@components/atoms/Card';
import * as React from 'react';
import {
	ArrowRightIcon,
	BellIcon,
	CalendarIcon,
	ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { AdminLink as Link } from './AdminLink';

interface AttentionItemProps {
	icon: React.ComponentType<{
		className?: string;
		'aria-hidden'?: boolean;
	}>;
	label: string;
	count: number;
	to: string;
	colorClass: string;
	bgClass: string;
}

const AttentionItem: React.FC<AttentionItemProps> = ({
	icon: Icon,
	label,
	count,
	to,
	colorClass,
	bgClass,
}) => (
	<Link
		to={to}
		className={`flex min-h-11 items-center justify-between p-4 rounded-2xl border border-transparent ${bgClass} hover:shadow-xl hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 group`}
	>
		<div className="flex items-center gap-4">
			<div
				className={`p-2.5 rounded-2xl ${colorClass} shadow-sm group-hover:scale-110 transition-transform`}
			>
				<Icon className="h-[18px] w-[18px]" aria-hidden />
			</div>
			<div>
				<p className="font-semibold text-neutral-900 dark:text-white">
					{label}
				</p>
				<p className="text-xs text-neutral-500 dark:text-slate-400">
					Требуют внимания
				</p>
			</div>
		</div>
		<div className="flex items-center gap-3">
			<span className="relative flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-lg shadow-red-500/40">
				{count}
				<span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
			</span>
			<ArrowRightIcon
				width={16}
				height={16}
				className="text-neutral-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-[color,transform] motion-reduce:transition-none"
			/>
		</div>
	</Link>
);

interface AttentionWidgetProps {
	pendingOrders: number;
	pendingBookings: number;
}

export const AttentionWidget: React.FC<AttentionWidgetProps> = ({
	pendingOrders,
	pendingBookings,
}) => {
	if (pendingOrders === 0 && pendingBookings === 0) {
		return null;
	}

	return (
		<Card className="p-5 bg-linear-to-r from-red-50 via-orange-50/50 to-amber-50/30 border border-red-100/50">
			<div className="flex items-center gap-2 mb-4">
				<div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/40">
					<BellIcon
						className="text-red-500 dark:text-red-300"
						width={16}
						height={16}
					/>
				</div>
				<h2 className="font-semibold text-neutral-900 dark:text-white">
					Требует внимания
				</h2>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{pendingOrders > 0 && (
					<AttentionItem
						icon={ShoppingCartIcon}
						label="Новые заказы"
						count={pendingOrders}
						to="/admin/orders?status=PENDING"
						colorClass="bg-linear-to-br from-orange-100 to-orange-200 text-orange-600 dark:from-orange-900/40 dark:to-orange-800/40 dark:text-orange-200"
						bgClass="bg-white/80 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
					/>
				)}

				{pendingBookings > 0 && (
					<AttentionItem
						icon={CalendarIcon}
						label="Новые записи"
						count={pendingBookings}
						to="/admin/bookings?status=pending"
						colorClass="bg-linear-to-br from-purple-100 to-purple-200 text-purple-600 dark:from-purple-900/40 dark:to-purple-800/40 dark:text-purple-200"
						bgClass="bg-white/80 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
					/>
				)}
			</div>
		</Card>
	);
};
