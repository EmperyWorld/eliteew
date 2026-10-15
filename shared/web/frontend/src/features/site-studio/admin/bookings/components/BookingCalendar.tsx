import { Button } from '@components/atoms/Button';
import type {
	AdminBookingStatus,
	AdminBookingWithSlotInfo,
} from '@services/api/bookings';
import * as React from 'react';
import { useMemo } from 'react';
import {
	CalendarDaysIcon,
	CheckIcon,
	ClockIcon,
	MapPinIcon,
	UsersIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

function parseMinutes(time: string): number | null {
	const [h, m] = time.split(':').map(Number);
	if (Number.isNaN(h) || Number.isNaN(m)) return null;
	return h * 60 + m;
}

type StatusKey = AdminBookingStatus;

const statusColors: Record<
	StatusKey,
	{ pill: string; text: string; ring: string; dot: string; bg: string }
> = {
	pending: {
		pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
		text: 'text-amber-700 dark:text-amber-300',
		ring: 'ring-amber-400/60',
		dot: 'bg-amber-500',
		bg: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-amber-900/10',
	},
	confirmed: {
		pill: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
		text: 'text-blue-700 dark:text-blue-300',
		ring: 'ring-blue-400/60',
		dot: 'bg-blue-500',
		bg: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10',
	},
	completed: {
		pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
		text: 'text-emerald-700 dark:text-emerald-300',
		ring: 'ring-emerald-400/60',
		dot: 'bg-emerald-500',
		bg: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10',
	},
	cancelled: {
		pill: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
		text: 'text-red-700 dark:text-red-300',
		ring: 'ring-red-400/60',
		dot: 'bg-red-500',
		bg: 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/10',
	},
};

interface BookingCalendarProps {
	bookings: AdminBookingWithSlotInfo[];
	onUpdateStatus: (id: string, status: AdminBookingStatus) => void;
	onNavigateToSchedule: (dateRaw: string) => void;
	onDuplicate?: (booking: AdminBookingWithSlotInfo) => void;
	selectedIds?: Set<string>;
	onToggleSelect?: (id: string, checked: boolean) => void;
	onSelectDay?: (ids: string[]) => void;
	getTags?: (booking: AdminBookingWithSlotInfo) => string[];
	onToggleTag?: (booking: AdminBookingWithSlotInfo, tag: string) => void;
	getNote?: (booking: AdminBookingWithSlotInfo) => string;
	onChangeNote?: (booking: AdminBookingWithSlotInfo, note: string) => void;
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
	bookings,
	onUpdateStatus,
	onNavigateToSchedule,
	onDuplicate,
	selectedIds,
	onToggleSelect,
	onSelectDay,
	getTags,
	onToggleTag,
	getNote,
	onChangeNote,
}) => {
	const grouped = useMemo(() => {
		const map = new Map<string, AdminBookingWithSlotInfo[]>();
		bookings.forEach((b) => {
			let key = b.dateRaw;
			try {
				key = new Date(b.dateRaw).toISOString().split('T')[0];
			} catch {
				// keep as is
			}
			if (!map.has(key)) map.set(key, []);
			const list = map.get(key);
			if (list) list.push(b);
		});
		return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
	}, [bookings]);

	const dayMeta = useMemo(() => {
		const meta = new Map<
			string,
			{
				conflicts: Set<string>;
				freeWindows: number;
				pending: number;
				confirmed: number;
			}
		>();
		grouped.forEach(([dateKey, items]) => {
			const timeMap = new Map<string, number>();
			let pending = 0;
			let confirmed = 0;
			items.forEach((b) => {
				const t = b.slotInfo.time;
				timeMap.set(t, (timeMap.get(t) ?? 0) + 1);
				if (b.status === 'pending') pending += 1;
				if (b.status === 'confirmed') confirmed += 1;
			});
			const conflicts = new Set<string>();
			timeMap.forEach((count, time) => {
				if (count > 1) conflicts.add(time);
			});

			// Estimate free windows by gaps >= 60 min between sorted times
			const minutes = items
				.map((b) => parseMinutes(b.slotInfo.time))
				.filter((v): v is number => v !== null)
				.sort((a, b) => a - b);
			let freeWindows = 0;
			for (let i = 0; i < minutes.length - 1; i++) {
				const gap = minutes[i + 1] - minutes[i];
				if (gap >= 60) freeWindows += 1;
			}

			meta.set(dateKey, { conflicts, freeWindows, pending, confirmed });
		});
		return meta;
	}, [grouped]);

	const formatDate = (date: string) => {
		const d = new Date(date);
		const today = new Date();
		const tomorrow = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate() + 1
		);
		const base = d.toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'long',
			weekday: 'short',
		});
		const iso = d.toISOString().split('T')[0];
		const todayIso = today.toISOString().split('T')[0];
		const tomorrowIso = tomorrow.toISOString().split('T')[0];
		if (iso === todayIso) return `Сегодня · ${base}`;
		if (iso === tomorrowIso) return `Завтра · ${base}`;
		return base;
	};

	if (!grouped.length) {
		return (
			<div className="p-12 text-center bg-white dark:bg-slate-800/70 rounded-2xl border border-neutral-200 dark:border-slate-700">
				<CalendarDaysIcon className="w-10 h-10 text-neutral-400 dark:text-slate-500 mx-auto mb-3" />
				<p className="text-neutral-600 dark:text-slate-400">
					Нет записей для выбранных фильтров
				</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{grouped.map(([dateKey, items]) => {
				const dm = dayMeta.get(dateKey);
				return (
					<div
						key={dateKey}
						className="rounded-2xl border border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-900/85 shadow-md overflow-hidden"
					>
						<div className="px-5 py-4 flex items-center justify-between border-b border-neutral-200 dark:border-slate-600 bg-neutral-50/80 dark:bg-slate-800/90">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-neutral-100 dark:bg-slate-700 rounded-xl">
									<CalendarDaysIcon className="w-5 h-5 text-neutral-500 dark:text-slate-300" />
								</div>
								<div>
									<p className="font-semibold text-neutral-900 dark:text-white">
										{formatDate(dateKey)}
									</p>
									<p className="text-sm text-neutral-500 dark:text-slate-400">
										{items.length} запис.
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{onSelectDay && items.length > 1 && (
									<Button
										size="sm"
										variant="ghost"
										className="text-xs text-neutral-500 hover:text-primary-600"
										onClick={() => onSelectDay(items.map((i) => i.id))}
									>
										Выбрать все
									</Button>
								)}
								<Button
									size="sm"
									variant="outline"
									className="text-xs dark:border-slate-600 dark:text-slate-200"
									onClick={() => onNavigateToSchedule(dateKey)}
								>
									Открыть день
								</Button>
							</div>
						</div>

						{/* Day meta badges */}
						<div className="px-5 pb-2 flex gap-2 flex-wrap">
							{dm?.conflicts.size ? (
								<span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200">
									Конфликтов: {dm.conflicts.size}
								</span>
							) : (
								<span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200">
									Конфликтов нет
								</span>
							)}
							{dm?.freeWindows ? (
								<span className="px-2 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200">
									Свободных окон: {dm.freeWindows}
								</span>
							) : null}
							{dm && (
								<>
									<span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200">
										Новых: {dm.pending}
									</span>
									<span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200">
										Подтв.: {dm.confirmed}
									</span>
								</>
							)}
						</div>

						<div className="divide-y divide-neutral-200 dark:divide-slate-600">
							{items
								.sort((a, b) => a.slotInfo.time.localeCompare(b.slotInfo.time))
								.map((booking) => {
									const status = statusColors[booking.status];
									const conflict = dm?.conflicts.has(booking.slotInfo.time);
									const isSelected = selectedIds?.has(booking.id);
									const tags = getTags ? getTags(booking) : [];
									const note = getNote ? getNote(booking) : '';
									return (
										<div
											key={booking.id}
											className="p-4 flex flex-col md:flex-row gap-3 items-start bg-neutral-50/90 dark:bg-slate-800/95 border-l-4 border-l-transparent hover:border-l-primary-400/80 dark:hover:border-l-primary-500/70 transition-colors"
										>
											<div
												className={`w-10 h-10 rounded-xl flex items-center justify-center ring-2 ${status.ring} ring-offset-2 dark:ring-offset-slate-900`}
											>
												<span
													className={`w-2 h-2 rounded-full ${status.dot}`}
												/>
											</div>
											<div className="flex-1 min-w-0 w-full md:w-auto">
												<div className="flex items-center gap-2 flex-wrap">
													<span className="text-sm font-semibold text-neutral-900 dark:text-white truncate max-w-[200px]">
														{booking.customerName}
													</span>
													<span
														className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.pill}`}
													>
														{booking.status === 'pending'
															? 'Ожидает'
															: booking.status === 'confirmed'
																? 'Подтверждено'
																: booking.status === 'completed'
																	? 'Завершено'
																	: 'Отменено'}
													</span>
													{conflict && (
														<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200">
															Конфликт времени
														</span>
													)}
													<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300">
														{booking.slotInfo.type === 'consultation'
															? 'Консультация'
															: 'Мастер-класс'}
													</span>
												</div>
												<p className="text-sm text-neutral-600 dark:text-slate-400 line-clamp-2">
													{booking.slotInfo.title}
												</p>
												<div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-slate-400 mt-2 flex-wrap">
													<span className="flex items-center gap-1.5">
														<ClockIcon width={14} height={14} />{' '}
														{booking.slotInfo.time}
													</span>
													{booking.slotInfo.type === 'consultation' ? (
														<span className="flex items-center gap-1.5">
															<MapPinIcon width={14} height={14} />{' '}
															Онлайн/офлайн
														</span>
													) : (
														<span className="flex items-center gap-1.5">
															<UsersIcon width={14} height={14} /> Участников:{' '}
															{booking.participants}
														</span>
													)}
													{booking.status === 'pending' && (
														<span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-300">
															<ClockIcon width={14} height={14} /> Ждёт
															подтверждения
														</span>
													)}
												</div>
											</div>
											<div className="flex flex-col gap-1 items-stretch md:items-end w-full md:w-auto mt-2 md:mt-0">
												{onToggleSelect && (
													<label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
														<input
															type="checkbox"
															checked={isSelected}
															onChange={(e) =>
																onToggleSelect(booking.id, e.target.checked)
															}
															className="h-4 w-4 rounded border-neutral-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
														/>
														Выбрать
													</label>
												)}
												{booking.status === 'pending' && (
													<>
														<Button
															size="sm"
															className="text-xs bg-emerald-600 hover:bg-emerald-500"
															onClick={() =>
																onUpdateStatus(booking.id, 'confirmed')
															}
														>
															<CheckIcon
																width={14}
																height={14}
																className="mr-1"
															/>{' '}
															Подтв.
														</Button>
														<Button
															size="sm"
															variant="outline"
															className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
															onClick={() =>
																onUpdateStatus(booking.id, 'cancelled')
															}
														>
															<XMarkIcon
																width={14}
																height={14}
																className="mr-1"
															/>{' '}
															Отмена
														</Button>
													</>
												)}
												{booking.status === 'confirmed' && (
													<Button
														size="sm"
														className="text-xs"
														onClick={() =>
															onUpdateStatus(booking.id, 'completed')
														}
													>
														Завершить
													</Button>
												)}
												{onDuplicate && (
													<Button
														variant="ghost"
														size="sm"
														className="text-xs text-neutral-500 hover:text-primary-600"
														onClick={() => onDuplicate(booking)}
													>
														Дублировать
													</Button>
												)}
												{/* Tags inline */}
												{onToggleTag && (
													<div className="flex flex-wrap gap-1 justify-start md:justify-end mt-2">
														{[
															'VIP',
															'Опоздания',
															'No-show',
															'Перезвонить',
															'Приоритет',
														].map((tag) => {
															const active = tags.includes(tag);
															return (
																<button
																	type="button"
																	key={tag}
																	onClick={() => onToggleTag(booking, tag)}
																	className={`px-2 py-1 text-[11px] rounded-full border transition ${
																		active
																			? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-primary-200 dark:border-primary-700'
																			: 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300 border-transparent hover:border-neutral-200 dark:hover:border-slate-600'
																	}`}
																>
																	{tag}
																</button>
															);
														})}
													</div>
												)}
												{/* Note inline */}
												{onChangeNote && (
													<textarea
														className="w-full mt-2 text-xs rounded-lg border border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-900/40 text-neutral-700 dark:text-slate-200 p-2 resize-none"
														rows={2}
														placeholder="Быстрая заметка по клиенту"
														value={note}
														onChange={(e) =>
															onChangeNote(booking, e.target.value)
														}
													/>
												)}
											</div>
										</div>
									);
								})}
						</div>
					</div>
				);
			})}
		</div>
	);
};
