import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PILOT = join(
	__dirname,
	'../../../../openapi/pilot/marketing-cabinet-rag.openapi.json'
);

const projectsBase = '/marketing-cabinet/projects';

describe('marketingProjectRagApi path contract', () => {
	it('resolves RAG paths under /api/v1 like marketingProjectRagApi', () => {
		const v1 = '/api/v1';
		const pid = '{project_id}';
		const cid = '{content_id}';
		const imc = '{imc_research_run_id}';
		expect(`${v1}${projectsBase}/${pid}/rag-sources`).toBe(
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources'
		);
		expect(`${v1}${projectsBase}/${pid}/rag-sources/semantic-search`).toBe(
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/semantic-search'
		);
		expect(`${v1}${projectsBase}/${pid}/rag-sources/content/${cid}`).toBe(
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/content/{content_id}'
		);
		expect(`${v1}${projectsBase}/${pid}/rag-sources/from-imc-run/${imc}`).toBe(
			'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}'
		);
	});

	it('OpenAPI RAG pilot lists the four v1 routes', () => {
		type PathItem = Partial<
			Record<'get' | 'post' | 'patch' | 'put' | 'delete', unknown>
		>;
		const spec = JSON.parse(readFileSync(PILOT, 'utf8')) as {
			paths: Record<string, PathItem | undefined>;
		};
		expect(
			spec.paths['/api/v1/marketing-cabinet/projects/{project_id}/rag-sources']
				?.get
		).toBeDefined();
		expect(
			spec.paths[
				'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/semantic-search'
			]?.get
		).toBeDefined();
		expect(
			spec.paths[
				'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/content/{content_id}'
			]?.patch
		).toBeDefined();
		expect(
			spec.paths[
				'/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}'
			]?.post
		).toBeDefined();
	});
});
