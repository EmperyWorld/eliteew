import { apiClient } from './client';

export interface UploadResponse {
	url: string;
	filename: string;
	size: number;
	mimeType: string;
}

export async function uploadImage(file: File): Promise<string> {
	const formData = new FormData();
	formData.append('file', file);

	const { data } = await apiClient.post<UploadResponse>(
		'/admin/upload',
		formData,
		{
			headers: {
				'Content-Type': 'multipart/form-data',
			},
		}
	);

	return data.url;
}
