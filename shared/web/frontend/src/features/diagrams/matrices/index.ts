/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public exports for Kursorina editorial SWOT / risk matrices.
 */

export {
	splitKursorinaReportParts,
	tryParseRiskTable,
	tryParseSwotTable,
	type ParsedRiskMatrix,
	type ParsedRiskRow,
	type ParsedSwot,
	type ReportPart,
	type SwotQuadrantKey,
} from './parseEditorialMatrices';
export { RiskMatrix } from './RiskMatrix';
export { SwotMatrix } from './SwotMatrix';
