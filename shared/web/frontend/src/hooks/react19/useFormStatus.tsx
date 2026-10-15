/**
 * React 19 useFormStatus Hook Examples
 *
 * Примеры использования нового хука useFormStatus из React 19
 * для получения статуса формы без пропс-дриллинга
 *
 * @module hooks/react19/useFormStatus
 */

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * Props для SubmitButton компонента
 */
export interface SubmitButtonProps {
	children: ReactNode;
	className?: string;
}

/**
 * Submit Button с автоматическим статусом загрузки
 *
 * Должен использоваться внутри <form> с action prop
 *
 * @example
 * ```tsx
 * import { SubmitButton } from '@hooks/react19';
 *
 * function MyForm() {
 *   async function handleSubmit(formData: FormData) {
 *     await saveData(formData);
 *   }
 *
 *   return (
 *     <form action={handleSubmit}>
 *       <input name="email" />
 *       <SubmitButton>Отправить</SubmitButton>
 *     </form>
 *   );
 * }
 * ```
 */
export function SubmitButton({
	children,
	className,
}: SubmitButtonProps): React.JSX.Element {
	const { pending } = useFormStatus();

	return (
		<button type="submit" disabled={pending} className={className}>
			{pending ? 'Отправка...' : children}
		</button>
	);
}

/**
 * Form Status Indicator
 * Показывает статус формы (pending, data)
 *
 * @example
 * ```tsx
 * import { FormStatusIndicator } from '@hooks/react19';
 *
 * function MyForm() {
 *   return (
 *     <form action={handleSubmit}>
 *       <FormStatusIndicator />
 *       <input name="email" />
 *       <button type="submit">Отправить</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function FormStatusIndicator(): React.JSX.Element | null {
	const { pending, data } = useFormStatus();

	if (!pending && !data) {
		return null;
	}

	return (
		<div className="form-status">
			{pending && <span>Обработка...</span>}
			{data && <span>Данные отправлены</span>}
		</div>
	);
}
