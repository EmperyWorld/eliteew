import { describe, expect, it } from 'vitest';

import {
	COMPANION_DAG_NODE_CATALOG,
	getDagNodeCatalogEntry,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import { ALL_NODE_TYPES } from '@/features/ewa/companionWorkflowDagBuilder/registry/fieldSchemas';

describe('nodeCatalog', () => {
	it('covers every ALL_NODE_TYPES entry', () => {
		const catalogTypes = new Set(
			COMPANION_DAG_NODE_CATALOG.map((entry) => entry.type)
		);
		for (const type of ALL_NODE_TYPES) {
			expect(catalogTypes.has(type)).toBe(true);
			expect(getDagNodeCatalogEntry(type)?.labelRu.length).toBeGreaterThan(0);
		}
	});

	it('includes document and transform node types', () => {
		expect(getDagNodeCatalogEntry('pdf_parser')?.labelRu).toBe('Разбор PDF');
		expect(getDagNodeCatalogEntry('document_extractor')?.labelRu).toBe(
			'Извлечение текста'
		);
		expect(getDagNodeCatalogEntry('data_transformer')?.labelRu).toBe(
			'Преобразование данных'
		);
	});
});
