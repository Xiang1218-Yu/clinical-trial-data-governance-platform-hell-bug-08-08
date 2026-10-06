import type {
  AdverseEvent, DataBatch, DataQuery, EventAudit, EventTimelineEntry, ExportAttempt,
  ExportJob, OutboxMessage, QualityFinding, ReviewTask, SignalDefinition, Site, Study, Subject,
} from './domain.js';

const now = new Date('2026-10-06T08:00:00Z');
const iso = (value: string) => new Date(value).toISOString();

export const studies: Study[] = [
  { id: 'st-101', tenantId: 'tenant-novamed', code: 'ONC-241', title: 'Oral kinase inhibitor in advanced solid tumors', phase: 'Phase II', therapeuticArea: 'Oncology', status: 'ACTIVE', protocolVersion: '4.2', dataCutoffAt: iso('2026-10-05T23:59:59Z'), sites: 18, enrolled: 246, target: 320, lastActivity: now.toISOString() },
  { id: 'st-102', tenantId: 'tenant-novamed', code: 'CNS-118', title: 'Digital endpoint validation in early Alzheimer disease', phase: 'Phase IIb', therapeuticArea: 'Neurology', status: 'RECRUITING', protocolVersion: '2.7', dataCutoffAt: iso('2026-10-05T23:59:59Z'), sites: 11, enrolled: 128, target: 180, lastActivity: now.toISOString() },
  { id: 'st-103', tenantId: 'tenant-helix', code: 'IMM-076', title: 'Long-acting biologic for severe asthma', phase: 'Phase III', therapeuticArea: 'Immunology', status: 'LOCKED', protocolVersion: '6.0', dataCutoffAt: iso('2026-10-01T23:59:59Z'), sites: 26, enrolled: 512, target: 512, lastActivity: now.toISOString() },
];

export const sites: Site[] = [
  { id: 'site-ny', studyId: 'st-101', name: 'Northwell Clinical Center', country: 'United States', timezone: 'America/New_York', subjects: 42, dataQuality: 96, openQueries: 8 },
  { id: 'site-sh', studyId: 'st-101', name: 'Shanghai Precision Medicine', country: 'China', timezone: 'Asia/Shanghai', subjects: 31, dataQuality: 91, openQueries: 13 },
  { id: 'site-ams', studyId: 'st-101', name: 'Amsterdam Research Hospital', country: 'Netherlands', timezone: 'Europe/Amsterdam', subjects: 27, dataQuality: 98, openQueries: 3 },
  { id: 'site-sf', studyId: 'st-102', name: 'Bay Area Memory Clinic', country: 'United States', timezone: 'America/Los_Angeles', subjects: 36, dataQuality: 94, openQueries: 5 },
  { id: 'site-os', studyId: 'st-103', name: 'Oslo Respiratory Institute', country: 'Norway', timezone: 'Europe/Oslo', subjects: 64, dataQuality: 99, openQueries: 1 },
];

export const subjects: Subject[] = [
  { id: 'sub-001', studyId: 'st-101', siteId: 'site-ny', subjectNo: 'NY-0042', status: 'ACTIVE', nextVisit: '2026-10-09', completion: 72, queryCount: 1, consentVersion: '4.2', screeningDate: '2026-01-15' },
  { id: 'sub-002', studyId: 'st-101', siteId: 'site-sh', subjectNo: 'SH-0088', status: 'ACTIVE', nextVisit: '2026-10-12', completion: 48, queryCount: 3, consentVersion: '4.1', screeningDate: '2026-03-02' },
  { id: 'sub-003', studyId: 'st-101', siteId: 'site-ams', subjectNo: 'AM-0021', status: 'COMPLETED', nextVisit: '—', completion: 100, queryCount: 0, consentVersion: '4.2', screeningDate: '2025-08-20' },
  { id: 'sub-004', studyId: 'st-102', siteId: 'site-sf', subjectNo: 'SF-0016', status: 'SCREENING', nextVisit: '2026-10-14', completion: 18, queryCount: 2, consentVersion: '2.7', screeningDate: '2026-09-25' },
  { id: 'sub-005', studyId: 'st-103', siteId: 'site-os', subjectNo: 'OS-0144', status: 'ACTIVE', nextVisit: '2026-10-10', completion: 83, queryCount: 0, consentVersion: '6.0', screeningDate: '2026-02-11' },
];

