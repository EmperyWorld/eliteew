/**
 * React 19 Hooks - Barrel Export
 *
 * Централизованный экспорт всех React 19 хуков и примеров
 *
 * @module hooks/react19
 */

// useFormStatus examples
export { FormStatusIndicator, SubmitButton } from './useFormStatus';
export type { SubmitButtonProps } from './useFormStatus';

// useOptimistic examples
export { useOptimisticLike, useOptimisticTodo } from './useOptimistic';
export type { Todo } from './useOptimistic';

// useActionState examples
export { useCreateComment, useSearch, useUpdateUser } from './useActionState';
export type { ActionState } from './useActionState';
