/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Opt-in Playwright contour for the live KBSEW full ingestion/search cycle.
 *
 * Invariants:
 * - Skips unless KBSEW_E2E_RUN=1 and live credentials are provided.
 *
 * Related:
 * - documentation/product/KBSEW.md
 */

import { expect, test } from 'playwright/test';

const PDF_FIXTURE = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 95 >>
stream
BT
/F1 18 Tf
72 720 Td
(KBSEW durability e2e sentinel phrase for search verification.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000230 00000 n
0000000375 00000 n
trailer
<< /Root 1 0 R /Size 6 >>
startxref
445
%%EOF
`);

const requiredEnv = [
	'KBSEW_E2E_BASE_URL',
	'KBSEW_E2E_ADMIN_BEARER',
	'KBSEW_E2E_SERVICE_TOKEN',
	'KBSEW_E2E_BARREL_ID',
] as const;

test.describe('KBSEW full cycle', () => {
	test('uploads PDF, waits for job completion, and searches indexed content', async ({
		request,
	}) => {
		test.skip(process.env.KBSEW_E2E_RUN !== '1', 'KBSEW live E2E is opt-in');
		for (const key of requiredEnv) {
			test.skip(!process.env[key], `${key} is required for KBSEW live E2E`);
		}

		const baseUrl = process.env.KBSEW_E2E_BASE_URL?.replace(/\/+$/, '') ?? '';
		const barrelId = process.env.KBSEW_E2E_BARREL_ID ?? '';
		const adminHeaders = {
			authorization: `Bearer ${process.env.KBSEW_E2E_ADMIN_BEARER ?? ''}`,
		};

		const upload = await request.post(
			`${baseUrl}/api/v1/kbsew/barrels/${barrelId}/ingest/upload`,
			{
				headers: adminHeaders,
				multipart: {
					file: {
						name: 'kbsew-e2e-durability.pdf',
						mimeType: 'application/pdf',
						buffer: PDF_FIXTURE,
					},
					driver_type: 'pdf',
				},
			}
		);
		expect(upload.ok()).toBeTruthy();
		const uploadBody = (await upload.json()) as { job_id: string };
		expect(uploadBody.job_id).toBeTruthy();

		let observedJob = false;
		await expect
			.poll(
				async () => {
					const status = await request.get(
						`${baseUrl}/api/v1/kbsew/barrels/${barrelId}/status`,
						{ headers: adminHeaders }
					);
					if (!status.ok()) {
						return `http_${status.status()}`;
					}
					const body = (await status.json()) as {
						active_jobs?: Array<{ id: string; status: string }>;
					};
					const job = body.active_jobs?.find(
						(row) => row.id === uploadBody.job_id
					);
					if (job) {
						observedJob = true;
						return job.status;
					}
					return observedJob ? 'completed_or_not_active' : 'not_seen';
				},
				{ timeout: 180_000, intervals: [2_000, 5_000, 10_000] }
			)
			.toMatch(/completed|completed_or_not_active/);

		const search = await request.post(`${baseUrl}/api/v1/kbsew/search`, {
			headers: {
				'X-KBSEW-Service-Token': process.env.KBSEW_E2E_SERVICE_TOKEN ?? '',
			},
			data: {
				barrel_id: barrelId,
				query: 'KBSEW durability sentinel phrase',
				limit: 5,
			},
		});
		expect(search.ok()).toBeTruthy();
		const searchBody = (await search.json()) as { chunks?: string[] };
		expect((searchBody.chunks ?? []).join('\n')).toContain('durability');
	});
});
