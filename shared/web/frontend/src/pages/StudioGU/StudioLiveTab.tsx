/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Вкладка Live Voice в Студии ГУ: статус DesktopVoiceContext и открытие/включение
 * глобальной dock-панели Live Voice (без блокировки CTA при voice-command).
 *
 * Invariants:
 * - «Открыть панель» всегда доступна; «Включить» переключает режим (взаимное исключение).
 * - Включение Live Voice снимает activeMode voice-command на виджете рабочего стола.
 *
 * Related:
 * - DesktopVoiceContext.tsx, LiveVoiceDesktopPipeline.tsx, VOICE-CONTROL-STUDIO.md
 */

import * as React from 'react';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { useDesktopVoice } from '@/pages/Desktop/context/DesktopVoiceContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';
import {
	ChatBubbleLeftRightIcon,
	PowerIcon,
	RadioIcon,
} from '@heroicons/react/24/outline';

const sw = DESKTOP_LUCIDE.stroke;

export function StudioLiveTab(): React.ReactElement {
	const dv = useDesktopVoice();
	const shellFrame = useDesktopShellFrame();
	const panelClass = React.useMemo(
		() =>
			cn(
				'flex flex-col gap-3 p-4',
				getDesktopShellContentPanelClassName(shellFrame)
			),
		[shellFrame]
	);
	const actionsClusterClass = React.useMemo(
		() =>
			cn(
				'flex flex-wrap gap-2 p-1.5 rounded-(--desktop-radius-lg)',
				getDesktopShellToolbarClusterClassName(shellFrame)
			),
		[shellFrame]
	);
	const liveOn = dv.activeMode === 'live-voice';
	const cmdOn = dv.activeMode === 'voice-command';
	const panelOpen = dv.showLiveVoicePanel;

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
			<div className={panelClass} data-studio-gu-guide="live-state-panel">
				<div className="flex items-center gap-2">
					<RadioIcon
						className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						strokeWidth={sw}
						aria-hidden
					/>
					<span className={DESKTOP_TYPOGRAPHY.subtitle}>Состояние</span>
				</div>
				<dl className="grid gap-2 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-(--desktop-text-muted)">
							Режим рабочего стола
						</dt>
						<dd className="text-(--desktop-text-primary)">
							{liveOn ? 'Live Voice' : cmdOn ? 'Голосовые команды' : 'Нет'}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-(--desktop-text-muted)">Панель</dt>
						<dd className="text-(--desktop-text-primary)">
							{panelOpen ? 'открыта' : 'закрыта'}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-(--desktop-text-muted)">Сервис (сокет)</dt>
						<dd className="text-(--desktop-text-primary)">
							{dv.liveVoice.serviceAvailable
								? 'доступен'
								: 'ожидание / fallback'}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-(--desktop-text-muted)">Последний результат</dt>
						<dd className="text-(--desktop-text-primary)">
							{dv.liveVoice.lastSuccess === 'success'
								? 'успех'
								: dv.liveVoice.lastSuccess === 'error'
									? 'ошибка'
									: '—'}
						</dd>
					</div>
				</dl>
			</div>

			<div className={actionsClusterClass} data-studio-gu-guide="live-actions">
				<DesktopAppButton
					type="button"
					variant={liveOn ? 'neutral' : 'accent'}
					size="sm"
					onClick={() => {
						dv.enableLiveVoice();
					}}
					className="gap-2"
					aria-pressed={liveOn}
				>
					<PowerIcon className="h-4 w-4" strokeWidth={sw} />
					{liveOn ? 'Live Voice включён' : 'Включить Live Voice'}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={() => {
						dv.openLiveVoicePanel();
					}}
					className="gap-2"
					aria-expanded={panelOpen}
				>
					<ChatBubbleLeftRightIcon className="h-4 w-4" strokeWidth={sw} />
					{panelOpen ? 'Панель открыта' : 'Открыть панель Live Voice'}
				</DesktopAppButton>
			</div>

			{cmdOn ? (
				<p className={DESKTOP_APP_STYLE_CONTRACT.helperText}>
					Сейчас активны голосовые команды. «Включить Live Voice» отключит их на
					виджете рабочего стола — одновременно доступен только один режим.
				</p>
			) : null}
		</div>
	);
}
