import type { Content } from '@/components/UnifiedContent/types';
import type { PickerItem } from './useUnifiedContentPickerController';

export function stripPickerItemMeta(items: readonly PickerItem[]): Content[] {
	return items.map(({ _pickerContentType: _, ...rest }) => rest);
}
