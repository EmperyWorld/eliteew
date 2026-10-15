/**
 * 🔥 INPUT V2 - React UI God Edition
 *
 * Production-ready input component с:
 * - Floating labels (Material Design style)
 * - Validation states (success, error, warning)
 * - Icon support (left/right)
 * - Password toggle visibility
 * - Character counter
 * - Helper text
 * - Glassmorphism design
 * - Framer Motion animations
 *
 * @version 2.0.0
 * @author React UI God
 */

import * as React from 'react';
import { forwardRef, useState, useId, type InputHTMLAttributes } from 'react';
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from '@/utils/cva';
import { cn } from '../../utils/cn';

// ============================================================================
// VARIANTS DEFINITION (CVA)
// ============================================================================

const inputVariants = cva(
	// Base styles
	`
    w-full px-4 py-3 rounded-xl
    bg-white/5 backdrop-blur-xl
    border-2 transition-all duration-200
    text-white placeholder:text-white/40
    focus:outline-hidden
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
	{
		variants: {
			// ========================================
			// VARIANT (состояние)
			// ========================================
			variant: {
				default: `
          border-white/20
          focus:border-blue-500/50
          focus:bg-white/10
          focus:ring-2 focus:ring-blue-500/20
        `,
				success: `
          border-green-500/50
          focus:border-green-500
          focus:bg-green-500/5
          focus:ring-2 focus:ring-green-500/20
        `,
				error: `
          border-red-500/50
          focus:border-red-500
          focus:bg-red-500/5
          focus:ring-2 focus:ring-red-500/20
        `,
				warning: `
          border-yellow-500/50
          focus:border-yellow-500
          focus:bg-yellow-500/5
          focus:ring-2 focus:ring-yellow-500/20
        `,
			},

			// ========================================
			// SIZE
			// ========================================
			size: {
				sm: 'px-3 py-2 text-sm',
				md: 'px-4 py-3 text-base',
				lg: 'px-5 py-4 text-lg',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	}
);

// ============================================================================
// TYPES
// ============================================================================

type InputVariantsType = VariantProps<typeof inputVariants>;

export interface InputV2Props
	extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
		InputVariantsType {
	/** Label текст */
	label?: string;
	/** Helper текст под инпутом */
	helperText?: string;
	/** Error message */
	error?: string;
	/** Success message */
	success?: string;
	/** Warning message */
	warning?: string;
	/** Иконка слева */
	iconLeft?: React.ReactNode;
	/** Иконка справа */
	iconRight?: React.ReactNode;
	/** Показывать счётчик символов */
	showCharacterCount?: boolean;
	/** Максимальная длина (для счётчика) */
	maxLength?: number;
	/** Кастомный className для wrapper */
	wrapperClassName?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const InputV2 = forwardRef<HTMLInputElement, InputV2Props>(
	(
		{
			label,
			helperText,
			error,
			success,
			warning,
			iconLeft,
			iconRight,
			showCharacterCount,
			maxLength,
			wrapperClassName,
			variant,
			size,
			className,
			type: initialType = 'text',
			value,
			disabled,
			...props
		},
		ref
	) => {
		const id = useId();
		const [isFocused, setIsFocused] = useState(false);
		const [showPassword, setShowPassword] = useState(false);
		const [inputValue, setInputValue] = useState(value || '');

		// Определяем тип инпута (с учётом toggle password)
		const inputType =
			initialType === 'password' && showPassword ? 'text' : initialType;

		// Определяем variant на основе состояния
		const computedVariant = error
			? 'error'
			: success
				? 'success'
				: warning
					? 'warning'
					: variant;

		// Проверяем, есть ли значение или фокус (для floating label)
		const hasValue = !!inputValue || !!value;
		const isLabelFloating = isFocused || hasValue;

		// Иконка состояния
		const StateIcon = error
			? ExclamationCircleIcon
			: success
				? CheckCircleIcon
				: warning
					? ExclamationTriangleIcon
					: null;

		// ========================================
		// HANDLERS
		// ========================================

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
			setInputValue(e.target.value);
			props.onChange?.(e);
		};

		const handleTogglePassword = (): void => {
			setShowPassword(!showPassword);
		};

		// ========================================
		// RENDER
		// ========================================

		return (
			<div className={cn('relative w-full', wrapperClassName)}>
				{/* Input Container */}
				<div className="relative">
					{/* Left Icon */}
					{iconLeft && (
						<div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none">
							{iconLeft}
						</div>
					)}

					{/* Input Field */}
					<input
						ref={ref}
						id={id}
						type={inputType}
						value={value}
						disabled={disabled}
						maxLength={maxLength}
						aria-invalid={!!error}
						aria-describedby={
							error || helperText || success || warning
								? `${id}-desc`
								: undefined
						}
						className={cn(
							inputVariants({ variant: computedVariant, size }),
							iconLeft && 'pl-12',
							(iconRight || StateIcon || initialType === 'password') && 'pr-12',
							className
						)}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
						onChange={handleChange}
						placeholder={!label ? props.placeholder : ' '} // Space для floating label
						{...props}
					/>

					{/* Floating Label */}
					{label && (
						<motion.label
							htmlFor={id}
							className={cn(
								'absolute left-4 pointer-events-none transition-all duration-200',
								iconLeft && 'left-12',
								isLabelFloating
									? 'top-1 text-xs font-medium text-white/80'
									: 'top-1/2 -translate-y-1/2 text-base text-white/60'
							)}
							animate={{
								fontSize: isLabelFloating ? '0.75rem' : '1rem',
								y: isLabelFloating ? 0 : '-50%',
							}}
							transition={{ duration: 0.2 }}
						>
							{label}
						</motion.label>
					)}

					{/* Right Side Icons */}
					<div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
						{/* State Icon */}
						{StateIcon && (
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								className={cn(
									'shrink-0',
									error && 'text-red-400',
									success && 'text-green-400',
									warning && 'text-yellow-400'
								)}
							>
								<StateIcon className="w-5 h-5" />
							</motion.div>
						)}

						{/* Password Toggle */}
						{initialType === 'password' && (
							<button
								type="button"
								onClick={handleTogglePassword}
								className="min-h-8 min-w-8 rounded-md text-white/60 hover:text-white transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/40"
								tabIndex={-1}
								aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
							>
								{showPassword ? (
									<EyeSlashIcon className="w-5 h-5" />
								) : (
									<EyeIcon className="w-5 h-5" />
								)}
							</button>
						)}

						{/* Custom Right Icon */}
						{iconRight && <div className="text-white/60">{iconRight}</div>}
					</div>
				</div>

				{/* Helper/Error/Success/Warning Text */}
				<AnimatePresence mode="wait">
					{(error || success || warning || helperText) && (
						<motion.div
							id={`${id}-desc`}
							initial={{ opacity: 0, y: -5 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -5 }}
							transition={{ duration: 0.2 }}
							className={cn(
								'mt-1.5 text-sm flex items-start gap-1.5',
								error && 'text-red-400',
								success && 'text-green-400',
								warning && 'text-yellow-400',
								!error && !success && !warning && 'text-white/60'
							)}
							role={error ? 'alert' : undefined}
						>
							<span>{error || success || warning || helperText}</span>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Character Counter */}
				{showCharacterCount && maxLength && (
					<div className="mt-1 text-xs text-white/40 text-right">
						{String(inputValue || value || '').length} / {maxLength}
					</div>
				)}
			</div>
		);
	}
);

InputV2.displayName = 'InputV2';

// ============================================================================
// EXPORTS
// ============================================================================

export { inputVariants };
export type { InputVariantsType };
