/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy-loaded component boundary with branded EliteEW error fallback when chunks fail after deploy.
 *
 * Invariants:
 * - Fallback uses `EliteTechnicalState` (actionable error tier), not legacy emerald card.
 *
 * Related:
 * - `utils/staleBundleReload.ts`
 */

import * as React from 'react';
import { type ComponentType, lazy } from 'react';
import { EliteTechnicalState } from '@/components/ui/EliteTechnicalState';
import { log } from './logger';

interface FallbackComponentProps {
	componentName: string;
	onRetry?: () => void;
}

const ErrorFallback: React.FC<FallbackComponentProps> = ({
	componentName,
	onRetry,
}) => (
	<EliteTechnicalState
		title="Модуль не загрузился"
		description={`${componentName || 'Компонент'} недоступен. Обычно это происходит после обновления версии.`}
		eyebrow="EliteEW · загрузка модуля"
		tone="rose"
		role="alert"
		quote={null}
		actionLabel="Перезагрузить страницу"
		onAction={() => window.location.reload()}
	>
		{onRetry ? (
			<button
				type="button"
				onClick={onRetry}
				className="w-full rounded-full border border-white/12 bg-white/8 px-6 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/12"
			>
				Повторить попытку
			</button>
		) : null}
	</EliteTechnicalState>
);

/**
 * Create a lazy-loaded component with error handling
 *
 * @param importFn - Function that returns a promise importing the component
 * @param componentName - Name of the component for error messages
 * @returns Lazy-loaded component with error fallback
 *
 * Lazy import boundary: T keeps the real component type; `any` is only on the props constraint.
 */
// biome-ignore lint/suspicious/noExplicitAny: dynamic imports may export components with arbitrary props
export function lazyWithErrorHandling<T extends ComponentType<any>>(
	importFn: () => Promise<{ default: T }>,
	componentName: string
): React.LazyExoticComponent<T> {
	return lazy(async () => {
		try {
			const module = await importFn();

			if (!module) {
				log.error('LazyLoad', `Module ${componentName} returned undefined`);
				throw new Error(`Module ${componentName} returned undefined`);
			}

			if (!module.default) {
				const moduleKeys = Object.keys(module).join(', ');
				log.error(
					'LazyLoad',
					`Module ${componentName} does not have a default export. Module keys: ${moduleKeys}`
				);
				throw new Error(
					`Module ${componentName} does not have a default export`
				);
			}

			const isFunction = typeof module.default === 'function';
			const isReactComponent =
				isFunction ||
				(typeof module.default === 'object' &&
					module.default !== null &&
					'$$typeof' in module.default);

			if (!isFunction && !isReactComponent) {
				const exportType = typeof module.default;
				log.error(
					'LazyLoad',
					`Module ${componentName} default export is not a function or React component. Type: ${exportType}`
				);
				throw new Error(
					`Module ${componentName} default export is not a function (got ${exportType})`
				);
			}

			if (module.default === undefined || module.default === null) {
				log.error(
					'LazyLoad',
					`Module ${componentName} default export is null/undefined`
				);
				throw new Error(
					`Module ${componentName} default export is null or undefined`
				);
			}

			log.info('LazyLoad', `Successfully loaded ${componentName}`);
			return module;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			log.error('LazyLoad', `Failed to load ${componentName}: ${errorMessage}`);

			const FallbackComponent = React.memo(() => (
				<ErrorFallback componentName={componentName} />
			)) as unknown as T;

			if (!FallbackComponent || typeof FallbackComponent !== 'function') {
				log.error(
					'LazyLoad',
					`Fallback component for ${componentName} is invalid`
				);
				const SimpleFallback = (): React.ReactElement => (
					<div>Failed to load {componentName}</div>
				);
				return { default: SimpleFallback as unknown as T };
			}

			return {
				default: FallbackComponent,
			};
		}
	});
}
