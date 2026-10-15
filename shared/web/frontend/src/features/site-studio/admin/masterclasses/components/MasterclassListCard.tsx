import * as React from 'react';
import {
	EyeIcon,
	EyeSlashIcon,
	PencilSquareIcon,
	TrashIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminLink as Link } from '../../components/AdminLink';
import { Card } from '@components/atoms/Card';
import { getUploadedImageUrl } from '@utils/imageUrl';
import type { MasterclassAdmin, MasterclassCategory } from '@typings/admin';

interface MasterclassListCardProps {
	masterclass: MasterclassAdmin;
	categoryLabels: Record<MasterclassCategory, string>;
	onToggleStatus: (id: string) => void;
	onDelete: (id: string) => void;
}

const publishedBadgeClass =
	'border border-emerald-400/90 dark:border-emerald-600/80 bg-emerald-200 dark:bg-emerald-900/45 text-emerald-950 dark:text-emerald-100';

const draftBadgeClass =
	'border border-amber-500/80 dark:border-amber-600/80 bg-amber-200 dark:bg-amber-900/45 text-amber-950 dark:text-amber-100';

export const MasterclassListCard: React.FC<MasterclassListCardProps> = ({
	masterclass,
	categoryLabels,
	onToggleStatus,
	onDelete,
}) => {
	const { t } = useTranslation('siteStudio');
	const statusPublished = masterclass.status === 'active';

	return (
		<Card className="p-6 border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800">
			<div className="flex items-start gap-6">
				{/* Image placeholder */}
				<div className="w-24 shrink-0 aspect-square rounded-xl bg-neutral-100 dark:bg-slate-700 overflow-hidden">
					{masterclass.image ? (
						<img
							src={getUploadedImageUrl(masterclass.image)}
							alt={masterclass.title}
							loading="lazy"
							decoding="async"
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center px-1 text-center">
							<span className="text-neutral-400 dark:text-slate-500 text-xs">
								{t('adminCatalog.common.noPhoto')}
							</span>
						</div>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<Link
									to={`/admin/masterclasses/${masterclass.id}`}
									className="text-lg font-semibold text-neutral-900 dark:text-white rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
								>
									{masterclass.title}
								</Link>
								<span className="px-2 py-0.5 rounded-full border border-blue-300/80 dark:border-blue-700/80 bg-blue-200 dark:bg-blue-900/40 text-blue-950 dark:text-blue-100 text-xs font-semibold">
									{categoryLabels[masterclass.category]}
								</span>
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
							<p className="text-neutral-600 dark:text-slate-400 mt-1 line-clamp-2">
								{masterclass.shortDescription}
							</p>
						</div>

						<div className="flex items-center gap-2 shrink-0">
							<button
								type="button"
								onClick={() => onToggleStatus(masterclass.id)}
								className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200 transition-colors motion-reduce:transition-none"
								title={masterclass.status === 'active' ? 'Скрыть' : 'Показать'}
								aria-label={
									masterclass.status === 'active' ? 'Скрыть' : 'Показать'
								}
							>
								{masterclass.status === 'active' ? (
									<EyeIcon width={18} height={18} />
								) : (
									<EyeSlashIcon width={18} height={18} />
								)}
							</button>
							<Link
								to={`/admin/masterclasses/${masterclass.id}`}
								className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200 transition-colors"
								aria-label={t('adminCatalog.common.edit')}
							>
								<PencilSquareIcon width={18} height={18} />
							</Link>
							<button
								type="button"
								onClick={() => onDelete(masterclass.id)}
								className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors motion-reduce:transition-none"
								aria-label={t('adminCatalog.common.delete')}
							>
								<TrashIcon width={18} height={18} />
							</button>
						</div>
					</div>

					<div className="flex items-center gap-6 mt-4 text-sm flex-wrap text-neutral-600 dark:text-slate-400">
						<div>
							<span className="text-neutral-500 dark:text-slate-500">
								Цена:
							</span>{' '}
							<span className="font-semibold text-neutral-900 dark:text-slate-100">
								{masterclass.priceNote === 'от' && 'от '}
								{masterclass.price.toLocaleString('ru-RU')} ₽
								{masterclass.priceNote &&
									masterclass.priceNote !== 'от' &&
									` ${masterclass.priceNote}`}
							</span>
						</div>
						<div>
							<span className="text-neutral-500 dark:text-slate-500">
								Длительность:
							</span>{' '}
							<span className="font-semibold text-neutral-900 dark:text-slate-100">
								{masterclass.duration} мин
							</span>
						</div>
						<div className="flex items-center gap-1">
							<UsersIcon width={16} height={16} className="text-neutral-400" />
							<span className="text-neutral-500">
								{masterclass.minParticipants &&
									`${masterclass.minParticipants}-`}
								{masterclass.maxParticipants} чел.
							</span>
						</div>
					</div>
				</div>
			</div>
		</Card>
	);
};
