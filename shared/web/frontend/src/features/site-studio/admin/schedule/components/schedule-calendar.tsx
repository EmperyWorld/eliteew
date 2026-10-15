import { Card } from '@components/atoms/Card';
import type { ScheduleSlot } from '@typings/admin';
import { PlusIcon } from '@heroicons/react/24/outline';
interface ScheduleCalendarProps {
	currentDate: Date;
	selectedDate: string | null;
	slots: ScheduleSlot[];
	onSelectDate: (date: string) => void;
	onChangeMonth: (direction: 'prev' | 'next') => void;
	onAdd: (date: string) => void;
}

const months = [
	'Январь',
	'Февраль',
	'Март',
	'Апрель',
	'Май',
	'Июнь',
	'Июль',
	'Август',
	'Сентябрь',
	'Октябрь',
	'Ноябрь',
	'Декабрь',
];

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Stable keys for leading empty cells (max 6 before first day of month). */
const CAL_LEADING_EMPTY_KEYS = [
	'le0',
	'le1',
	'le2',
	'le3',
	'le4',
	'le5',
	'le6',
] as const;

function formatDateForInput(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getSlotsForDate(
	slots: ScheduleSlot[],
	dateStr: string
): ScheduleSlot[] {
	return slots.filter((s) => s.date === dateStr);
}

function isDayOffSlot(slot: ScheduleSlot): boolean {
	return (
		slot.entityType === 'task' &&
		((slot.title || '').toLowerCase().includes('выходной') ||
			slot.maxParticipants === 0)
	);
}

export function ScheduleCalendar(props: ScheduleCalendarProps) {
	const {
		currentDate,
		selectedDate,
		slots,
		onSelectDate,
		onChangeMonth,
		onAdd,
	} = props;

	const year = currentDate.getFullYear();
	const month = currentDate.getMonth();
	const firstDayOfMonth = new Date(year, month, 1);
	const lastDayOfMonth = new Date(year, month + 1, 0);
	const startDay = (firstDayOfMonth.getDay() + 6) % 7;
	const daysInMonth = lastDayOfMonth.getDate();

	const handlePrevMonth = () => onChangeMonth('prev');
	const handleNextMonth = () => onChangeMonth('next');

	const formatDate = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

	return (
		<Card className="p-0 overflow-hidden">
			<div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-slate-600">
				<div className="flex items-center gap-4">
					<h2 className="text-lg font-semibold text-neutral-900 w-40">
						{months[month]} {year}
					</h2>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={handlePrevMonth}
							className="px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-200"
							aria-label="Предыдущий месяц"
						>
							‹
						</button>
						<button
							type="button"
							onClick={handleNextMonth}
							className="px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-200"
							aria-label="Следующий месяц"
						>
							›
						</button>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => onSelectDate(formatDateForInput(new Date()))}
						className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
					>
						Сегодня
					</button>
				</div>
			</div>

			<div className="grid grid-cols-7 border-b border-neutral-200 dark:border-slate-600 bg-neutral-100/80 dark:bg-slate-800/90">
				{weekDays.map((day) => (
					<div
						key={day}
						className="py-2 text-center text-xs font-semibold text-neutral-600 dark:text-slate-300 uppercase"
					>
						{day}
					</div>
				))}
			</div>

			<div className="grid grid-cols-7 auto-rows-[120px] bg-white dark:bg-slate-900/40">
				{CAL_LEADING_EMPTY_KEYS.slice(0, startDay).map((emptyKey) => (
					<div
						key={emptyKey}
						className="border-b border-r border-neutral-200/90 dark:border-slate-600 bg-neutral-100/50 dark:bg-slate-800/50"
					/>
				))}
				{Array.from({ length: daysInMonth }).map((_, i) => {
					const day = i + 1;
					const dateStr = formatDate(new Date(year, month, day));
					const daySlots = getSlotsForDate(slots, dateStr);
					const hasDayOff = daySlots.some(isDayOffSlot);
					const isToday = dateStr === formatDateForInput(new Date());
					const isSelected = dateStr === selectedDate;

					return (
						// biome-ignore lint/a11y/noStaticElementInteractions: day cell shares click with inner add control; outer cannot be role=button (nested interactive with "+")
						// biome-ignore lint/a11y/useKeyWithClickEvents: pointer-first grid; inner controls stay keyboard-reachable
						<div
							key={day}
							onClick={() => onSelectDate(dateStr)}
							className={`group relative p-2 border-b border-r border-neutral-200/90 dark:border-slate-600 cursor-pointer transition-colors min-h-[120px] ${
								isSelected
									? 'bg-primary-100/70 dark:bg-primary-950/50 ring-2 ring-inset ring-primary-600 dark:ring-primary-400'
									: hasDayOff
										? 'bg-orange-100/60 dark:bg-orange-950/35'
										: 'hover:bg-neutral-100/90 dark:hover:bg-slate-800/80'
							}`}
						>
							<div className="flex justify-between items-start mb-1">
								<div
									className={`text-sm font-semibold ${isToday ? 'text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/50 px-1.5 rounded-full' : 'text-neutral-800 dark:text-slate-100'}`}
								>
									{day}
								</div>
								<div className="flex items-center gap-2">
									{daySlots.length > 0 && (
										<div className="flex items-center gap-1">
											<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 border border-primary-200">
												{daySlots.length}
											</span>
											{daySlots.some(
												(s) => s.currentParticipants >= s.maxParticipants
											) && (
												<span
													className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200"
													title="Есть заполненные слоты"
												>
													⚠
												</span>
											)}
											{hasDayOff && (
												<span
													className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200"
													title="День помечен как выходной"
												>
													Вых
												</span>
											)}
										</div>
									)}
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onAdd(dateStr);
										}}
										className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary-100 text-primary-600 rounded transition-[opacity,background-color,color] duration-200"
										title="Добавить событие"
									>
										<PlusIcon width={14} height={14} />
									</button>
								</div>
							</div>
							<div className="space-y-1 overflow-y-auto max-h-[80px] no-scrollbar">
								{daySlots.map((slot) => {
									const isFull =
										slot.currentParticipants >= slot.maxParticipants;
									const occupancy =
										slot.maxParticipants > 0
											? `${slot.currentParticipants}/${slot.maxParticipants}`
											: '';
									const isDayOff = isDayOffSlot(slot);
									return (
										<div
											key={slot.id}
											className={`text-[10px] px-1.5 py-0.5 rounded border truncate flex items-center justify-between gap-1 ${
												isDayOff
													? 'bg-orange-50 border-orange-200 text-orange-700'
													: slot.entityType === 'task'
														? 'bg-neutral-100 border-neutral-200 text-neutral-700'
														: slot.entityType === 'consultation'
															? isFull
																? 'bg-purple-100 border-purple-300 text-purple-800'
																: 'bg-purple-50 border-purple-100 text-purple-700'
															: isFull
																? 'bg-blue-100 border-blue-300 text-blue-800'
																: 'bg-blue-50 border-blue-100 text-blue-700'
											}`}
											title={`${slot.title || (slot.entityType === 'task' ? 'Задача' : 'Запись')}${occupancy ? ` (${occupancy})` : ''}`}
										>
											<span className="truncate">
												{slot.startTime}{' '}
												{slot.title ||
													(slot.entityType === 'task' ? 'Задача' : 'Запись')}
											</span>
											{occupancy && !isDayOff && (
												<span
													className={`shrink-0 font-medium ${isFull ? 'text-red-600' : ''}`}
												>
													{occupancy}
												</span>
											)}
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>

			<div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-neutral-200 dark:border-slate-600 bg-neutral-100/70 dark:bg-slate-800/80 text-[11px] text-neutral-600 dark:text-slate-300">
				<span className="font-medium mr-1">Легенда:</span>
				<span className="inline-flex items-center gap-1">
					<span className="w-3 h-3 rounded bg-neutral-200" />
					Задачи
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="w-3 h-3 rounded bg-purple-200" />
					Консультации
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="w-3 h-3 rounded bg-blue-200" />
					Мастер-классы
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="w-3 h-3 rounded bg-orange-200" />
					Выходной
				</span>
			</div>
		</Card>
	);
}
