import { Button } from '@components/atoms/Button';
import { Card } from '@components/atoms/Card';
import * as React from 'react';
import { AttentionWidget } from './components/AttentionWidget';
import { AdminLink as Link } from './components/AdminLink';
import {
	RecentBooking,
	type RecentBookingProps,
} from './components/RecentBooking';
import { AdminPageHeader } from './components/AdminPageHeader';
import { StatCard } from './components/StatCard';
import { formatRubles } from './utils/formatCurrency';
import { useDashboardStats } from './hooks/useDashboardStats';
import {
	AcademicCapIcon,
	ArrowPathIcon,
	ArrowRightIcon,
	ArrowTrendingUpIcon,
	CalendarIcon,
	ChatBubbleLeftRightIcon,
	ClockIcon,
	CubeIcon,
	CurrencyDollarIcon,
	ShoppingCartIcon,
	SparklesIcon,
	Squares2X2Icon,
	UsersIcon,
} from '@heroicons/react/24/outline';

export const DashboardPage: React.FC = () => {
	const { loading, stats, upcomingSlots, error, refetch } = useDashboardStats();

	// Pre-calculate recent bookings props
	const recentBookings = React.useMemo(
		(): Array<RecentBookingProps & { id: string }> =>
			(stats?.recentBookings || []).map((b) => ({
				id: b.id,
				name: b.user?.name || b.guestName || 'Гость',
				type: b.consultation?.title || b.masterclass?.title || 'Запись',
				date: new Date(b.createdAt).toLocaleDateString('ru-RU', {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit',
				}),
				status:
					(b.status?.toLowerCase() as RecentBookingProps['status']) ||
					'pending',
			})),
		[stats?.recentBookings]
	);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center h-64 gap-3">
				<ArrowPathIcon className="w-10 h-10 animate-spin text-primary-500" />
				<p className="text-neutral-500 dark:text-slate-400 text-sm">
					Загрузка данных...
				</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 h-64 text-center">
				<div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full shadow-md shadow-red-500/20">
					<Squares2X2Icon className="w-8 h-8 text-red-400" />
				</div>
				<p className="text-neutral-600 dark:text-slate-300 max-w-md">{error}</p>
				<Button onClick={refetch}>Повторить загрузку</Button>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<AdminPageHeader
				eyebrow="Пакет Pro ∞ · Сопровождение"
				title="Dashboard"
				titleIcon={
					<Squares2X2Icon
						className="text-primary-600 dark:text-primary-400"
						width={24}
						height={24}
					/>
				}
				description="Обзор активности, продаж и записей на вашем сайте"
				actions={
					<div className="hidden sm:flex items-center gap-2 text-sm text-neutral-500 dark:text-slate-400 px-3 py-1.5 rounded-full bg-neutral-50/80 dark:bg-slate-900/50 border border-neutral-200/70 dark:border-slate-800/70">
						<ClockIcon
							width={14}
							height={14}
							className="text-primary-500 dark:text-primary-400"
						/>
						{new Date().toLocaleDateString('ru-RU', {
							weekday: 'long',
							day: 'numeric',
							month: 'long',
						})}
					</div>
				}
			/>

			<AttentionWidget
				pendingOrders={stats?.pendingOrders || 0}
				pendingBookings={stats?.pendingBookings || 0}
			/>

			{/* Main Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="p-6 bg-linear-to-br from-orange-50 to-amber-50/30 dark:from-orange-900/20 dark:to-amber-900/10 border-orange-100 dark:border-orange-800/30 hover:shadow-xl hover:scale-[1.02] transition-[box-shadow,transform] duration-300 motion-reduce:transition-none motion-reduce:hover:scale-100 group">
					<div className="flex items-start justify-between">
						<div>
							<p className="text-sm font-medium text-orange-700/80 dark:text-orange-400">
								Заказов
							</p>
							<p className="text-4xl font-display font-bold text-orange-900 dark:text-orange-100 mt-2 group-hover:scale-105 transition-transform duration-300">
								{stats?.totalOrders || 0}
							</p>
							{stats?.pendingOrders ? (
								<p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-2 font-medium">
									<span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-lg shadow-orange-500/50" />
									{stats.pendingOrders} ожидают
								</p>
							) : null}
						</div>
						<div className="p-3 bg-orange-100 dark:bg-orange-800/30 rounded-xl group-hover:scale-110 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/50 transition-[transform,box-shadow,background-color] duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
							<ShoppingCartIcon
								width={24}
								height={24}
								className="text-orange-600 dark:text-orange-400"
							/>
						</div>
					</div>
					<Link
						to="/admin/orders"
						className="flex items-center gap-1 text-sm text-orange-700 dark:text-orange-400 font-medium mt-4 hover:text-orange-800 dark:hover:text-orange-300 transition-[gap,color] duration-200 group-hover:gap-2"
					>
						Все заказы{' '}
						<ArrowRightIcon
							width={14}
							height={14}
							className="group-hover:translate-x-0.5 transition-transform"
						/>
					</Link>
				</Card>

				<Card className="p-6 bg-linear-to-br from-emerald-50 to-green-50/30 dark:from-emerald-900/20 dark:to-green-900/10 border-emerald-100 dark:border-emerald-800/30 hover:shadow-xl hover:scale-[1.02] transition-[box-shadow,transform] duration-300 motion-reduce:transition-none motion-reduce:hover:scale-100 group">
					<div className="flex items-start justify-between">
						<div>
							<p className="text-sm font-medium text-emerald-700/80 dark:text-emerald-400">
								Выручка
							</p>
							<p className="text-4xl font-display font-bold text-emerald-900 dark:text-emerald-100 mt-2 group-hover:scale-105 transition-transform duration-300">
								{formatRubles(stats?.totalRevenue || 0, 'compact')}
							</p>
							<p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-2 font-medium">
								<ArrowTrendingUpIcon
									width={14}
									height={14}
									className="text-emerald-500"
								/>
								За всё время
							</p>
						</div>
						<div className="p-3 bg-emerald-100 dark:bg-emerald-800/30 rounded-xl group-hover:scale-110 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/50 transition-[transform,box-shadow,background-color] duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
							<CurrencyDollarIcon
								width={24}
								height={24}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						</div>
					</div>
					<Link
						to="/admin/orders"
						className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400 font-medium mt-4 hover:text-emerald-800 dark:hover:text-emerald-300 transition-[gap,color] duration-200 group-hover:gap-2"
					>
						Финансы{' '}
						<ArrowRightIcon
							width={14}
							height={14}
							className="group-hover:translate-x-0.5 transition-transform"
						/>
					</Link>
				</Card>

				<Card className="p-6 bg-linear-to-br from-purple-50 to-violet-50/30 dark:from-purple-900/20 dark:to-violet-900/10 border-purple-100 dark:border-purple-800/30 hover:shadow-xl hover:scale-[1.02] transition-[box-shadow,transform] duration-300 motion-reduce:transition-none motion-reduce:hover:scale-100 group">
					<div className="flex items-start justify-between">
						<div>
							<p className="text-sm font-medium text-purple-700/80 dark:text-purple-400">
								Бронирований
							</p>
							<p className="text-4xl font-display font-bold text-purple-900 dark:text-purple-100 mt-2 group-hover:scale-105 transition-transform duration-300">
								{stats?.totalBookings || 0}
							</p>
							{stats?.pendingBookings ? (
								<p className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-2 font-medium">
									<span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse shadow-lg shadow-purple-500/50" />
									{stats.pendingBookings} новых
								</p>
							) : null}
						</div>
						<div className="p-3 bg-purple-100 dark:bg-purple-800/30 rounded-xl group-hover:scale-110 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-[transform,box-shadow,background-color] duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
							<UsersIcon
								width={24}
								height={24}
								className="text-purple-600 dark:text-purple-400"
							/>
						</div>
					</div>
					<Link
						to="/admin/bookings"
						className="flex items-center gap-1 text-sm text-purple-700 dark:text-purple-400 font-medium mt-4 hover:text-purple-800 dark:hover:text-purple-300 transition-[gap,color] duration-200 group-hover:gap-2"
					>
						Все записи{' '}
						<ArrowRightIcon
							width={14}
							height={14}
							className="group-hover:translate-x-0.5 transition-transform"
						/>
					</Link>
				</Card>
			</div>

			{/* Secondary Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<StatCard
					title="Товаров"
					value={stats?.totalProducts || 0}
					icon={CubeIcon}
					color="primary"
					to="/admin/products"
				/>
				<StatCard
					title="Консультаций"
					value={stats?.totalConsultations || 0}
					icon={ChatBubbleLeftRightIcon}
					color="accent"
					to="/admin/consultations"
				/>
				<StatCard
					title="Мастер-классов"
					value={stats?.totalMasterclasses || 0}
					icon={AcademicCapIcon}
					color="blue"
					to="/admin/masterclasses"
				/>
				<StatCard
					title="Пользователей"
					value={stats?.totalUsers || 0}
					icon={UsersIcon}
					color="purple"
				/>
			</div>

			{/* Two Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Recent Bookings */}
				<Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 motion-reduce:transition-none">
					<div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-slate-700 bg-linear-to-r from-neutral-50/50 dark:from-slate-800/50 to-transparent">
						<h2 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
							<div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
								<UsersIcon
									width={16}
									height={16}
									className="text-purple-600 dark:text-purple-400"
								/>
							</div>
							Последние записи
						</h2>
						<Link
							to="/admin/bookings"
							className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 group transition-[gap,color] duration-200 hover:gap-2"
						>
							Все записи{' '}
							<ArrowRightIcon
								width={14}
								height={14}
								className="group-hover:translate-x-0.5 transition-transform"
							/>
						</Link>
					</div>
					<div className="p-4">
						{recentBookings.map(({ id, ...booking }) => (
							<RecentBooking key={id} {...booking} />
						))}
						{recentBookings.length === 0 && (
							<div className="text-center py-8 text-neutral-500 dark:text-slate-400">
								<UsersIcon
									width={32}
									height={32}
									className="mx-auto mb-2 text-neutral-300 dark:text-slate-600"
								/>
								<p>Нет недавних записей</p>
							</div>
						)}
					</div>
				</Card>

				{/* Upcoming Events */}
				<Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 motion-reduce:transition-none">
					<div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-slate-700 bg-linear-to-r from-blue-50/50 dark:from-blue-900/20 to-transparent">
						<h2 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
							<div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
								<CalendarIcon
									width={16}
									height={16}
									className="text-blue-600 dark:text-blue-400"
								/>
							</div>
							Ближайшие события
						</h2>
						<Link
							to="/admin/schedule"
							className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 group transition-[gap,color] duration-200 hover:gap-2"
						>
							Расписание{' '}
							<ArrowRightIcon
								width={14}
								height={14}
								className="group-hover:translate-x-0.5 transition-transform"
							/>
						</Link>
					</div>
					<div className="p-4">
						{upcomingSlots.length > 0 ? (
							<div className="space-y-1">
								{upcomingSlots.map((slot) => (
									<div
										key={slot.id}
										className="flex items-center justify-between p-3.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-700/50 transition-[transform,background-color] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-[1.01] group"
									>
										<div className="flex items-center gap-3">
											<div
												className={`p-2 rounded-lg transition-[transform,background-color] duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-110 ${
													slot.type === 'consultation'
														? 'bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50'
														: 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
												}`}
											>
												{slot.type === 'consultation' ? (
													<ChatBubbleLeftRightIcon
														width={16}
														height={16}
														className="text-purple-600 dark:text-purple-400"
													/>
												) : (
													<AcademicCapIcon
														width={16}
														height={16}
														className="text-blue-600 dark:text-blue-400"
													/>
												)}
											</div>
											<div>
												<p className="font-medium text-neutral-900 dark:text-white text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
													{slot.title}
												</p>
												<p className="text-xs text-neutral-500 dark:text-slate-400">
													{new Date(slot.date).toLocaleDateString('ru-RU', {
														day: 'numeric',
														month: 'short',
													})}{' '}
													• {slot.time}
												</p>
											</div>
										</div>
										<span
											className={`text-xs font-medium px-2.5 py-1 rounded-full transition-[transform,color,box-shadow] duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-105 ${
												slot.type === 'consultation'
													? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shadow-sm'
													: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm'
											}`}
										>
											{slot.type === 'consultation' ? 'Консультация' : 'МК'}
										</span>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8 text-neutral-500 dark:text-slate-400">
								<CalendarIcon
									width={32}
									height={32}
									className="mx-auto mb-2 text-neutral-300 dark:text-slate-600"
								/>
								<p>Добавьте события в расписании</p>
								<Link
									to="/admin/schedule"
									className="inline-block mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700"
								>
									Перейти к расписанию →
								</Link>
							</div>
						)}
					</div>
				</Card>
			</div>

			{/* Quick Actions */}
			<Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 motion-reduce:transition-none">
				<div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-slate-700 bg-linear-to-r from-primary-50/50 dark:from-primary-900/20 to-transparent">
					<h2 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
						<div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30">
							<SparklesIcon
								width={16}
								height={16}
								className="text-primary-600 dark:text-primary-400"
							/>
						</div>
						Быстрые действия
					</h2>
				</div>
				<div className="p-4">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<Link
							to="/admin/consultations/new"
							className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-neutral-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-[transform,box-shadow,border-color,background-color] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-105 hover:shadow-md"
						>
							<div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:scale-110 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-[transform,box-shadow,background-color] duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
								<ChatBubbleLeftRightIcon
									width={20}
									height={20}
									className="text-purple-600 dark:text-purple-400"
								/>
							</div>
							<span className="text-sm font-medium text-neutral-700 dark:text-slate-300 text-center group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
								Добавить консультацию
							</span>
						</Link>
						<Link
							to="/admin/masterclasses/new"
							className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-neutral-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-[transform,box-shadow,border-color,background-color] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-105 hover:shadow-md"
						>
							<div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-[transform,box-shadow,background-color] duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
								<AcademicCapIcon
									width={20}
									height={20}
									className="text-blue-600 dark:text-blue-400"
								/>
							</div>
							<span className="text-sm font-medium text-neutral-700 dark:text-slate-300 text-center group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
								Добавить мастер-класс
							</span>
						</Link>
						<Link
							to="/admin/products/new"
							className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-[transform,box-shadow,border-color,background-color] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-105 hover:shadow-md"
						>
							<div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl group-hover:scale-110 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-[transform,box-shadow,background-color] duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
								<CubeIcon
									width={20}
									height={20}
									className="text-primary-600 dark:text-primary-400"
								/>
							</div>
							<span className="text-sm font-medium text-neutral-700 dark:text-slate-300 text-center group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
								Добавить товар
							</span>
						</Link>
						<Link
							to="/admin/schedule"
							className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-neutral-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-[transform,box-shadow,border-color,background-color] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-105 hover:shadow-md"
						>
							<div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl group-hover:scale-110 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-[transform,box-shadow,background-color] duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 shadow-sm group-hover:shadow-md">
								<ClockIcon
									width={20}
									height={20}
									className="text-emerald-600 dark:text-emerald-400"
								/>
							</div>
							<span className="text-sm font-medium text-neutral-700 dark:text-slate-300 text-center group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
								Добавить слот
							</span>
						</Link>
					</div>
				</div>
			</Card>
		</div>
	);
};
