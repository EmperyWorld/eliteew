import { Input } from '@components/atoms/Input';
import type {
	AdminBookingStatus,
	AdminBookingWithSlotInfo,
} from '@services/api/bookings';
import {
	useAdminBookings,
	useUpdateBookingStatus,
} from '@services/api/bookings';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowDownTrayIcon,
	CalendarDaysIcon,
	CheckCircleIcon,
	CheckIcon,
	ClockIcon,
	FunnelIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	Squares2X2Icon,
	TableCellsIcon,
	UsersIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { BookingCalendar } from './components/BookingCalendar';
import { BookingCard } from './components/BookingCard';
import { BookingsSkeleton } from './components/BookingsSkeleton';
import { CalendarSkeleton } from './components/CalendarSkeleton';

function BookingsStaggerRow({
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
		el.style.animationDelay = `${index * 30}ms`;
		el.style.animationFillMode = 'backwards';
	}, [index]);
	return (
		<div ref={ref} className="animate-in fade-in slide-in-from-bottom-2">
			{children}
		</div>
	);
}

type BookingStatus = AdminBookingStatus;

export const BookingsPage: React.FC = () => {
	const { data, isLoading } = useAdminBookings();
	const updateBookingStatus = useUpdateBookingStatus();
	const navigate = useNavigate();

	const bookings = useMemo(() => data ?? [], [data]);
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>(
		'all'
	);
	const [dateFilter, setDateFilter] = useState('');
	const [datePreset, setDatePreset] = useState<
		'all' | 'today' | 'tomorrow' | 'week'
	>('all');
	const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
	const [typeFilter, setTypeFilter] = useState<
		'all' | 'consultation' | 'masterclass'
	>('all');
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isBulkUpdating, setIsBulkUpdating] = useState(false);
	const [clientTags, setClientTags] = useState<Record<string, Set<string>>>({});
	const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
	const [exportFrom, setExportFrom] = useState('');
	const [exportTo, setExportTo] = useState('');
	const [toast, setToast] = useState<{
		message: string;
		type: 'success' | 'error';
	} | null>(null);

	const clientKey = (b: AdminBookingWithSlotInfo) =>
		b.customerPhone || b.customerEmail || b.customerName || b.id;

	const toggleTag = (b: AdminBookingWithSlotInfo, tag: string) => {
		const key = clientKey(b);
		setClientTags((prev) => {
			const next = { ...prev };
			const current = new Set(next[key] ?? []);
			if (current.has(tag)) current.delete(tag);
			else current.add(tag);
			next[key] = current;
			return next;
		});
	};

	const setNote = (b: AdminBookingWithSlotInfo, note: string) => {
		const key = clientKey(b);
		setClientNotes((prev) => ({ ...prev, [key]: note }));
	};

	const stats = useMemo(() => {
		const total = bookings.length;
		const pending = bookings.filter((b) => b.status === 'pending').length;
		const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
		const completed = bookings.filter((b) => b.status === 'completed').length;
		return { total, pending, confirmed, completed };
	}, [bookings]);

	const filteredBookings = bookings.filter((b) => {
		const matchesSearch =
			b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			b.customerPhone.includes(searchQuery) ||
			b.slotInfo.title.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
		const matchesType = typeFilter === 'all' || b.slotInfo.type === typeFilter;

		const matchesDate = (() => {
			try {
				const raw = new Date(b.dateRaw);
				const iso = raw.toISOString().split('T')[0];
				if (datePreset === 'today') {
					const today = new Date().toISOString().split('T')[0];
					return iso === today;
				}
				if (datePreset === 'tomorrow') {
					const tomorrow = new Date();
					tomorrow.setDate(tomorrow.getDate() + 1);
					const tIso = tomorrow.toISOString().split('T')[0];
					return iso === tIso;
				}
				if (datePreset === 'week') {
					const start = new Date();
					const end = new Date();
					end.setDate(end.getDate() + 7);
					return (
						raw >= new Date(start.toDateString()) &&
						raw <= new Date(end.toDateString())
					);
				}
				if (dateFilter) {
					return iso === dateFilter;
				}
				return true;
			} catch {
				return true;
			}
		})();

		return matchesSearch && matchesStatus && matchesDate && matchesType;
	});

	const updateStatus = (id: string, newStatus: BookingStatus) => {
		updateBookingStatus.mutate({ id, status: newStatus });
	};

	const updateBulkStatus = async (newStatus: BookingStatus) => {
		if (!selectedIds.size) return;
		setIsBulkUpdating(true);
		try {
			await Promise.all(
				Array.from(selectedIds).map((id) =>
					updateBookingStatus.mutateAsync({ id, status: newStatus })
				)
			);
			setSelectedIds(new Set());
			setToast({ message: 'Статусы обновлены', type: 'success' });
		} finally {
			setIsBulkUpdating(false);
		}
	};

	const navigateToSchedule = (dateRaw?: string) => {
		try {
			if (dateRaw) {
				const raw = new Date(dateRaw);
				const iso = raw.toISOString().split('T')[0];
				navigate(`/admin/schedule?date=${iso}`);
			} else {
				navigate('/admin/schedule');
			}
		} catch {
			navigate('/admin/schedule');
		}
	};

	const duplicateBooking = (
		bookingId: string,
		dateRaw: string,
		name: string,
		phone: string,
		email?: string
	) => {
		const params = new URLSearchParams();
		if (dateRaw) {
			try {
				const iso = new Date(dateRaw).toISOString().split('T')[0];
				params.set('date', iso);
			} catch {
				// ignore
			}
		}
		params.set('fromBooking', bookingId);
		if (name) params.set('name', name);
		if (phone) params.set('phone', phone);
		if (email) params.set('email', email);
		navigate(`/admin/schedule?${params.toString()}`);
	};

	const clients = useMemo(() => {
		const map = new Map<
			string,
			{
				name: string;
				phone: string;
				email?: string;
				bookings: number;
				pending: number;
			}
		>();
		for (const b of filteredBookings) {
			const key = b.customerPhone || b.customerEmail || b.customerName;
			let entry = map.get(key);
			if (!entry) {
				entry = {
					name: b.customerName,
					phone: b.customerPhone,
					email: b.customerEmail,
					bookings: 0,
					pending: 0,
				};
				map.set(key, entry);
			}
			entry.bookings += 1;
			if (b.status === 'pending') entry.pending += 1;
		}
		return Array.from(map.values())
			.sort((a, b) => b.bookings - a.bookings)
			.slice(0, 4);
	}, [filteredBookings]);

	const exportCsv = () => {
		if (!filteredBookings.length) return;
		const rows = filteredBookings.map((b) => ({
			id: b.id,
			orderDate: b.dateRaw,
			slotDate: b.slotInfo.date,
			slotTime: b.slotInfo.time,
			type: b.slotInfo.type,
			customerName: b.customerName,
			customerPhone: b.customerPhone,
			customerEmail: b.customerEmail ?? '',
			status: b.status,
			participants: b.participants,
			title: b.slotInfo.title,
			notes: b.notes ?? '',
		}));

		const header = Object.keys(rows[0]).join(',');
		const body = rows
			.map((row) =>
				Object.values(row)
					.map((v) => `"${String(v).replace(/"/g, '""')}"`)
					.join(',')
			)
			.join('\n');
		const csv = [header, body].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', 'bookings.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		setToast({ message: 'CSV выгружен', type: 'success' });
	};

	const exportXlsx = () => {
		const data = filteredBookings.filter((b) => {
			if (exportFrom || exportTo) {
				try {
					const d = new Date(b.dateRaw);
					if (exportFrom && d < new Date(exportFrom)) return false;
					if (exportTo) {
						const end = new Date(exportTo);
						end.setHours(23, 59, 59, 999);
						if (d > end) return false;
					}
				} catch {
					// ignore parse errors
				}
			}
			return true;
		});
		if (!data.length)
			return setToast({ message: 'Нет записей в диапазоне', type: 'error' });

		const rows = data.map((b) => ({
			id: b.id,
			date: b.dateRaw,
			time: b.slotInfo.time,
			type: b.slotInfo.type,
			customer: b.customerName,
			phone: b.customerPhone,
			email: b.customerEmail ?? '',
			status: b.status,
			participants: b.participants,
			title: b.slotInfo.title,
			notes: b.notes ?? '',
		}));
		const header = Object.keys(rows[0]).join(',');
		const body = rows
			.map((row) =>
				Object.values(row)
					.map((v) => `"${String(v).replace(/"/g, '""')}"`)
					.join(',')
			)
			.join('\n');
		const csv = [header, body].join('\n');
		const blob = new Blob([csv], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;',
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', 'bookings.xlsx');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		setToast({ message: 'XLSX выгружен', type: 'success' });
	};

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow="Продажи"
				title="Записи"
				titleIcon={
					<CalendarDaysIcon
						className="text-primary-600 dark:text-primary-300"
						width={22}
						height={22}
					/>
				}
				titleExtra={
					stats.pending > 0 ? (
						<span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full animate-pulse">
							{stats.pending} новых
						</span>
					) : null
				}
				description="Управление записями на консультации и мастер-классы"
				actions={
					<div className="flex flex-wrap items-center gap-2 justify-end">
						<button
							type="button"
							onClick={() => navigateToSchedule()}
							className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white shadow"
						>
							<PlusIcon width={16} height={16} />
							Создать запись
						</button>
						<div className="flex items-center gap-2 bg-neutral-100 dark:bg-slate-700 p-1 rounded-xl">
							<button
								type="button"
								onClick={() => setViewMode('list')}
								aria-label="Список записей"
								title="Список записей"
								className={`p-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
									viewMode === 'list'
										? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-300'
										: 'text-neutral-500 dark:text-slate-300 hover:text-neutral-700 dark:hover:text-white'
								}`}
							>
								<ListBulletIcon width={18} height={18} aria-hidden />
							</button>
							<button
								type="button"
								onClick={() => setViewMode('calendar')}
								aria-label="Календарь"
								title="Календарь"
								className={`p-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
									viewMode === 'calendar'
										? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-300'
										: 'text-neutral-500 dark:text-slate-300 hover:text-neutral-700 dark:hover:text-white'
								}`}
							>
								<Squares2X2Icon width={18} height={18} aria-hidden />
							</button>
							<button
								type="button"
								onClick={exportCsv}
								className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-600 text-neutral-600 dark:text-slate-100 hover:shadow"
								title="Экспорт CSV"
							>
								<ArrowDownTrayIcon width={14} height={14} />
								CSV
							</button>
						</div>
						<div className="flex flex-wrap items-center gap-2 bg-neutral-100 dark:bg-slate-700 p-2 rounded-xl">
							<input
								type="date"
								value={exportFrom}
								onChange={(e) => setExportFrom(e.target.value)}
								className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-neutral-700 dark:text-slate-200"
								aria-label="Дата с"
							/>
							<input
								type="date"
								value={exportTo}
								onChange={(e) => setExportTo(e.target.value)}
								className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-neutral-700 dark:text-slate-200"
								aria-label="Дата по"
							/>
							<button
								type="button"
								onClick={exportXlsx}
								className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-600 text-neutral-700 dark:text-slate-100 hover:shadow border border-neutral-200 dark:border-slate-600"
								title="Экспорт XLSX по диапазону"
							>
								<TableCellsIcon width={14} height={14} />
								XLSX
							</button>
						</div>
					</div>
				}
			/>

			{/* Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-linear-to-br from-neutral-50 to-white dark:from-slate-800/50 dark:to-slate-800/30 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-slate-400">
								Всего
							</p>
							<p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
								{stats.total}
							</p>
						</div>
						<div className="p-2 bg-neutral-100 dark:bg-slate-700 rounded-lg">
							<UsersIcon
								width={18}
								height={18}
								className="text-neutral-500 dark:text-slate-300"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-amber-200/60 dark:border-amber-700/40 bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
								Новые
							</p>
							<p className="text-2xl font-bold text-amber-700 dark:text-amber-200 mt-1">
								{stats.pending}
							</p>
						</div>
						<div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
							<ClockIcon
								width={18}
								height={18}
								className="text-amber-700 dark:text-amber-200"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-blue-200/60 dark:border-blue-700/40 bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-300">
								Подтверждено
							</p>
							<p className="text-2xl font-bold text-blue-700 dark:text-blue-200 mt-1">
								{stats.confirmed}
							</p>
						</div>
						<div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
							<CheckCircleIcon
								width={18}
								height={18}
								className="text-blue-700 dark:text-blue-200"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-700/40 bg-linear-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
								Завершено
							</p>
							<p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200 mt-1">
								{stats.completed}
							</p>
						</div>
						<div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
							<CheckCircleIcon
								width={18}
								height={18}
								className="text-emerald-700 dark:text-emerald-200"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-3">
				{/* Quick status chips */}
				<div className="flex flex-wrap gap-2">
					{[
						{
							key: 'all' as const,
							label: 'Все',
							count: stats.total,
							color:
								'bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-slate-200',
						},
						{
							key: 'pending' as const,
							label: 'Новые',
							count: stats.pending,
							color:
								'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200',
						},
						{
							key: 'confirmed' as const,
							label: 'Подтв.',
							count: stats.confirmed,
							color:
								'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200',
						},
						{
							key: 'completed' as const,
							label: 'Заверш.',
							count: stats.completed,
							color:
								'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200',
						},
					].map((chip) => (
						<button
							type="button"
							key={chip.key}
							onClick={() => setStatusFilter(chip.key)}
							className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none border ${
								statusFilter === chip.key
									? 'border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-700 shadow-sm'
									: 'border-transparent'
							} ${chip.color}`}
						>
							<span>{chip.label}</span>
							<span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 text-[11px] text-neutral-700 dark:text-slate-200">
								{chip.count}
							</span>
						</button>
					))}
					<button
						type="button"
						onClick={() => setStatusFilter('cancelled')}
						className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none border ${
							statusFilter === 'cancelled'
								? 'border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-700 shadow-sm'
								: 'border-transparent'
						} bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200`}
					>
						<span>Отмены</span>
						<span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 text-[11px] text-neutral-700 dark:text-slate-200">
							{bookings.filter((b) => b.status === 'cancelled').length}
						</span>
					</button>
				</div>

				<div className="flex flex-col lg:flex-row gap-4">
					<div className="relative flex-1">
						<MagnifyingGlassIcon
							className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
							width={20}
							height={20}
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Поиск по имени, телефону или событию..."
							className="pl-12 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
							aria-label="Поиск по имени, телефону или событию"
						/>
					</div>
					<div className="flex items-center gap-3 flex-wrap">
						<div className="flex items-center gap-2">
							<FunnelIcon
								width={18}
								height={18}
								className="text-neutral-400 dark:text-slate-500"
							/>
							<select
								value={statusFilter}
								onChange={(e) =>
									setStatusFilter(e.target.value as BookingStatus | 'all')
								}
								className="rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-200 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-700"
								aria-label="Фильтр по статусу"
							>
								<option value="all">Все статусы</option>
								<option value="pending">Ожидают</option>
								<option value="confirmed">Подтверждённые</option>
								<option value="completed">Завершённые</option>
								<option value="cancelled">Отменённые</option>
							</select>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-xs text-neutral-500 dark:text-slate-400">
								Тип
							</span>
							<div className="flex items-center gap-1 bg-neutral-100 dark:bg-slate-700 p-1 rounded-lg">
								{(['all', 'consultation', 'masterclass'] as const).map(
									(type) => (
										<button
											type="button"
											key={type}
											onClick={() => setTypeFilter(type)}
											className={`px-3 py-1.5 text-xs rounded-md transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
												typeFilter === type
													? 'bg-white dark:bg-slate-600 text-primary-700 dark:text-primary-300 shadow-sm'
													: 'text-neutral-600 dark:text-slate-300 hover:text-neutral-800 dark:hover:text-white'
											}`}
										>
											{type === 'all'
												? 'Все'
												: type === 'consultation'
													? 'Консультации'
													: 'Мастер-классы'}
										</button>
									)
								)}
							</div>
						</div>
						<div className="flex items-center gap-2">
							<label
								htmlFor="bookings-date"
								className="text-xs text-neutral-500 dark:text-slate-400"
							>
								Дата
							</label>
							<Input
								id="bookings-date"
								type="date"
								value={dateFilter}
								onChange={(e) => setDateFilter(e.target.value)}
								className="px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white"
							/>
							<div className="flex items-center gap-1">
								<button
									type="button"
									className="px-2 py-1 text-[11px] rounded-md border border-neutral-200 dark:border-slate-600 text-neutral-600 dark:text-slate-200 hover:bg-neutral-50 dark:hover:bg-slate-700"
									onClick={() => {
										const today = new Date();
										const iso = today.toISOString().split('T')[0];
										setDateFilter(iso);
									}}
									aria-label="Фильтр по сегодняшней дате"
								>
									Сегодня
								</button>
								<button
									type="button"
									className="px-2 py-1 text-[11px] rounded-md border border-neutral-200 dark:border-slate-600 text-neutral-600 dark:text-slate-200 hover:bg-neutral-50 dark:hover:bg-slate-700"
									onClick={() => {
										const today = new Date();
										const tomorrow = new Date(
											today.getFullYear(),
											today.getMonth(),
											today.getDate() + 1
										);
										const iso = tomorrow.toISOString().split('T')[0];
										setDateFilter(iso);
									}}
									aria-label="Фильтр по завтрашней дате"
								>
									Завтра
								</button>
								<button
									type="button"
									className="px-2 py-1 text-[11px] rounded-md border border-neutral-200 dark:border-slate-600 text-neutral-500 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-700"
									onClick={() => setDateFilter('')}
									aria-label="Сбросить фильтр даты"
								>
									Сброс
								</button>
							</div>
						</div>
						<div className="flex items-center gap-2 flex-wrap">
							{(['all', 'today', 'tomorrow', 'week'] as const).map((preset) => (
								<button
									type="button"
									key={preset}
									onClick={() => {
										setDatePreset(preset);
										if (preset !== 'all') setDateFilter('');
									}}
									className={`px-3 py-1.5 text-xs rounded-lg border transition-[color,background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none ${
										datePreset === preset
											? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-primary-200 dark:border-primary-700'
											: 'border-neutral-200 dark:border-slate-600 text-neutral-600 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700'
									}`}
								>
									{preset === 'all'
										? 'Все даты'
										: preset === 'today'
											? 'Сегодня'
											: preset === 'tomorrow'
												? 'Завтра'
												: 'Неделя'}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
				<div className="xl:col-span-3 space-y-4">
					{isLoading && viewMode === 'list' && <BookingsSkeleton />}
					{isLoading && viewMode === 'calendar' && <CalendarSkeleton />}

					{!isLoading && viewMode === 'calendar' && (
						<BookingCalendar
							bookings={filteredBookings}
							onUpdateStatus={updateStatus}
							onNavigateToSchedule={navigateToSchedule}
							onDuplicate={(b) =>
								duplicateBooking(
									b.id,
									b.dateRaw,
									b.customerName,
									b.customerPhone,
									b.customerEmail
								)
							}
							selectedIds={selectedIds}
							onToggleSelect={(id, checked) => {
								setSelectedIds((prev) => {
									const next = new Set(prev);
									if (checked) next.add(id);
									else next.delete(id);
									return next;
								});
							}}
							onSelectDay={(ids) => {
								setSelectedIds((prev) => {
									const next = new Set(prev);
									for (const id of ids) {
										next.add(id);
									}
									return next;
								});
							}}
							getTags={(b) => Array.from(clientTags[clientKey(b)] ?? [])}
							onToggleTag={toggleTag}
							getNote={(b) => clientNotes[clientKey(b)] ?? ''}
							onChangeNote={setNote}
						/>
					)}

					{!isLoading &&
						viewMode === 'list' &&
						filteredBookings.map((booking, idx) => (
							<BookingsStaggerRow key={booking.id} index={idx}>
								<BookingCard
									booking={booking}
									onUpdateStatus={updateStatus}
									onNavigateToSchedule={navigateToSchedule}
									onDuplicate={() =>
										duplicateBooking(
											booking.id,
											booking.dateRaw,
											booking.customerName,
											booking.customerPhone,
											booking.customerEmail
										)
									}
									tags={Array.from(clientTags[clientKey(booking)] ?? [])}
									onToggleTag={(tag) => toggleTag(booking, tag)}
									note={clientNotes[clientKey(booking)] ?? ''}
									onChangeNote={(val) => setNote(booking, val)}
								/>
							</BookingsStaggerRow>
						))}

					{filteredBookings.length === 0 && !isLoading && (
						<div className="p-12 text-center rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
							<p className="text-neutral-500 dark:text-slate-400">
								Записи не найдены
							</p>
							<button
								type="button"
								onClick={() => navigateToSchedule()}
								className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white"
							>
								<PlusIcon width={16} height={16} />
								Создать запись
							</button>
						</div>
					)}
				</div>

				{/* Clients summary */}
				<div className="space-y-3">
					<div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
						<div className="flex items-center gap-2 mb-3">
							<UsersIcon width={16} height={16} className="text-primary-500" />
							<p className="text-sm font-semibold text-neutral-900 dark:text-white">
								Клиенты
							</p>
						</div>
						<div className="space-y-3">
							{clients.length === 0 && (
								<p className="text-sm text-neutral-500 dark:text-slate-400">
									Нет данных по клиентам
								</p>
							)}
							{clients.map((c) => (
								<div
									key={c.phone + c.email}
									className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-900/50 border border-neutral-100 dark:border-slate-700"
								>
									<p className="font-semibold text-neutral-900 dark:text-white">
										{c.name}
									</p>
									<p className="text-xs text-neutral-500 dark:text-slate-400">
										{c.phone}
									</p>
									{c.email && (
										<p className="text-xs text-neutral-500 dark:text-slate-400">
											{c.email}
										</p>
									)}
									<div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 dark:text-slate-400">
										<span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold">
											{c.bookings} запис.
										</span>
										{c.pending > 0 && (
											<span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold">
												{c.pending} в ожидании
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Sticky bulk bar */}
			{viewMode === 'calendar' && selectedIds.size > 0 && (
				<div className="fixed inset-x-4 bottom-6 z-40">
					<div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 shadow-xl rounded-2xl px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold">
								Выбрано: {selectedIds.size}
							</span>
							<button
								type="button"
								className="text-xs text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-white"
								onClick={() => setSelectedIds(new Set())}
							>
								Очистить
							</button>
						</div>
						<div className="flex items-center gap-2 ml-auto">
							<button
								type="button"
								onClick={() => updateBulkStatus('confirmed')}
								disabled={isBulkUpdating}
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
							>
								<CheckIcon width={14} height={14} /> Подтв.
							</button>
							<button
								type="button"
								onClick={() => updateBulkStatus('completed')}
								disabled={isBulkUpdating}
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
							>
								<CheckCircleIcon width={14} height={14} /> Завершить
							</button>
							<button
								type="button"
								onClick={() => updateBulkStatus('cancelled')}
								disabled={isBulkUpdating}
								className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
							>
								<XMarkIcon width={14} height={14} /> Отменить
							</button>
						</div>
					</div>
				</div>
			)}

			{toast && (
				<div className="fixed top-4 right-4 z-50">
					<div
						className={`px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
							toast.type === 'success'
								? 'bg-emerald-600 text-white'
								: 'bg-red-600 text-white'
						}`}
					>
						{toast.message}
					</div>
				</div>
			)}
		</div>
	);
};
