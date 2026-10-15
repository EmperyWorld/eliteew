/**
 * Image Cropping Utilities
 * Convert crop area to cropped Blob for upload
 */

export interface Area {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Create cropped image blob from image source and crop area
 * @param imageSrc - Image data URL or object URL
 * @param pixelCrop - Crop area in pixels
 * @param rotation - Image rotation in degrees (default: 0)
 * @returns Promise with cropped image Blob
 */
export async function getCroppedImg(
	imageSrc: string,
	pixelCrop: Area,
	rotation = 0
): Promise<Blob> {
	const image = await createImage(imageSrc);
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	const maxSize = Math.max(image.width, image.height);
	const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

	// Set canvas size to safe area
	canvas.width = safeArea;
	canvas.height = safeArea;

	// Translate to center
	ctx.translate(safeArea / 2, safeArea / 2);
	ctx.rotate((rotation * Math.PI) / 180);
	ctx.translate(-safeArea / 2, -safeArea / 2);

	// Draw rotated image
	ctx.drawImage(
		image,
		safeArea / 2 - image.width * 0.5,
		safeArea / 2 - image.height * 0.5
	);

	const data = ctx.getImageData(0, 0, safeArea, safeArea);

	// Set canvas to final crop size
	canvas.width = pixelCrop.width;
	canvas.height = pixelCrop.height;

	// Draw cropped area
	ctx.putImageData(
		data,
		Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
		Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
	);

	// Convert canvas to blob
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('Canvas is empty'));
				}
			},
			'image/jpeg',
			0.95 // High quality
		);
	});
}

/**
 * Create HTMLImageElement from image source
 * @param url - Image data URL or object URL
 * @returns Promise with loaded image
 */
function createImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener('load', () => resolve(image));
		image.addEventListener('error', (error) => reject(error));
		image.src = url;
	});
}

/**
 * Get rotation angle for image orientation
 * @param file - Image file
 * @returns Promise with rotation angle
 */
export async function getRotationFromFile(_file: File): Promise<number> {
	// Read EXIF orientation and return rotation angle
	// This is a simplified version - full EXIF parsing would need exif-js library
	return 0;
}
