/**
 * Map content_audit_log rows (GET /content/manager/activity) to ActivityLog items.
 */
import type { TFunction } from 'i18next';
import type {
	Activity,
	ActivityType,
} from '../../../components/UnifiedContent/hooks/useActivityLog';
import type { ManagerActivityApiRow } from '../../../services/contentApi';

function mapAuditAction(action: string): ActivityType {
	const a = action.toLowerCase();
	if (a === 'created') return 'upload';
	if (a === 'deleted') return 'delete';
	if (a === 'updated' || a === 'file_replaced') return 'edit';
	if (a.includes('share')) return 'share';
	return 'edit';
}

function buildAuditDescription(
	row: ManagerActivityApiRow,
	t: TFunction<'contentManager'>
): string {
	const name = row.content_name?.trim() || t('activityAudit.noName');
	const a = (row.action || '').toLowerCase();
	if (a === 'created') return t('activityAudit.actions.created', { name });
	if (a === 'deleted') return t('activityAudit.actions.deleted', { name });
	if (a === 'updated') return t('activityAudit.actions.updated', { name });
	if (a === 'file_replaced')
		return t('activityAudit.actions.file_replaced', { name });
	if (a.includes('share')) return t('activityAudit.actions.share', { name });
	return t('activityAudit.actions.other', {
		action: row.action || '—',
		name,
	});
}

export function mapManagerActivityRow(
	row: ManagerActivityApiRow,
	t: TFunction<'contentManager'>
): Activity {
	const action = (row.action || '').trim();
	const type = mapAuditAction(action);
	const name = row.content_name?.trim() || '';
	return {
		id: `audit_${row.id}`,
		type,
		contentId: row.content_id ?? undefined,
		contentName: name,
		timestamp: new Date(row.created_at),
		description: buildAuditDescription(row, t),
		undoable: false,
	};
}
