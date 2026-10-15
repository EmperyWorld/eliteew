export interface RecentBookingProps {
	name: string;
	type: string;
	date: string;
	status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

const statusColors = {
	pending: 'bg-yellow-100 text-yellow-700',
	confirmed: 'bg-green-100 text-green-700',
	completed: 'bg-neutral-100 text-neutral-600',
	cancelled: 'bg-red-100 text-red-700',
} as const;

const statusLabels = {
	pending: 'Ожидает',
	confirmed: 'Подтверждено',
	completed: 'Завершено',
	cancelled: 'Отменено',
} as const;

export function RecentBooking({
	name,
	type,
	date,
	status,
}: RecentBookingProps) {
	return (
		<div className="flex items-center justify-between py-3.5 border-b border-neutral-100/80 dark:border-slate-800/60 last:border-0">
			<div className="min-w-0 pr-3">
				<p className="font-medium text-neutral-900 dark:text-white truncate">
					{name}
				</p>
				<p className="text-sm text-neutral-500 dark:text-slate-400 truncate">
					{type}
				</p>
			</div>
			<div className="text-right shrink-0">
				<span
					className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm ${statusColors[status] || statusColors.pending}`}
				>
					{statusLabels[status] || statusLabels.pending}
				</span>
				<p className="text-xs text-neutral-400 dark:text-slate-500 mt-1">
					{date}
				</p>
			</div>
		</div>
	);
}
