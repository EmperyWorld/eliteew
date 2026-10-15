/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Activation drop body — import sealed access file (or ops seat pack).
 * Hero chrome lives on ActivationScreen only (no second welcome/modes).
 *
 * Invariants:
 * - Cold offline path never requires tunnel when seat/entitlement pack is present.
 * - Retail sealed: capsule only; no open seat JSON / path redeem editors.
 *
 * Related:
 * - features/activation/ActivationScreen.tsx
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 B Activation
 */

import { useState } from 'react';
import {
	looksLikeEntitlementJson,
	readDroppedAccessFile,
} from '../../lib/ui/fileDrop';
import { looksLikeSeatPackageJson } from '../../lib/launcher/seatPackage';
import {
	looksLikeCapsuleJson,
	looksLikeCapsuleV3,
} from '../../lib/launcher/capsuleImport';
import { isRetailSealedUi } from '../../lib/launcher/retailSealed';
import './home.css';

type HomeScreenProps = {
	entitlementMessage: string;
	importPath: string;
	onImportPathChange: (value: string) => void;
	importBusy: boolean;
	onImport: () => void;
	onImportJsonText: (raw: string) => void;
	onImportSeatJsonText: (raw: string) => void;
	onPickAccessFile?: () => void;
	onOnlineEnroll?: () => void;
	onPrepareDeviceRequest?: () => void;
	deviceRequestHint?: string | null;
};

export function HomeScreen({
	entitlementMessage,
	importPath,
	onImportPathChange,
	importBusy,
	onImport,
	onImportJsonText,
	onImportSeatJsonText,
	onPickAccessFile,
	onOnlineEnroll,
	onPrepareDeviceRequest,
	deviceRequestHint,
}: HomeScreenProps) {
	const sealed = isRetailSealedUi();
	const filePickerAccept = sealed ? '.ecap' : '.json,application/json';
	const [dropHint, setDropHint] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);

	async function handleDrop(files: FileList | null) {
		setDragOver(false);
		const file = files?.[0] ?? null;
		const read = await readDroppedAccessFile(file);
		if (!read.ok) {
			setDropHint(read.error);
			return;
		}
		if (looksLikeCapsuleV3(read.text) || looksLikeCapsuleJson(read.text)) {
			setDropHint(
				sealed
					? `Импорт файла доступа «${read.name}»…`
					: `Импорт пакета места «${read.name}»…`
			);
			onImportSeatJsonText(read.text);
			return;
		}
		if (looksLikeSeatPackageJson(read.text)) {
			if (sealed) {
				setDropHint(
					'Нужен файл доступа от администратора. Открытый пакет места в обычном режиме не принимается.'
				);
				return;
			}
			setDropHint(`Импорт пакета места «${read.name}»…`);
			onImportSeatJsonText(read.text);
			return;
		}
		if (looksLikeEntitlementJson(read.text)) {
			if (sealed) {
				setDropHint(`«${read.name}» не похож на файл доступа EliteEW`);
				return;
			}
			setDropHint(`Импорт из «${read.name}»…`);
			onImportJsonText(read.text);
			return;
		}
		setDropHint(
			sealed
				? `«${read.name}» не похож на файл доступа EliteEW`
				: `«${read.name}» не похож на пакет места EliteEW (нужен JSON от оператора)`
		);
	}

	return (
		<section className="panel home-panel home-panel-activation" aria-label="Импорт файла доступа">
			<div className="home-main">
				{entitlementMessage.trim() ? (
					<p className="status status-banner" role="status">
						{entitlementMessage}
					</p>
				) : null}

				<div
					className={`drop-zone drop-zone-primary${dragOver ? ' is-dragover' : ''}`}
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={(e) => {
						e.preventDefault();
						void handleDrop(e.dataTransfer.files);
					}}
				>
					{!sealed ? (
						<input
							type="file"
							accept={filePickerAccept}
							className="sr-only"
							disabled={importBusy}
							onChange={(e) => {
								void handleDrop(e.target.files);
								e.target.value = '';
							}}
						/>
					) : null}
					<p>
						<strong>
							{sealed
								? 'Импортировать файл доступа'
								: 'Импортировать пакет места'}
						</strong>
					</p>
					<p className="muted">
						{sealed ? (
							<>
								Файл <code>eliteew-*.ecap</code> от администратора — перетащите
								сюда
								{onPickAccessFile ? ' или выберите на диске.' : '.'}
							</>
						) : (
							<>
								Файл <code>eliteew-seat-*.json</code> — перетащите сюда или
								выберите на диске.
							</>
						)}
					</p>
					{sealed && onPickAccessFile ? (
						<div className="actions">
							<button
								type="button"
								className="secondary"
								disabled={importBusy}
								onClick={() => void onPickAccessFile()}
							>
								{importBusy ? 'Импорт…' : 'Выбрать файл .ecap'}
							</button>
						</div>
					) : null}
					{dropHint ? (
						<p className="muted" role="status">
							{dropHint}
						</p>
					) : null}
				</div>

				{onPrepareDeviceRequest ? (
					<div className="home-prepare-request">
						<button
							type="button"
							className="secondary home-prepare-btn"
							onClick={onPrepareDeviceRequest}
							disabled={importBusy}
						>
							Подготовить запрос устройства
						</button>
						{deviceRequestHint ? (
							<p className="home-hint" role="status">
								{deviceRequestHint}
							</p>
						) : (
							<p className="home-hint">
								Если файла ещё нет — создайте запрос, передайте администратору и
								вернитесь с готовым пакетом доступа.
							</p>
						)}
					</div>
				) : null}
			</div>

			{!sealed ? (
				<details className="details-fold home-advanced">
					<summary>Дополнительно</summary>
					<div className="journey-choice">
						<button
							type="button"
							className="choice-card"
							onClick={onOnlineEnroll}
							disabled={importBusy || !onOnlineEnroll}
						>
							<strong>Подключить по сети вручную</strong>
							<span>
								Если пакета файла нет: вставить конфиг канала и ключ лицензии
								отдельно (для опытных).
							</span>
						</button>
					</div>
					<label className="field">
						<span>Путь к старому файлу доступа (редко)</span>
						<input
							type="text"
							value={importPath}
							onChange={(e) => onImportPathChange(e.target.value)}
							placeholder="/media/usb/eliteew-entitlement.json"
							disabled={importBusy}
						/>
					</label>
					<div className="actions">
						<button
							type="button"
							className="secondary"
							onClick={onImport}
							disabled={importBusy || !importPath.trim()}
						>
							{importBusy ? 'Импорт…' : 'Импортировать по пути'}
						</button>
					</div>
				</details>
			) : null}
		</section>
	);
}
