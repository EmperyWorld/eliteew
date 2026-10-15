import * as React from 'react';
import {
	ArrowsUpDownIcon,
	ClockIcon,
	CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { Input } from '@components/atoms/Input';

interface ConsultationParamsProps {
	price: number;
	duration: number;
	order: number;
	onChange: (field: string, value: number) => void;
}

export const ConsultationParams: React.FC<ConsultationParamsProps> = ({
	price,
	duration,
	order,
	onChange,
}) => {
	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
			{/* Card Header */}
			<div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
				<h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
					<ArrowsUpDownIcon
						width={18}
						height={18}
						className="text-purple-500"
					/>
					Параметры
				</h2>
				<p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
					Цена, длительность и порядок
				</p>
			</div>

			{/* Card Content */}
			<div className="p-6 space-y-5">
				<div>
					<label
						htmlFor="consultation-price"
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<CurrencyDollarIcon
							width={14}
							height={14}
							className="text-neutral-400 dark:text-slate-500"
						/>
						Цена (₽) <span className="text-red-500">*</span>
					</label>
					<Input
						id="consultation-price"
						type="number"
						value={price}
						onChange={(e) =>
							onChange('price', parseInt(e.target.value, 10) || 0)
						}
						min={0}
						step={100}
						required
						className="bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100"
						aria-label="Цена"
					/>
					<p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
						Стоимость консультации в рублях
					</p>
				</div>

				<div>
					<label
						htmlFor="consultation-duration"
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<ClockIcon
							width={14}
							height={14}
							className="text-neutral-400 dark:text-slate-500"
						/>
						Длительность (мин) <span className="text-red-500">*</span>
					</label>
					<Input
						id="consultation-duration"
						type="number"
						value={duration}
						onChange={(e) =>
							onChange('duration', parseInt(e.target.value, 10) || 0)
						}
						min={15}
						step={15}
						required
						className="bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100"
						aria-label="Длительность"
					/>
					<p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
						Продолжительность консультации в минутах
					</p>
				</div>

				<div>
					<label
						htmlFor="consultation-order"
						className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						<ArrowsUpDownIcon
							width={14}
							height={14}
							className="text-neutral-400 dark:text-slate-500"
						/>
						Порядок сортировки
					</label>
					<Input
						id="consultation-order"
						type="number"
						value={order}
						onChange={(e) =>
							onChange('order', parseInt(e.target.value, 10) || 0)
						}
						min={0}
						className="bg-white dark:bg-slate-700 border-neutral-200 dark:border-slate-600 text-neutral-900 dark:text-slate-100"
						aria-label="Порядок сортировки"
					/>
					<p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
						Чем меньше число, тем выше в списке
					</p>
				</div>
			</div>
		</div>
	);
};
