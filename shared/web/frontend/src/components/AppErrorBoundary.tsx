/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Root-level React error boundary with a calmer recovery UI and planned-maintenance awareness.
 *
 * Invariants:
 * - Maintenance/network recovery must not be presented as a user-caused critical failure.
 * - Destructive localStorage reset stays behind an explicit button.
 *
 * Related:
 * - `contexts/MaintenanceContext.tsx`
 * - `services/maintenance/maintenanceState.ts`
 */

import { log } from '@/utils/logger';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getCurrentMaintenanceStatus } from '@/services/maintenance/maintenanceState';
import { EliteRecoveryScreen } from '@/components/ui/EliteRecoveryScreen';
import { EliteTechnicalState } from '@/components/ui/EliteTechnicalState';
import {
	requestMaintenanceRecoveryReload,
	requestManualUserReload,
} from '@/utils/staleBundleReload';

interface AppErrorBoundaryState {
	hasError: boolean;
	errorInfo: ErrorInfo | null;
	eventId: string | null;
	error: Error | null;
}

type AppErrorBoundaryProps = {
	children: ReactNode;
	/** When this changes, clear a previous fatal error without remounting providers. */
	resetKey?: string;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

/**
 * Root-level boundary: full-screen fatal UI, optional reload / clear storage.
 * Prefer ``resetKey`` over remounting via ``key=`` so Maintenance/Preferences
 * providers stay mounted across login→desktop and do not double-fetch.
 */
export class AppErrorBoundary extends Component<
	AppErrorBoundaryProps,
	AppErrorBoundaryState
> {
	constructor(props: AppErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			errorInfo: null,
			eventId: null,
			error: null,
		};
	}

	static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
		return {
			hasError: true,
			errorInfo: null,
			eventId: `error_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			error,
		};
	}

	componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
		if (
			this.state.hasError &&
			prevProps.resetKey !== this.props.resetKey &&
			this.props.resetKey !== undefined
		) {
			this.setState({
				hasError: false,
				errorInfo: null,
				eventId: null,
				error: null,
			});
		}
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		log.error(
			'AppErrorBoundary',
			`Critical error caught by boundary: ${error.message}`
		);
		log.error('AppErrorBoundary', `Error info: ${errorInfo.toString()}`);
		log.error(
			'AppErrorBoundary',
			`Component stack: ${errorInfo.componentStack ?? ''}`
		);
		this.setState({
			errorInfo,
			error,
		});

		this.props.onError?.(error, errorInfo);
	}

	render(): ReactNode {
		if (this.state.hasError) {
			const maintenance = getCurrentMaintenanceStatus();
			const maintenanceWindow = maintenance.window;
			if (maintenance.active && maintenanceWindow) {
				return (
					<EliteRecoveryScreen
						title={maintenanceWindow.title}
						description={maintenanceWindow.message}
						statusLabel="EliteEW · восстановление"
						footnote="Безраздельный мир сохраняет данные и вернётся после восстановления связи."
						actionLabel="Проверить связь"
						onAction={() =>
							requestMaintenanceRecoveryReload(maintenanceWindow.id)
						}
						role="alert"
					/>
				);
			}
			return (
				<EliteTechnicalState
					title="Интерфейсу нужно обновление"
					description="EliteEW не смог корректно продолжить работу текущей страницы. Обычно достаточно перезагрузить вкладку."
					eyebrow="EliteEW · технический экран"
					footnote={
						this.state.eventId ? `ID ошибки: ${this.state.eventId}` : undefined
					}
					tone="rose"
					role="alert"
					ariaLive="assertive"
				>
					<div className="elite-recovery-enter text-center">
						{this.state.error && (
							<div className="mb-6 rounded-2xl border border-white/10 bg-black/28 p-4 text-left">
								<div className="mb-2 font-semibold text-rose-200">Ошибка:</div>
								<div className="break-all font-mono text-sm text-rose-100/86">
									{this.state.error.message}
								</div>
								{this.state.error.stack && (
									<details className="mt-3">
										<summary className="cursor-pointer text-rose-200 hover:text-rose-100">
											Трассировка стека
										</summary>
										<pre className="mt-2 max-h-64 overflow-auto text-xs text-rose-100/72">
											{this.state.error.stack}
										</pre>
									</details>
								)}
								{this.state.errorInfo?.componentStack && (
									<details className="mt-3">
										<summary className="cursor-pointer text-rose-200 hover:text-rose-100">
											Стек компонентов
										</summary>
										<pre className="mt-2 max-h-64 overflow-auto text-xs text-rose-100/72">
											{this.state.errorInfo.componentStack}
										</pre>
									</details>
								)}
							</div>
						)}

						<div className="space-y-3">
							<button
								type="button"
								onClick={() => requestManualUserReload()}
								className="w-full rounded-full border border-lime-200/40 bg-lime-300/16 px-6 py-3 font-medium text-lime-50 transition-colors hover:bg-lime-300/25 focus:outline-hidden focus:ring-2 focus:ring-lime-200/70 focus:ring-offset-2 focus:ring-offset-slate-950"
								aria-label="Перезагрузить приложение"
							>
								Перезагрузить приложение
							</button>
							<button
								type="button"
								onClick={() => {
									localStorage.clear();
									requestManualUserReload();
								}}
								className="w-full rounded-full border border-rose-200/35 bg-rose-300/14 px-6 py-3 font-medium text-rose-50 transition-colors hover:bg-rose-300/22 focus:outline-hidden focus:ring-2 focus:ring-rose-200/60 focus:ring-offset-2 focus:ring-offset-slate-950"
								aria-label="Сбросить и перезагрузить"
							>
								Сбросить и перезагрузить
							</button>
						</div>
					</div>
				</EliteTechnicalState>
			);
		}

		return this.props.children;
	}
}
