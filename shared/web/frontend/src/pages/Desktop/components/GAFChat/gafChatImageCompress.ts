/**
 * Client-side downscale + re-encode for GAF chat uploads (fewer MB over the wire).
 * GIF/SVG and failed decodes are left unchanged.
 */

const MAX_EDGE_PX = 2048;
/** Compress when file is at least this large (bytes). */
const MIN_SIZE_BYTES = 96 * 1024;

const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

function blobFromCanvas(
	canvas: HTMLCanvasElement,
	type: string,
	quality?: number
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob((b) => resolve(b), type, quality);
	});
}

async function encodeCanvasForUpload(
	canvas: HTMLCanvasElement,
	sourceIsPng: boolean
): Promise<{ blob: Blob; ext: string } | null> {
	const webp = await blobFromCanvas(canvas, 'image/webp', WEBP_QUALITY);
	if (webp && webp.type === 'image/webp' && webp.size > 0) {
		return { blob: webp, ext: 'webp' };
	}
	if (sourceIsPng) {
		const png = await blobFromCanvas(canvas, 'image/png');
		if (png && png.type === 'image/png' && png.size > 0) {
			return { blob: png, ext: 'png' };
		}
	}
	const jpeg = await blobFromCanvas(canvas, 'image/jpeg', JPEG_QUALITY);
	if (jpeg && jpeg.type === 'image/jpeg' && jpeg.size > 0) {
		return { blob: jpeg, ext: 'jpg' };
	}
	return null;
}

function baseFileName(name: string): string {
	const i = name.lastIndexOf('.');
	if (i <= 0) return name || 'image';
	return name.slice(0, i);
}

/**
 * Returns a smaller File when resize/re-encode helps; otherwise the original `file`.
 */
export async function maybeCompressImageForGafUpload(
	file: File
): Promise<File> {
	if (!file.type.startsWith('image/')) return file;
	if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

	let bitmap: ImageBitmap | null = null;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file;
	}

	try {
		const w = bitmap.width;
		const h = bitmap.height;
		const maxEdge = Math.max(w, h);
		const scale = maxEdge > MAX_EDGE_PX ? MAX_EDGE_PX / maxEdge : 1;
		const cw = Math.max(1, Math.round(w * scale));
		const ch = Math.max(1, Math.round(h * scale));
		const needsResize = scale < 1;
		const needsCompress = needsResize || file.size >= MIN_SIZE_BYTES;

		if (!needsCompress) {
			bitmap.close();
			return file;
		}

		const canvas = document.createElement('canvas');
		canvas.width = cw;
		canvas.height = ch;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			bitmap.close();
			return file;
		}
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bitmap, 0, 0, cw, ch);
		bitmap.close();
		bitmap = null;

		const sourceIsPng = file.type === 'image/png' || /\.png$/i.test(file.name);
		const encoded = await encodeCanvasForUpload(canvas, sourceIsPng);
		if (!encoded) return file;

		if (encoded.blob.size >= file.size * 0.97) {
			return file;
		}

		const stem = baseFileName(file.name);
		return new File([encoded.blob], `${stem}.${encoded.ext}`, {
			type: encoded.blob.type,
			lastModified: Date.now(),
		});
	} catch {
		bitmap?.close();
		return file;
	}
}
