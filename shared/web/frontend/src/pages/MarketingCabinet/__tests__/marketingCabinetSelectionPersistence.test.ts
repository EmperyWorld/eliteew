/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Marketing Cabinet company/project localStorage persistence.
 *
 * Invariants:
 * - Explicit selection in state is not overwritten by stored ids.
 *
 * Related:
 * - marketingCabinetPageHelpers.ts
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
	MARKETING_CABINET_SELECTED_COMPANY_STORAGE_KEY,
	MARKETING_CABINET_SELECTED_PROJECT_STORAGE_KEY,
	mergeMarketingCabinetStateWithPersistedSelection,
	readMarketingCabinetPersistedSelection,
	writeMarketingCabinetPersistedSelection,
} from '../marketingCabinetPageHelpers';

describe('marketingCabinetSelectionPersistence', () => {
	afterEach(() => {
		window.localStorage.removeItem(
			MARKETING_CABINET_SELECTED_COMPANY_STORAGE_KEY
		);
		window.localStorage.removeItem(
			MARKETING_CABINET_SELECTED_PROJECT_STORAGE_KEY
		);
	});

	it('reads and writes company/project ids', () => {
		writeMarketingCabinetPersistedSelection('company-a', 'project-b');
		expect(readMarketingCabinetPersistedSelection()).toEqual({
			selectedCompanyId: 'company-a',
			selectedProjectId: 'project-b',
		});
	});

	it('merge keeps explicit state and fills only null slots from storage', () => {
		writeMarketingCabinetPersistedSelection('stored-co', 'stored-pr');
		expect(
			mergeMarketingCabinetStateWithPersistedSelection({
				activeView: 'overview',
				selectedCompanyId: 'url-co',
				selectedProjectId: null,
				focusedEntityId: null,
				selectedContentId: null,
			})
		).toEqual({
			activeView: 'overview',
			selectedCompanyId: 'url-co',
			selectedProjectId: 'stored-pr',
			focusedEntityId: null,
			selectedContentId: null,
		});
	});

	it('clears storage keys when selection is null', () => {
		writeMarketingCabinetPersistedSelection('c1', 'p1');
		writeMarketingCabinetPersistedSelection(null, null);
		expect(readMarketingCabinetPersistedSelection()).toEqual({
			selectedCompanyId: null,
			selectedProjectId: null,
		});
	});
});