export const adverseEvents: AdverseEvent[] = [
  { id: 'ae-1001', studyId: 'st-101', subjectId: 'sub-002', term: 'Neutropenia', severity: 'SEVERE', status: 'MEDICAL_REVIEW', onsetDate: '2026-09-28', receivedAt: '2026-09-29T08:20:00Z', causality: 'Possible', seriousness: true, source: 'EDC', sourceRecordId: 'EDC-SH-0088-AE-0001', fingerprint: 'st-101|sub-002|edc-sh-0088-ae-0001', version: 3, lastModifiedAt: iso('2026-10-03T10:00:00Z'), lastModifiedBy: 'system-reconciliation' },
  { id: 'ae-1002', studyId: 'st-101', subjectId: 'sub-001', term: 'Fatigue', severity: 'MODERATE', status: 'OPEN', onsetDate: '2026-10-01', receivedAt: '2026-10-02T10:12:00Z', causality: 'Unlikely', seriousness: false, source: 'EDC', sourceRecordId: 'EDC-NY-0042-AE-0002', fingerprint: 'st-101|sub-001|edc-ny-0042-ae-0002', version: 1, lastModifiedAt: iso('2026-10-02T10:12:00Z'), lastModifiedBy: 'site-ny' },
  { id: 'ae-1003', studyId: 'st-102', subjectId: 'sub-004', term: 'Dizziness', severity: 'MILD', status: 'CONFIRMED', onsetDate: '2026-09-18', receivedAt: '2026-09-19T11:00:00Z', causality: 'Possible', seriousness: false, source: 'EDC', sourceRecordId: 'EDC-SF-0016-AE-0001', fingerprint: 'st-102|sub-004|edc-sf-0016-ae-0001', version: 2, lastModifiedAt: iso('2026-09-21T12:00:00Z'), lastModifiedBy: 'medical-reviewer' },
  { id: 'ae-1004', studyId: 'st-103', subjectId: 'sub-005', term: 'Bronchospasm', severity: 'LIFE_THREATENING', status: 'REPORTED', onsetDate: '2026-09-30', receivedAt: '2026-10-01T15:42:00Z', causality: 'Probable', seriousness: true, source: 'Safety DB', sourceRecordId: 'SAFETY-OS-0144-0001', fingerprint: 'st-103|sub-005|safety-os-0144-0001', version: 4, lastModifiedAt: iso('2026-10-01T16:00:00Z'), lastModifiedBy: 'safety-gateway' },
];

export const queries: DataQuery[] = [
  { id: 'dq-201', studyId: 'st-101', subjectId: 'sub-002', domain: 'LB', field: 'LBORRESU', message: 'Unit is missing for absolute neutrophil count.', status: 'OPEN', priority: 'HIGH', createdAt: '2026-10-02T09:10:00Z', dueAt: '2026-10-08T23:59:59Z' },
  { id: 'dq-202', studyId: 'st-101', subjectId: 'sub-002', domain: 'AE', field: 'AEREL', message: 'Please confirm the relationship to study treatment.', status: 'ANSWERED', priority: 'MEDIUM', createdAt: '2026-09-30T10:40:00Z', dueAt: '2026-10-04T23:59:59Z', resolvedAt: '2026-10-05T09:10:00Z' },
  { id: 'dq-203', studyId: 'st-102', subjectId: 'sub-004', domain: 'VS', field: 'VSORRES', message: 'Value is outside the expected range.', status: 'OPEN', priority: 'MEDIUM', createdAt: '2026-10-01T13:20:00Z', dueAt: '2026-10-10T23:59:59Z' },
  { id: 'dq-204', studyId: 'st-103', subjectId: 'sub-005', domain: 'EX', field: 'EXDOSU', message: 'Dose unit does not match the protocol dictionary.', status: 'CLOSED', priority: 'LOW', createdAt: '2026-09-24T15:00:00Z', dueAt: '2026-09-28T23:59:59Z', resolvedAt: '2026-09-27T15:00:00Z' },
];

