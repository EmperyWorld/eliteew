import * as React from 'react';
import { Bars2Icon, PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Card } from '@components/atoms/Card';
import { Checkbox } from '@components/atoms/Checkbox';
import { getUploadedImageUrl } from '@utils/imageUrl';

interface GalleryImageItemProps {
	image: {
		id: string;
		url: string;
		alt: string;
		category: string;
	};
	categories: Record<string, string>;
	selected?: boolean;
	selectionMode?: boolean;
	onToggleSelect?: (id: string) => void;
	onDelete: (id: string) => void;
	onUpdateAlt: (id: string, alt: string) => void;
	onUpdateCategory: (id: string, category: string) => void;
}

export const GalleryImageItem: React.FC<GalleryImageItemProps> = ({
	image,
	categories,
	selected,
	selectionMode,
	onToggleSelect,
	onDelete,
	onUpdateAlt,
	onUpdateCategory,
}) => {
	return (
		<Card
			className={`overflow-hidden group relative border-2 transition-colors ${selected ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-200/80 dark:ring-primary-900/50' : 'border-transparent'}`}
		>
			{(selectionMode || selected) && onToggleSelect && (
				<div className="absolute left-2 top-2 z-20">
					<div className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-white/90 p-1 shadow-md dark:bg-slate-900/90">
						<Checkbox
							checked={Boolean(selected)}
							onChange={() => onToggleSelect(image.id)}
							aria-label={`Выбрать изображение ${image.alt || image.id}`}
							className="scale-110"
						/>
					</div>
				</div>
			)}
			<div className="aspect-square bg-neutral-100 relative dark:bg-slate-800">
				{image.url ? (
					<img
						src={getUploadedImageUrl(image.url)}
						alt={image.alt}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<PhotoIcon width={48} height={48} className="text-neutral-300" />
					</div>
				)}

				{/* Overlay actions */}
				<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => onDelete(image.id)}
						className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-white p-2 text-red-600 hover:bg-red-50"
						aria-label="Удалить"
					>
						<TrashIcon width={18} height={18} />
					</button>
				</div>

				{/* Drag handle */}
				<div className="absolute top-2 left-2 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
					<Bars2Icon width={16} height={16} className="text-neutral-400" />
				</div>
			</div>

			<div className="p-3 space-y-2">
				<input
					type="text"
					value={image.alt}
					onChange={(e) => onUpdateAlt(image.id, e.target.value)}
					placeholder="Описание"
					className="w-full text-sm border-0 border-b border-neutral-200 bg-transparent px-0 py-1 focus:border-primary-500 focus:ring-0 focus:outline-none"
					aria-label="Описание изображения"
				/>
				<select
					value={image.category}
					onChange={(e) => onUpdateCategory(image.id, e.target.value)}
					className="w-full text-xs border border-neutral-200 rounded-lg px-2 py-1 bg-white focus:border-primary-300 focus:outline-none"
					aria-label="Категория"
				>
					{Object.entries(categories).map(([key, label]) => (
						<option key={key} value={key}>
							{label}
						</option>
					))}
				</select>
			</div>
		</Card>
	);
};
