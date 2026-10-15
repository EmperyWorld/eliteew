import * as React from 'react';
import { useId } from 'react';
import { Card } from '@components/atoms/Card';
import { Input } from '@components/atoms/Input';

interface MasterclassParamsProps {
	price: number;
	priceNote: string;
	duration: number;
	minParticipants: number | undefined;
	maxParticipants: number;
	order: number;
	onChange: (field: string, value: number | string | undefined) => void;
}

export const MasterclassParams: React.FC<MasterclassParamsProps> = ({
	price,
	priceNote,
	duration,
	minParticipants,
	maxParticipants,
	order,
	onChange,
}) => {
	const priceId = useId();
	const priceNoteId = useId();
	const durationId = useId();
	const minPartId = useId();
	const maxPartId = useId();
	const orderId = useId();

	return (
		<Card className="p-6 space-y-6">
			<h2 className="text-lg font-semibold text-neutral-900">Параметры</h2>

			<div>
				<label
					htmlFor={priceId}
					className="block text-sm font-medium text-neutral-700 mb-2"
				>
					Цена (₽) *
				</label>
				<Input
					id={priceId}
					type="number"
					value={price}
					onChange={(e) => onChange('price', parseInt(e.target.value, 10) || 0)}
					min={0}
					step={100}
					required
					aria-label="Цена"
				/>
			</div>

			<div>
				<label
					htmlFor={priceNoteId}
					className="block text-sm font-medium text-neutral-700 mb-2"
				>
					Примечание к цене
				</label>
				<Input
					id={priceNoteId}
					value={priceNote}
					onChange={(e) => onChange('priceNote', e.target.value)}
					placeholder="с человека, от, и т.д."
					aria-label="Примечание к цене"
				/>
			</div>

			<div>
				<label
					htmlFor={durationId}
					className="block text-sm font-medium text-neutral-700 mb-2"
				>
					Длительность (мин) *
				</label>
				<Input
					id={durationId}
					type="number"
					value={duration}
					onChange={(e) =>
						onChange('duration', parseInt(e.target.value, 10) || 0)
					}
					min={15}
					step={15}
					required
					aria-label="Длительность"
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<label
						htmlFor={minPartId}
						className="block text-sm font-medium text-neutral-700 mb-2"
					>
						Мин. участников
					</label>
					<Input
						id={minPartId}
						type="number"
						value={minParticipants || ''}
						onChange={(e) =>
							onChange(
								'minParticipants',
								e.target.value ? parseInt(e.target.value, 10) : undefined
							)
						}
						min={1}
						aria-label="Мин. участников"
					/>
				</div>
				<div>
					<label
						htmlFor={maxPartId}
						className="block text-sm font-medium text-neutral-700 mb-2"
					>
						Макс. участников *
					</label>
					<Input
						id={maxPartId}
						type="number"
						value={maxParticipants}
						onChange={(e) =>
							onChange('maxParticipants', parseInt(e.target.value, 10) || 1)
						}
						min={1}
						required
						aria-label="Макс. участников"
					/>
				</div>
			</div>

			<div>
				<label
					htmlFor={orderId}
					className="block text-sm font-medium text-neutral-700 mb-2"
				>
					Порядок сортировки
				</label>
				<Input
					id={orderId}
					type="number"
					value={order}
					onChange={(e) => onChange('order', parseInt(e.target.value, 10) || 0)}
					min={0}
					aria-label="Порядок сортировки"
				/>
			</div>
		</Card>
	);
};
