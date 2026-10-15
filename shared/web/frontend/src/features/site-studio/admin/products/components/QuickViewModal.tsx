import * as React from 'react';
import {
	ArrowTopRightOnSquareIcon,
	CalendarIcon,
	CubeIcon,
	DocumentDuplicateIcon,
	PencilSquareIcon,
	RectangleStackIcon,
	TagIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { AdminLink as Link } from '../../components/AdminLink';
import { Button } from '@components/atoms/Button';
import { getProductImage } from '@utils/productImages';
import type { Product } from '@typings/product';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';

interface QuickViewModalProps {
	product: Product | null;
	isOpen: boolean;
	onClose: () => void;
	onDuplicate: (product: Product) => void;
	collectionLabels: Record<string, string>;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
	product,
	isOpen,
	onClose,
	onDuplicate,
	collectionLabels,
}) => {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	if (!isOpen || !product) return null;

	const imageUrl = product.image
		? getProductImage(product.image, product.name)
		: null;
	const isNew =
		product.createdAt &&
		new Date(product.createdAt) >
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	return (
		<div
			className="fixed inset-0 flex items-center justify-center p-4"
			style={{ zIndex: embeddedModalZ.backdrop }}
		>
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 border-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-0 cursor-default"
				onClick={onClose}
				aria-label="Закрыть"
			/>

			{/* Modal */}
			<div
				className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300"
				style={{ zIndex: embeddedModalZ.content }}
			>
				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					aria-label="Закрыть просмотр"
					title="Закрыть"
					className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-[background-color,color,box-shadow] duration-200 shadow-lg"
				>
					<XMarkIcon width={20} height={20} aria-hidden />
				</button>

				<div className="flex flex-col md:flex-row">
					{/* Image */}
					<div className="md:w-1/2 relative">
						<div className="aspect-square bg-linear-to-br from-neutral-100 to-neutral-50 dark:from-slate-800 dark:to-slate-900">
							{imageUrl ? (
								<img
									src={imageUrl}
									alt={product.name}
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center">
									<CubeIcon
										width={64}
										height={64}
										className="text-neutral-300 dark:text-slate-600"
									/>
								</div>
							)}
						</div>

						{/* Badges */}
						<div className="absolute top-4 left-4 flex flex-col gap-2">
							{isNew && (
								<span className="px-3 py-1 bg-linear-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
									✨ Новинка
								</span>
							)}
							<span
								className={`px-3 py-1 text-xs font-bold rounded-full shadow-lg ${
									product.inStock
										? 'bg-emerald-500 text-white'
										: 'bg-red-500 text-white'
								}`}
							>
								{product.inStock ? '✓ В наличии' : '✗ Нет в наличии'}
							</span>
						</div>
					</div>

					{/* Content */}
					<div className="md:w-1/2 p-6 md:p-8 flex flex-col">
						{/* Collection badge */}
						<div className="flex items-center gap-2 mb-3">
							<span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full">
								{collectionLabels[product.collection || ''] ||
									product.collection ||
									'Без коллекции'}
							</span>
						</div>

						{/* Title */}
						<h2 className="text-2xl font-display font-bold text-neutral-900 dark:text-white mb-4">
							{product.name}
						</h2>

						{/* Price */}
						<div className="mb-6">
							{product.variants && product.variants.length > 0 ? (
								<div className="space-y-2">
									<p className="text-sm text-neutral-500 dark:text-slate-400 flex items-center gap-2">
										<RectangleStackIcon width={14} height={14} />
										{product.variants.length} вариант
										{product.variants.length > 1 ? 'а' : ''}
									</p>
									<div className="flex flex-wrap gap-2">
										{product.variants.map((v) => (
											<span
												key={v.id}
												className="px-3 py-1.5 bg-neutral-100 dark:bg-slate-800 rounded-lg text-sm"
											>
												<span className="text-neutral-600 dark:text-slate-400">
													{v.volume}
												</span>
												<span className="mx-2 text-neutral-300 dark:text-slate-600">
													—
												</span>
												<span className="font-bold text-neutral-900 dark:text-white">
													{v.price.toLocaleString('ru-RU')} ₽
												</span>
											</span>
										))}
									</div>
								</div>
							) : (
								<div className="flex items-baseline gap-2">
									<span className="text-3xl font-bold text-neutral-900 dark:text-white">
										{product.price.toLocaleString('ru-RU')} ₽
									</span>
									{product.volume && (
										<span className="text-neutral-500 dark:text-slate-400">
											/ {product.volume}
										</span>
									)}
								</div>
							)}
						</div>

						{/* Description preview */}
						{product.description && (
							<p className="text-sm text-neutral-600 dark:text-slate-400 mb-6 line-clamp-3">
								{product.description}
							</p>
						)}

						{/* Meta info */}
						<div className="grid grid-cols-2 gap-3 mb-6 text-sm">
							<div className="flex items-center gap-2 text-neutral-500 dark:text-slate-400">
								<CalendarIcon width={14} height={14} />
								<span>
									Создан:{' '}
									{new Date(product.createdAt).toLocaleDateString('ru-RU')}
								</span>
							</div>
							<div className="flex items-center gap-2 text-neutral-500 dark:text-slate-400">
								<TagIcon width={14} height={14} />
								<span>ID: {product.id.slice(0, 8)}...</span>
							</div>
						</div>

						{/* Actions */}
						<div className="mt-auto flex flex-wrap gap-2">
							<Link to={`/admin/products/${product.id}`} className="flex-1">
								<Button className="w-full">
									<PencilSquareIcon width={16} height={16} className="mr-2" />
									Редактировать
								</Button>
							</Link>
							<Button
								variant="outline"
								onClick={() => onDuplicate(product)}
								className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
							>
								<DocumentDuplicateIcon
									width={16}
									height={16}
									className="mr-2"
								/>
								Дублировать
							</Button>
							<Link to={`/catalog/${product.id}`} target="_blank">
								<Button
									variant="ghost"
									className="dark:text-slate-400 dark:hover:text-white"
								>
									<ArrowTopRightOnSquareIcon width={16} height={16} />
								</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