export const exports: ExportJob[] = [
  { id: 'exp-301', studyId: 'st-101', type: 'SDTM', status: 'COMPLETED', progress: 100, createdAt: '2026-10-05T08:00:00Z', records: 18420, requestedBy: 'data.manager', snapshotId: 'snap-exp-301', activeAttempt: 1 },
  { id: 'exp-302', studyId: 'st-102', type: 'SAFETY', status: 'RUNNING', progress: 64, createdAt: '2026-10-06T08:32:00Z', records: 7600, requestedBy: 'safety.lead', snapshotId: 'snap-exp-302', activeAttempt: 1 },
];

export const exportAttempts: ExportAttempt[] = [
  { id: 'attempt-exp-301-1', exportId: 'exp-301', attempt: 1, generation: 'gen-exp-301-1', status: 'COMPLETED', records: 18420, progress: 100, startedAt: '2026-10-05T08:00:00Z', finishedAt: '2026-10-05T08:04:12Z' },
  { id: 'attempt-exp-302-1', exportId: 'exp-302', attempt: 1, generation: 'gen-exp-302-1', status: 'RUNNING', records: 7600, progress: 64, startedAt: '2026-10-06T08:32:00Z' },
];

export const dataBatches: DataBatch[] = [
  { id: 'batch-501', studyId: 'st-101', siteId: 'site-sh', source: 'EDC', sourceBatchId: 'EDC-SH-20261005-01', receivedAt: '2026-10-05T16:30:00Z', effectiveAt: '2026-10-05T08:00:00Z', status: 'ACCEPTED', rowCount: 1860, acceptedRows: 1842, rejectedRows: 18, checksum: 'sha256:edc-sh-20261005-01' },
  { id: 'batch-502', studyId: 'st-102', siteId: 'site-sf', source: 'LAB', sourceBatchId: 'LAB-SF-20261006-01', receivedAt: '2026-10-06T07:40:00Z', effectiveAt: '2026-10-06T07:30:00Z', status: 'QUARANTINED', rowCount: 740, acceptedRows: 702, rejectedRows: 38, checksum: 'sha256:lab-sf-20261006-01' },
];

export const qualityFindings: QualityFinding[] = [
  { id: 'finding-1', studyId: 'st-101', batchId: 'batch-501', ruleCode: 'AE-REL-001', severity: 'WARNING', subjectId: 'sub-002', message: 'Causality review is pending for a serious event.', status: 'OPEN', createdAt: '2026-10-05T16:31:00Z' },
  { id: 'finding-2', studyId: 'st-102', batchId: 'batch-502', ruleCode: 'LAB-UNIT-004', severity: 'BLOCKER', subjectId: 'sub-004', message: 'Lab unit is not present in the protocol dictionary.', status: 'OPEN', createdAt: '2026-10-06T07:41:00Z' },
];

export const reviewTasks: ReviewTask[] = [
  { id: 'review-1', studyId: 'st-101', eventId: 'ae-1001', queue: 'MEDICAL', status: 'CLAIMED', priority: 95, assignedTo: 'medical.reviewer', dueAt: '2026-10-07T23:59:59Z', createdAt: '2026-09-29T08:20:00Z' },
  { id: 'review-2', studyId: 'st-103', eventId: 'ae-1004', queue: 'SAFETY', status: 'ESCALATED', priority: 100, assignedTo: 'safety.lead', dueAt: '2026-10-06T23:59:59Z', createdAt: '2026-10-01T15:42:00Z' },
];

export const signalDefinitions: SignalDefinition[] = [
  { id: 'signal-1', studyId: 'st-101', term: 'Neutropenia', lookbackDays: 30, threshold: 1.5, expectedRate: 0.08, enabled: true },
  { id: 'signal-2', studyId: 'st-101', term: 'Fatigue', lookbackDays: 30, threshold: 1.3, expectedRate: 0.12, enabled: true },
  { id: 'signal-3', studyId: 'st-103', term: 'Bronchospasm', lookbackDays: 45, threshold: 1.8, expectedRate: 0.04, enabled: true },
];

export const auditEntries: EventAudit[] = [];
export const eventTimeline: EventTimelineEntry[] = [];
export const outboxMessages: OutboxMessage[] = [];
