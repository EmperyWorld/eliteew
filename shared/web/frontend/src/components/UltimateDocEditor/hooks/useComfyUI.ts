/**
 * 🔥💎 useComfyUI Hook 💎🔥
 *
 * Custom hook for ComfyUI image generation integration
 *
 * Created: 2025-10-18
 */

import { useCallback } from 'react';
import {
	useEditorStoreApi,
	useEditorStoreShallow,
} from '../store/editorStoreContext';
import { selectComfyUISlice } from '../store/editorStoreSelectors';
import type {
	UseComfyUIReturn,
	ImageGenerationRequest,
	ImageGenerationResponse,
} from '../types/editor.types';

/**
 * Hook for ComfyUI image generation
 *
 * @example
 * ```tsx
 * const { isGenerating, generatedImages, generateImage } = useComfyUI();
 *
 * // Generate image
 * const result = await generateImage({
 *   prompt: 'A beautiful sunset over mountains',
 *   workflow_template: '01_top',
 *   width: 1024,
 *   height: 1024,
 * });
 * ```
 */
export const useComfyUI = (): UseComfyUIReturn => {
	const editorStoreApi = useEditorStoreApi();
	const {
		isGeneratingImage,
		generatedImages,
		error,
		generateImage: storeGenerate,
	} = useEditorStoreShallow(selectComfyUISlice);

	const generateImage = useCallback(
		async (
			request: ImageGenerationRequest
		): Promise<ImageGenerationResponse> => {
			await storeGenerate(request);
			const { generatedImages } = editorStoreApi.getState();
			const latestImage = generatedImages[generatedImages.length - 1];
			if (!latestImage) {
				throw new Error('Failed to generate image');
			}
			return latestImage;
		},
		[storeGenerate, editorStoreApi]
	);

	const clearImages = useCallback(() => {
		editorStoreApi.setState({ generatedImages: [] });
	}, [editorStoreApi]);

	return {
		isGenerating: isGeneratingImage,
		generatedImages,
		error,
		generateImage,
		clearImages,
	};
};
