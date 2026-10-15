/** Два `aria-live` региона для объявлений пресета и макета (тик принудительно обновляет политeness). */
export function MarketingDashboardLiveRegions({
	presetAnnouncement,
	presetAnnouncementTick,
	layoutAnnouncement,
	layoutAnnouncementTick,
}: {
	presetAnnouncement: string;
	presetAnnouncementTick: number;
	layoutAnnouncement: string;
	layoutAnnouncementTick: number;
}) {
	return (
		<>
			<span className="sr-only" aria-live="polite">
				{presetAnnouncement}
				<span aria-hidden>
					{'\u2060'}
					{presetAnnouncementTick}
				</span>
			</span>
			<span className="sr-only" aria-live="polite">
				{layoutAnnouncement}
				<span aria-hidden>
					{'\u2060'}
					{layoutAnnouncementTick}
				</span>
			</span>
		</>
	);
}
