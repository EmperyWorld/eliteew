import { describe, expect, it } from 'vitest';
import {
	ewDeskNewsPagedQueryKey,
	ewDeskNewsWidgetPreviewQueryKey,
	EWDESK_WIDGET_PREVIEW_LIMIT_FULL,
} from '../../../services/productDesktopApi';

describe('ewDeskNewsWidgetPreviewQueryKey', () => {
	it('uses a dedicated key separate from paginated feed cache', () => {
		const widgetKey = ewDeskNewsWidgetPreviewQueryKey(
			EWDESK_WIDGET_PREVIEW_LIMIT_FULL
		);
		const feedKey = ewDeskNewsPagedQueryKey({});
		expect(widgetKey).toEqual([
			'product-desktop',
			'news',
			'widget-preview',
			EWDESK_WIDGET_PREVIEW_LIMIT_FULL,
		]);
		expect(widgetKey).not.toEqual(feedKey);
	});
});
