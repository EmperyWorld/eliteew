import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMarketingCabinetNavigation } from '../useMarketingCabinetNavigation';

describe('useMarketingCabinetNavigation', () => {
	it('initializes from desktopConsumedDeepLink without reading window', () => {
		const { result } = renderHook(() =>
			useMarketingCabinetNavigation({
				activeView: 'chat',
				selectedCompanyId: 'c1',
				selectedProjectId: 'p1',
				focusedEntityId: 'e1',
				selectedContentId: null,
			})
		);
		expect(result.current.activeView).toBe('chat');
		expect(result.current.selectedCompanyId).toBe('c1');
		expect(result.current.selectedProjectId).toBe('p1');
		expect(result.current.focusedEntityId).toBe('e1');
		expect(result.current.selectedContentId).toBeNull();
		expect(result.current.popStateGeneration).toBe(0);
	});

	it('normalizes unknown view in desktopConsumedDeepLink to overview', () => {
		const { result } = renderHook(() =>
			useMarketingCabinetNavigation({
				activeView: 'not_a_real_view' as 'overview',
				selectedCompanyId: null,
				selectedProjectId: null,
				focusedEntityId: null,
				selectedContentId: null,
			})
		);
		expect(result.current.activeView).toBe('overview');
	});
});
