/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5 honest deny for entitlement apps without offline panel.
 */

type Props = { appId: string; onBack: () => void };

export function UnavailableAppPanel({ appId, onBack }: Props) {
	return (
		<section
			className="panel offline-app-panel"
			aria-labelledby="unavail-heading"
		>
			<div className="offline-app-toolbar">
				<button type="button" className="secondary" onClick={onBack}>
					← Каталог
				</button>
			</div>
			<h2 id="unavail-heading">Недоступно офлайн</h2>
			<p className="status status-warn" role="alert">
				«{appId}» есть в вашей лицензии, но на этом устройстве офлайн-панели
				для него нет.
			</p>
			<p className="muted">
				Офлайн сейчас: О приложении, Буфер, Уведомления, Музыка. Остальное —
				через облачный рабочий стол при сети.
			</p>
		</section>
	);
}
