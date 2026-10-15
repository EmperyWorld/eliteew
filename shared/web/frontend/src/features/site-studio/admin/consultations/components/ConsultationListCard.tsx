import * as React from 'react';
import {
	ChatBubbleLeftRightIcon,
	ClockIcon,
	CurrencyDollarIcon,
	EyeIcon,
	EyeSlashIcon,
	PencilSquareIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminLink as Link } from '../../components/AdminLink';
import { Card } from '@components/atoms/Card';
import { getUploadedImageUrl } from '@utils/imageUrl';
import type { ConsultationAdmin } from '@typings/admin';

interface ConsultationListCardProps {
	consultation: ConsultationAdmin;
	onToggleStatus: (id: string) => void;
	onDelete: (id: string) => void;
	viewMode?: 'list' | 'grid';
	className?: string;
}

const publishedBadgeClass =
	'border border-emerald-400/90 dark:border-emerald-600/80 bg-emerald-200 dark:bg-emerald-900/45 text-emerald-950 dark:text-emerald-100';

const draftBadgeClass =
	'border border-amber-500/80 dark:border-amber-600/80 bg-amber-200 dark:bg-amber-900/45 text-amber-950 dark:text-amber-100';

export const ConsultationListCard: React.FC<ConsultationListCardProps> = ({
	consultation,
	onToggleStatus,
	onDelete,
	viewMode = 'list',
	className,
}) => {
	const { t } = useTranslation('siteStudio');
	const isGrid = viewMode === 'grid';
	const statusPublished = consultation.status === 'active';

	if (isGrid) {
		return (
			<Card
				className={`p-4 group hover:shadow-lg transition-shadow duration-200 motion-reduce:transition-none border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 h-full flex flex-col ${className ?? ''}`}
			>
				{/* Image */}
				<div className="relative mb-4 w-full aspect-4/3 rounded-xl bg-neutral-100 dark:bg-slate-700 overflow-hidden">
					{consultation.image ? (
						<img
							src={getUploadedImageUrl(consultation.image)}
							alt={consultation.title}
							loading="lazy"
							decoding="async"
							className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<ChatBubbleLeftRightIcon
								width={48}
								height={48}
								className="text-neutral-300 dark:text-slate-600"
							/>
						</div>
					)}
					<div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							type="button"
							onClick={() => onToggleStatus(consultation.id)}
							className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
							aria-label={
								consultation.status === 'active'
									? 'Скрыть консультацию'
									: 'Опубликовать консультацию'
							}
						>
							{consultation.status === 'active' ? (
								<EyeIcon width={16} height={16} />
							) : (
								<EyeSlashIcon width={16} height={16} />
							)}
						</button>
						<Link
							to={`/admin/consultations/${consultation.id}`}
							className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-neutral-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
							aria-label="Редактировать консультацию"
						>
							<PencilSquareIcon width={16} height={16} />
						</Link>
						<button
							type="button"
							onClick={() => onDelete(consultation.id)}
							className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
							aria-label="Удалить консультацию"
						>
							<TrashIcon width={16} height={16} />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="flex flex-1 flex-col space-y-3">
					<div className="flex items-start justify-between gap-2">
						<Link
							to={`/admin/consultations/${consultation.id}`}
							className="text-lg font-semibold text-neutral-900 dark:text-white line-clamp-2 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
						>
							{consultation.title}
						</Link>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{consultation.popular && (
							<span className="px-2 py-0.5 rounded-full border border-amber-500/70 dark:border-amber-600/80 bg-amber-200 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 text-xs font-medium">
								{t('adminCatalog.common.popular')}
							</span>
						)}
						<span
							className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
								statusPublished ? publishedBadgeClass : draftBadgeClass
							}`}
						>
							{statusPublished
								? t('adminCatalog.common.statusActive')
								: t('adminCatalog.common.statusDraft')}
						</span>
					</div>

					{consultation.shortDescription && (
						<p className="text-sm text-neutral-600 dark:text-slate-400 line-clamp-2">
							{consultation.shortDescription}
						</p>
					)}

					<div className="mt-auto flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-slate-700">
						<div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-slate-400">
							<CurrencyDollarIcon width={14} height={14} />
							<span className="font-semibold text-neutral-900 dark:text-white">
								{consultation.price.toLocaleString('ru-RU')} ₽
							</span>
						</div>
						<div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-slate-400">
							<ClockIcon width={14} height={14} />
							<span>
								{consultation.duration} {t('adminCatalog.common.minutesShort')}
							</span>
						</div>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card
			className={`p-6 group hover:shadow-md transition-shadow duration-200 motion-reduce:transition-none border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${className ?? ''}`}
		>
			<div className="flex items-start gap-6">
				{/* Image placeholder */}
				<div className="w-24 shrink-0 aspect-square rounded-xl bg-neutral-100 dark:bg-slate-700 overflow-hidden">
					{consultation.image ? (
						<img
							src={getUploadedImageUrl(consultation.image)}
							alt={consultation.title}
							loading="lazy"
							decoding="async"
							className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<ChatBubbleLeftRightIcon
								width={32}
								height={32}
								className="text-neutral-300 dark:text-slate-600"
							/>
						</div>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 flex-wrap mb-2">
								<Link
									to={`/admin/consultations/${consultation.id}`}
									className="text-lg font-semibold text-neutral-900 dark:text-white rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
								>
									{consultation.title}
								</Link>
								{consultation.popular && (
									<span className="px-2 py-0.5 rounded-full border border-amber-500/70 dark:border-amber-600/80 bg-amber-200 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 text-xs font-medium">
										{t('adminCatalog.common.popular')}
									</span>
								)}
								<span
									className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
										statusPublished ? publishedBadgeClass : draftBadgeClass
									}`}
								>
									{statusPublished
										? t('adminCatalog.common.statusActive')
										: t('adminCatalog.common.statusDraft')}
								</span>
							</div>
							{consultation.shortDescription && (
								<p className="text-sm text-neutral-600 dark:text-slate-400 line-clamp-2 mb-3">
									{consultation.shortDescription}
								</p>
							)}
							<div className="flex items-center gap-6 text-sm">
								<div className="flex items-center gap-1 text-neutral-600 dark:text-slate-400">
									<CurrencyDollarIcon width={14} height={14} />
									<span className="font-semibold text-neutral-900 dark:text-white">
										{consultation.price.toLocaleString('ru-RU')} ₽
									</span>
								</div>
								<div className="flex items-center gap-1 text-neutral-600 dark:text-slate-400">
									<ClockIcon width={14} height={14} />
									<span>
										{consultation.duration}{' '}
										{t('adminCatalog.common.minutesShort')}
									</span>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								type="button"
								onClick={() => onToggleStatus(consultation.id)}
								className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200 transition-colors"
								title={consultation.status === 'active' ? 'Скрыть' : 'Показать'}
								aria-label={
									consultation.status === 'active'
										? 'Скрыть консультацию'
										: 'Опубликовать консультацию'
								}
							>
								{consultation.status === 'active' ? (
									<EyeIcon width={18} height={18} />
								) : (
									<EyeSlashIcon width={18} height={18} />
								)}
							</button>
							<Link
								to={`/admin/consultations/${consultation.id}`}
								className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-neutral-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
								aria-label="Редактировать консультацию"
							>
								<PencilSquareIcon width={18} height={18} />
							</Link>
							<button
								type="button"
								onClick={() => onDelete(consultation.id)}
								className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
								aria-label="Удалить консультацию"
							>
								<TrashIcon width={18} height={18} />
							</button>
						</div>
					</div>
				</div>
			</div>
		</Card>
	);
};
