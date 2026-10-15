/**
 * 🔥 UI COMPONENTS V2 - INDEX
 *
 * Централизованный экспорт всех UI компонентов V2
 *
 * @version 2.0.0
 * @author React UI God
 */

// ============================================================================
// COMPONENTS
// ============================================================================

export { ButtonV2, buttonVariants } from './ButtonV2';
export type { ButtonProps, ButtonVariantsType } from './ButtonV2';

export { InputV2, inputVariants } from './InputV2';
export type { InputV2Props, InputVariantsType } from './InputV2';

export { ModalV2, modalVariants } from './ModalV2';
export type {
	ModalProps,
	ModalVariantsType,
	ModalSubComponentProps,
} from './ModalV2';

export { CardV2, cardVariants } from './CardV2';
export type {
	CardV2Props,
	CardVariantsType,
	CardSubComponentProps,
} from './CardV2';

export { SelectV2 } from './SelectV2';
export type { SelectV2Props, SelectOption } from './SelectV2';

export { TooltipV2 } from './TooltipV2';
export type { TooltipV2Props, TooltipPlacement } from './TooltipV2';

// ============================================================================
// UTILITIES
// ============================================================================

export { cn } from '../../utils/cn';
export { focusRing, animations } from '../../utils/designHelpers';
