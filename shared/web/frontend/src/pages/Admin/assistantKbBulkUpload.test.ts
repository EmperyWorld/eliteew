import { describe, expect, it } from 'vitest';
import { capAssistantKbUploadFiles } from './assistantKbBulkUpload';

function mockFile(name: string): File {
	return new File(['x'], name, { type: 'text/plain' });
}

describe('capAssistantKbUploadFiles', () => {
	it('returns all files when under cap', () => {
		const files = [mockFile('a.txt'), mockFile('b.txt')];
		const { accepted, dropped } = capAssistantKbUploadFiles(files, 10);
		expect(accepted).toEqual(files);
		expect(dropped).toBe(0);
	});

	it('truncates and reports dropped count', () => {
		const files = [mockFile('1'), mockFile('2'), mockFile('3')];
		const { accepted, dropped } = capAssistantKbUploadFiles(files, 2);
		expect(accepted.map((f) => f.name)).toEqual(['1', '2']);
		expect(dropped).toBe(1);
	});

	it('uses minimum cap of 1', () => {
		const files = [mockFile('a'), mockFile('b')];
		const { accepted, dropped } = capAssistantKbUploadFiles(files, 0);
		expect(accepted.length).toBe(1);
		expect(dropped).toBe(1);
	});
});
