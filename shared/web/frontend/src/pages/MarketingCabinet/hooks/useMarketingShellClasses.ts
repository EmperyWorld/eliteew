import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { useMemo } from 'react';
import {
	getDesktopShellCheckboxControlClassName,
	getDesktopShellContentPanelClassName,
	getDesktopShellPanelClassName,
	getDesktopShellProgressTrackClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

/**
 * Токены пресета «Стиль окон» для маркетингового кабинета — без дублирования пропсов с рабочего стола.
 */
export function useMarketingShellClasses() {
	const shellFrame = useDesktopShellFrame();
	return useMemo(
		() => ({
			shellFrame,
			contentPanel: getDesktopShellContentPanelClassName(shellFrame),
			toolbarCluster: getDesktopShellToolbarClusterClassName(shellFrame),
			/** Поля внутри glass-карточек MC — inset без второй «карточки» + focus ring. */
			formSelect: cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
			/** Чипы / строки внутри glass-карточек ИМК (без «плоского» surface-panel-strong). */
			toolbarInset:
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
			/** Поповер «Маркетинговые AI-задачи» — тот же каркас, что у выпадающих списков. */
			jobCenterPopover: getDesktopShellPanelClassName(shellFrame, 'standard'),
			checkboxControl: cn(
				'mt-0.5 h-4 w-4 shrink-0 rounded',
				getDesktopShellCheckboxControlClassName(shellFrame)
			),
			/** Дорожка горизонтального прогресса (покрытие, целостность) внутри панелей MC. */
			progressTrack: cn(
				'h-2 w-full overflow-hidden rounded-full',
				getDesktopShellProgressTrackClassName(shellFrame)
			),
			/** Вложенные блоки внутри glass (поля, карточки строк) — inset + скругление. */
			nestedInset: cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'rounded-(--desktop-radius)'
			),
			/** Квадрат под иконку 9×9 внутри карточки. */
			insetIconTile: cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'flex h-9 w-9 shrink-0 items-center justify-center rounded-(--desktop-radius)'
			),
		}),
		[shellFrame]
	);
}
