/**
 * При первом маунте оркестратора сбрасываем открытие модалки экскурсии по гайду.
 * Вызывать **после** `useState` для `docGuideOpen`.
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';

export function useDocEditorCloseDocGuideOnMount(
	setDocGuideOpen: Dispatch<SetStateAction<boolean>>
): void {
	useEffect(() => {
		setDocGuideOpen(false);
	}, [setDocGuideOpen]);
}
