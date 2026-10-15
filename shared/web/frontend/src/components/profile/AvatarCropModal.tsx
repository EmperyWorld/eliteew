/**
 * AvatarCropModal Component
 * Modal with react-easy-crop for cropping avatar images.
 * Uses ModalAdvanced for focus trap, Escape to close, and a11y.
 */

import { useState, useCallback, useEffect } from 'react';
import {
	ArrowPathIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';
import Cropper, { type Area } from 'react-easy-crop';
import { getCroppedImg } from '../../utils/imageCrop';
import { log } from '../../utils/logger';
import { ModalAdvanced } from '../ui/ModalAdvanced';

interface AvatarCropModalProps {
	imageFile: File;
	isOpen: boolean;
	onClose: () => void;
	onCropComplete: (croppedBlob: Blob) => void;
}

export default function AvatarCropModal({
	imageFile,
	isOpen,
	onClose,
	onCropComplete,
}: AvatarCropModalProps): JSX.Element | null {
	// Crop state
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [rotation, setRotation] = useState(0);

	// Processing state
	const [isProcessing, setIsProcessing] = useState(false);

	// Image URL for cropper (data URL from FileReader, not a blob URL)
	const [imageSrc, setImageSrc] = useState<string>('');

	// Load image when file changes
	useEffect(() => {
		if (!imageFile) return;
		const reader = new FileReader();
		reader.onload = (): void => {
			if (reader.result && typeof reader.result === 'string') {
				setImageSrc(reader.result);
			}
		};
		reader.readAsDataURL(imageFile);
	}, [imageFile]);

	// Crop complete callback
	const onCropCompleteCallback = useCallback(
		(_croppedArea: Area, croppedAreaPixels: Area): void => {
			setCroppedAreaPixels(croppedAreaPixels);
		},
		[]
	);

	// Apply crop
	const handleApplyCrop = async (): Promise<void> => {
		if (!croppedAreaPixels || !imageSrc) return;
		setIsProcessing(true);
		try {
			const croppedBlob = await getCroppedImg(
				imageSrc,
				croppedAreaPixels,
				rotation
			);
			onCropComplete(croppedBlob);
			onClose();
		} catch (error) {
			log.error(
				'AvatarCropModal',
				'Error cropping image',
				error instanceof Error ? error : undefined,
				error
			);
			// eslint-disable-next-line no-alert
			window.alert('Не удалось обрезать изображение');
		} finally {
			setIsProcessing(false);
		}
	};

	// Cancel crop
	const handleCancel = (): void => {
		if (!isProcessing) onClose();
	};

	if (!isOpen) return null;

	return (
		<ModalAdvanced
			isOpen={isOpen}
			onClose={handleCancel}
			title="Редактировать аватар"
			variant="solid"
			size="xl"
			closeOnOverlay={!isProcessing}
			closeOnEscape={!isProcessing}
			showCloseButton={!isProcessing}
			trapFocus={true}
			footer={
				<div className="flex gap-3 w-full">
					<button
						type="button"
						onClick={handleCancel}
						disabled={isProcessing}
						className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Отмена
					</button>
					<button
						type="button"
						onClick={handleApplyCrop}
						disabled={isProcessing || !croppedAreaPixels}
						className="flex-1 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isProcessing ? (
							<>
								<ArrowPathIcon className="w-5 h-5 animate-spin" />
								Обработка...
							</>
						) : (
							'Применить'
						)}
					</button>
				</div>
			}
		>
			<p className="text-white/60 text-sm mb-4">Выберите область для обрезки</p>

			{/* Cropper Area */}
			<div
				className="relative bg-black rounded-lg overflow-hidden"
				style={{ height: '400px' }}
			>
				{imageSrc && (
					<Cropper
						image={imageSrc}
						crop={crop}
						zoom={zoom}
						rotation={rotation}
						aspect={1}
						cropShape="round"
						showGrid={false}
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onRotationChange={setRotation}
						onCropComplete={onCropCompleteCallback}
						style={{
							containerStyle: {
								backgroundColor: 'rgba(0, 0, 0, 0.8)',
							},
							cropAreaStyle: {
								border: '2px solid rgba(59, 130, 246, 0.5)',
							},
						}}
					/>
				)}
			</div>

			{/* Controls */}
			<div className="mt-6 space-y-4">
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<label
							htmlFor="avatar-crop-zoom"
							className="text-sm font-medium text-white/80 flex items-center gap-2"
						>
							<MagnifyingGlassMinusIcon className="w-4 h-4" />
							Масштаб
						</label>
						<span className="text-sm text-white/60">{zoom.toFixed(1)}x</span>
					</div>
					<div className="flex items-center gap-3">
						<input
							id="avatar-crop-zoom"
							type="range"
							min={1}
							max={3}
							step={0.1}
							value={zoom}
							onChange={(e) => setZoom(parseFloat(e.target.value))}
							className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
							disabled={isProcessing}
							aria-label="Масштаб"
						/>
						<MagnifyingGlassPlusIcon className="w-4 h-4 text-white/40" />
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<label
							htmlFor="avatar-crop-rotation"
							className="text-sm font-medium text-white/80"
						>
							Поворот
						</label>
						<span className="text-sm text-white/60">{rotation}°</span>
					</div>
					<input
						id="avatar-crop-rotation"
						type="range"
						min={0}
						max={360}
						step={1}
						value={rotation}
						onChange={(e) => setRotation(parseInt(e.target.value, 10))}
						className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
						disabled={isProcessing}
						aria-label="Поворот"
					/>
				</div>
			</div>

			<style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid white;
        }
        .slider::-webkit-slider-thumb:hover { background: #2563eb; }
        .slider::-moz-range-thumb:hover { background: #2563eb; }
      `}</style>
		</ModalAdvanced>
	);
}
