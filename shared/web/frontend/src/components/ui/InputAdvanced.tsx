/**
 * Advanced Input Component - EliteEW UI System 2025
 * Features: Floating labels, animated validation, icons, GPU-accelerated
 * Performance: 60 FPS with transform-based animations
 *
 * @version 2.0.0
 * @date 2025-10-13
 */

import * as React from 'react';
import { useState, useRef, forwardRef, useId } from 'react';
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
	EyeIcon,
	EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from '@/utils/cva';
import { cn } from '../../utils/cn';

/* ============================================================================
   INPUT VARIANTS - Design System
   ============================================================================ */

const inputVariants = cva(
	'w-full px-4 py-3 rounded-lg bg-black/40 backdrop-blur-md border text-white placeholder-white/40 transition-all duration-200 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed',
	{
		variants: {
			variant: {
				default:
					'border-white/10 focus:border-purple-500/50 focus:shadow-lg focus:shadow-purple-500/10',
				success:
					'border-green-500/50 focus:border-green-500 focus:shadow-lg focus:shadow-green-500/10',
				error:
					'border-red-500/50 focus:border-red-500 focus:shadow-lg focus:shadow-red-500/10',
				ghost:
					'border-transparent hover:border-white/10 focus:border-purple-500/30',
				glass:
					'border-white/20 bg-white/5 backdrop-blur-xl focus:border-purple-500/50 focus:shadow-lg focus:shadow-purple-500/20',
			},
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

/* ============================================================================
   TYPES
   ============================================================================ */

export interface InputAdvancedProps
	extends Omit<
			React.InputHTMLAttributes<HTMLInputElement>,
			| 'size'
			| 'onDrag'
			| 'onDragStart'
			| 'onDragEnd'
			| 'onAnimationStart'
			| 'onAnimationEnd'
		>,
		VariantProps<typeof inputVariants> {
	label?: string;
	error?: string;
	success?: string;
	hint?: string;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	fullWidth?: boolean;
	floatingLabel?: boolean;
	showPasswordToggle?: boolean;
}

/* ============================================================================
   INPUT COMPONENT
   ============================================================================ */

export const InputAdvanced = forwardRef<HTMLInputElement, InputAdvancedProps>(
	(
		{
			className,
			variant,
			size,
			label,
			error,
			success,
			hint,
			leftIcon,
			rightIcon,
			fullWidth = true,
			floatingLabel = true,
			showPasswordToggle = false,
			type = 'text',
			disabled,
			value,
			id: idProp,
			...props
		},
		ref
	) => {
		const generatedId = useId();
		const inputId = idProp ?? generatedId;
		const descId = `${inputId}-field-desc`;
		const [isFocused, setIsFocused] = useState(false);
		const [showPassword, setShowPassword] = useState(false);
		const [localValue, setLocalValue] = useState(value || '');
		const _inputRef = useRef<HTMLInputElement>(null);

		// Determine if label should float
		const hasValue = localValue !== '' || value !== '';
		const shouldFloat = isFocused || hasValue;

		// Determine variant based on state
		const effectiveVariant = error ? 'error' : success ? 'success' : variant;

		// Handle password visibility toggle
		const togglePasswordVisibility = (): void => {
			setShowPassword((prev) => !prev);
		};

		// Determine input type
		const inputType =
			showPasswordToggle && type === 'password' && showPassword ? 'text' : type;

		/* ========================================================================
       HANDLERS
       ======================================================================== */

		const handleFocus = (): void => {
			setIsFocused(true);
		};

		const handleBlur = (): void => {
			setIsFocused(false);
		};

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
			setLocalValue(e.target.value);
			props.onChange?.(e);
		};

		/* ========================================================================
       RENDER
       ======================================================================== */

		return (
			<div className={cn('relative', fullWidth ? 'w-full' : 'w-auto')}>
				{/* Label */}
				{label && !floatingLabel && (
					<motion.label
						htmlFor={inputId}
						className="block mb-2 text-sm font-medium text-white/80"
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
					>
						{label}
					</motion.label>
				)}

				{/* Input Container */}
				<div className="relative">
					{/* Left Icon */}
					{leftIcon && (
						<motion.div
							className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10"
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.2 }}
						>
							{leftIcon}
						</motion.div>
					)}

					{/* Floating Label */}
					{label && floatingLabel && (
						<motion.label
							htmlFor={inputId}
							className={cn(
								'absolute left-4 text-white/60 pointer-events-none transition-all duration-200 z-10',
								leftIcon && 'left-11'
							)}
							animate={{
								top: shouldFloat ? '0.25rem' : '50%',
								y: shouldFloat ? 0 : '-50%',
								fontSize: shouldFloat ? '0.75rem' : '1rem',
								color: isFocused
									? error
										? 'rgb(239, 68, 68)'
										: success
											? 'rgb(34, 197, 94)'
											: 'rgb(168, 85, 247)'
									: 'rgba(255, 255, 255, 0.6)',
							}}
							transition={{ duration: 0.2, ease: 'easeOut' as const }}
						>
							{label}
						</motion.label>
					)}

					{/* Input Field */}
					<motion.input
						id={inputId}
						ref={ref as React.RefObject<HTMLInputElement> | undefined}
						type={inputType}
						aria-invalid={Boolean(error) || undefined}
						aria-describedby={error || success || hint ? descId : undefined}
						className={cn(
							inputVariants({ variant: effectiveVariant, size, className }),
							leftIcon && 'pl-11',
							(rightIcon || showPasswordToggle || error || success) && 'pr-11',
							floatingLabel && label && 'pt-6 pb-2'
						)}
						disabled={disabled}
						value={value}
						onFocus={handleFocus}
						onBlur={handleBlur}
						onChange={handleChange}
						whileFocus={{
							scale: 1.01,
							transition: { duration: 0.2 },
						}}
						{...props}
					/>

					{/* Right Icons */}
					<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
						{/* Success Icon */}
						{success && !error && (
							<motion.div
								initial={{ opacity: 0, scale: 0 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.3, type: 'spring' }}
							>
								<CheckCircleIcon className="w-5 h-5 text-green-400" />
							</motion.div>
						)}

						{/* Error Icon */}
						{error && (
							<motion.div
								initial={{ opacity: 0, scale: 0 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.3, type: 'spring' }}
							>
								<ExclamationCircleIcon className="w-5 h-5 text-red-400" />
							</motion.div>
						)}

						{/* Password Toggle */}
						{showPasswordToggle &&
							type === 'password' &&
							!error &&
							!success && (
								<motion.button
									type="button"
									onClick={togglePasswordVisibility}
									className="rounded-md text-white/40 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/45"
									aria-label={
										showPassword ? 'Скрыть пароль' : 'Показать пароль'
									}
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
								>
									{showPassword ? (
										<EyeSlashIcon className="w-5 h-5" />
									) : (
										<EyeIcon className="w-5 h-5" />
									)}
								</motion.button>
							)}

						{/* Custom Right Icon */}
						{rightIcon && !error && !success && !showPasswordToggle && (
							<div className="text-white/40">{rightIcon}</div>
						)}
					</div>

					{/* Focus Ring Animation */}
					<AnimatePresence>
						{isFocused && (
							<motion.div
								className="absolute inset-0 rounded-lg pointer-events-none"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								transition={{ duration: 0.2 }}
								style={{
									boxShadow: error
										? '0 0 0 3px rgba(239, 68, 68, 0.1)'
										: success
											? '0 0 0 3px rgba(34, 197, 94, 0.1)'
											: '0 0 0 3px rgba(168, 85, 247, 0.1)',
								}}
							/>
						)}
					</AnimatePresence>
				</div>

				{/* Helper Text */}
				<AnimatePresence mode="wait">
					{(error || success || hint) && (
						<motion.div
							id={descId}
							className="mt-2 text-xs flex items-start gap-1"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							transition={{ duration: 0.2 }}
							role={error ? 'alert' : undefined}
						>
							{error && (
								<>
									<ExclamationCircleIcon className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
									<span className="text-red-400">{error}</span>
								</>
							)}
							{!error && success && (
								<>
									<CheckCircleIcon className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
									<span className="text-green-400">{success}</span>
								</>
							)}
							{!error && !success && hint && (
								<span className="text-white/50">{hint}</span>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		);
	}
);

InputAdvanced.displayName = 'InputAdvanced';

export default InputAdvanced;
