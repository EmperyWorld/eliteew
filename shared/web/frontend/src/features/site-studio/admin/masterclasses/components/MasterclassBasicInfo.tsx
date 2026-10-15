import * as React from 'react';
import { useId } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Textarea } from '@components/atoms/Textarea';
import { Card } from '@components/atoms/Card';
import type { MasterclassCategory } from '@typings/admin';

interface MasterclassBasicInfoProps {
	isNew: boolean;
	title: string;
	slug: string;
	category: MasterclassCategory;
	level: string;
	shortDescription: string;
	description: string;
	categoryLabels: Record<MasterclassCategory, string>;
	levelLabels: Record<string, string>;
	onBack: () => void;
	onChange: (field: string, value: string) => void;
	onGenerateSlug: () => void;
}

export const MasterclassBasicInfo: React.FC<MasterclassBasicInfoProps> = ({
	isNew,
	title,
	slug,
	category,
	level,
	shortDescription,
	description,
	categoryLabels,
	levelLabels,
	onBack,
	onChange,
	onGenerateSlug,
}) => {
	const titleId = useId();
	const slugId = useId();
	const categoryId = useId();
	const levelId = useId();
	const shortDescId = useId();
	const descriptionId = useId();

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<button
					type="button"
					onClick={onBack}
					className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
					aria-label="Назад"
				>
					<ArrowLeftIcon width={24} height={24} />
				</button>
				<div>
					<h1 className="text-3xl font-display font-semibold text-neutral-900">
						{isNew ? 'Новый мастер-класс' : 'Редактирование мастер-класса'}
					</h1>
					<p className="text-neutral-500 mt-1">
						{isNew ? 'Создание нового мастер-класса' : title}
					</p>
				</div>
			</div>

			<Card className="p-6 space-y-6 border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800">
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
					Основная информация
				</h2>

				<div className="space-y-6">
					<fieldset
						className="rounded-xl border border-neutral-200 dark:border-slate-600 p-4 space-y-4"
						aria-labelledby="mc-group-identity"
					>
						<p
							id="mc-group-identity"
							className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400"
						>
							Название и URL
						</p>
						<div>
							<label
								htmlFor={titleId}
								className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
							>
								Название *
							</label>
							<Input
								id={titleId}
								value={title}
								onChange={(e) => onChange('title', e.target.value)}
								placeholder="Например: Парфюмерный девичник"
								required
								onBlur={() => !slug && onGenerateSlug()}
								aria-label="Название"
							/>
						</div>

						<div>
							<label
								htmlFor={slugId}
								className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
							>
								URL (slug)
							</label>
							<div className="flex gap-2">
								<Input
									id={slugId}
									value={slug}
									onChange={(e) => onChange('slug', e.target.value)}
									placeholder="parfyumernyj-devichnik"
									className="flex-1"
									aria-label="Slug"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={onGenerateSlug}
								>
									Сгенерировать
								</Button>
							</div>
							<p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
								/masterclasses/{slug || 'slug'}
							</p>
						</div>
					</fieldset>

					<fieldset
						className="rounded-xl border border-neutral-200 dark:border-slate-600 p-4 space-y-4"
						aria-labelledby="mc-group-classification"
					>
						<p
							id="mc-group-classification"
							className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400"
						>
							Тип и аудитория
						</p>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor={categoryId}
									className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
								>
									Категория *
								</label>
								<select
									id={categoryId}
									value={category}
									onChange={(e) =>
										onChange('category', e.target.value as MasterclassCategory)
									}
									className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-200 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
									aria-label="Категория"
								>
									{Object.entries(categoryLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</div>
							<div>
								<label
									htmlFor={levelId}
									className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
								>
									Уровень
								</label>
								<select
									id={levelId}
									value={level}
									onChange={(e) => onChange('level', e.target.value)}
									className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-200 transition focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200"
									aria-label="Уровень"
								>
									{Object.entries(levelLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</div>
						</div>
					</fieldset>

					<fieldset
						className="rounded-xl border border-neutral-200 dark:border-slate-600 p-4 space-y-4"
						aria-labelledby="mc-group-copy"
					>
						<p
							id="mc-group-copy"
							className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400"
						>
							Тексты
						</p>
						<div>
							<label
								htmlFor={shortDescId}
								className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
							>
								Краткое описание *
							</label>
							<Input
								id={shortDescId}
								value={shortDescription}
								onChange={(e) => onChange('shortDescription', e.target.value)}
								placeholder="Краткое описание для карточки"
								required
								aria-label="Краткое описание"
							/>
						</div>

						<div>
							<label
								htmlFor={descriptionId}
								className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
							>
								Полное описание *
							</label>
							<Textarea
								id={descriptionId}
								value={description}
								onChange={(e) => onChange('description', e.target.value)}
								placeholder="Подробное описание мастер-класса..."
								rows={6}
								required
								aria-label="Полное описание"
							/>
						</div>
					</fieldset>
				</div>
			</Card>
		</div>
	);
};
