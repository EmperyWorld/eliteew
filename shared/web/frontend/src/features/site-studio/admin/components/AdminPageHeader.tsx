import React from 'react';

export interface AdminPageHeaderProps {
	eyebrow?: string;
	eyebrowPulse?: boolean;
	title: string;
	titleIcon?: React.ReactNode;
	description?: React.ReactNode;
	meta?: React.ReactNode;
	actions?: React.ReactNode;
	titleExtra?: React.ReactNode;
	className?: string;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
	eyebrow,
	eyebrowPulse = true,
	title,
	titleIcon,
	description,
	meta,
	actions,
	titleExtra,
	className = '',
}) => {
	return (
		<div
			className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
		>
			<div className="space-y-2 min-w-0 flex-1">
				{eyebrow ? (
					<div className="inline-flex items-center gap-2 rounded-full border border-primary-100/70 dark:border-primary-900/40 bg-primary-50/60 dark:bg-primary-950/40 px-3 py-1 text-[11px] font-medium text-primary-700 dark:text-primary-300">
						{eyebrowPulse ? (
							<span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
						) : null}
						<span className="uppercase tracking-[0.18em]">{eyebrow}</span>
					</div>
				) : null}
				<div>
					<h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-white flex flex-wrap items-center gap-3">
						{titleIcon ? (
							<div className="p-2 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-xl shadow-sm shadow-primary-500/20 shrink-0">
								{titleIcon}
							</div>
						) : null}
						<span className="min-w-0">{title}</span>
						{titleExtra}
					</h1>
					{description ? (
						<p className="text-neutral-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
							{description}
						</p>
					) : null}
					{meta ? (
						<div className="mt-2 flex flex-wrap gap-2">{meta}</div>
					) : null}
				</div>
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center gap-2 shrink-0 justify-end sm:justify-start">
					{actions}
				</div>
			) : null}
		</div>
	);
};
