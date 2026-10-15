/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable React error boundary with the shared EliteEW technical-state fallback.
 *
 * Invariants:
 * - Custom fallback props are rendered as-is.
 * - Default fallback stays user-facing and hides stack details outside development.
 *
 * Related:
 * - `components/ui/EliteTechnicalState.tsx`
 */

import * as React from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { EliteTechnicalState } from '@/components/ui/EliteTechnicalState';
import { log } from '../../../utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
	onReset?: () => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * ErrorBoundary - Catch and display React errors
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		this.setState({
			error,
			errorInfo,
		});

		// Call error handler if provided
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}

		// Log to console in development
		if (process.env.NODE_ENV === 'development') {
			log.error('ErrorBoundary', 'caught an error', error, errorInfo);
		}
	}

	handleReset = (): void => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});

		if (this.props.onReset) {
			this.props.onReset();
		}
	};

	render(): ReactNode {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default fallback UI
			return (
				<ErrorFallback
					error={this.state.error}
					errorInfo={this.state.errorInfo}
					onReset={this.handleReset}
				/>
			);
		}

		return this.props.children;
	}
}

// ============================================================================
// DEFAULT FALLBACK UI
// ============================================================================

interface ErrorFallbackProps {
	error: Error | null;
	errorInfo: ErrorInfo | null;
	onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
	error,
	errorInfo,
	onReset,
}) => {
	const isDevelopment = process.env.NODE_ENV === 'development';

	return (
		<EliteTechnicalState
			title="Интерфейсу нужно обновление"
			description="Компонент не смог продолжить работу. Попробуйте повторить действие или обновите страницу."
			eyebrow="EliteEW · технический экран"
			actionLabel="Попробовать снова"
			onAction={onReset}
			tone="rose"
			role="alert"
		>
			{isDevelopment && error && (
				<motion.div
					className="max-h-56 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-left font-mono text-xs text-rose-100/78"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.15 }}
				>
					<strong className="mb-2 block text-rose-100">Error:</strong>
					<pre className="m-0 whitespace-pre-wrap break-words">
						{error.toString()}
					</pre>

					{errorInfo && (
						<>
							<strong className="mb-2 mt-4 block text-rose-100">
								Component Stack:
							</strong>
							<pre className="m-0 whitespace-pre-wrap break-words">
								{errorInfo.componentStack}
							</pre>
						</>
					)}
				</motion.div>
			)}
		</EliteTechnicalState>
	);
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { ErrorBoundaryProps, ErrorBoundaryState };
export default ErrorBoundary;
