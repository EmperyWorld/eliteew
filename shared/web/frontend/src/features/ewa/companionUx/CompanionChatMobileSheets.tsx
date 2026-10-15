/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile embedded companion sheets: operations rail + optional memory sheet (U8.3 slice 18).
 *
 * Invariants:
 * - Memory sheet is omitted when `showMemorySheet` is false (hostile Arlika v1 layout).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionMobileOperationsSheet.tsx
 * - src/features/ewa/companionUx/CompanionMobileMemorySheet.tsx
 */

import {
	CompanionMobileMemorySheet,
	type CompanionMobileMemorySheetProps,
} from '@/features/ewa/companionUx/CompanionMobileMemorySheet';
import {
	CompanionMobileOperationsSheet,
	type CompanionMobileOperationsSheetProps,
} from '@/features/ewa/companionUx/CompanionMobileOperationsSheet';

export type CompanionChatMobileSheetsProps = {
	showMemorySheet: boolean;
	operationsSheetProps: CompanionMobileOperationsSheetProps;
	memorySheetProps: CompanionMobileMemorySheetProps;
};

export function CompanionChatMobileSheets({
	showMemorySheet,
	operationsSheetProps,
	memorySheetProps,
}: CompanionChatMobileSheetsProps) {
	return (
		<>
			<CompanionMobileOperationsSheet {...operationsSheetProps} />
			{showMemorySheet ? (
				<CompanionMobileMemorySheet {...memorySheetProps} />
			) : null}
		</>
	);
}
