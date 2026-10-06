export type StudyStatus = 'RECRUITING' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
export type SubjectStatus = 'SCREENING' | 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN';
export type EventSeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
export type EventStatus = 'OPEN' | 'MEDICAL_REVIEW' | 'CONFIRMED' | 'REPORTED' | 'CLOSED';
export type QueryStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type ExportStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ReviewTaskStatus = 'UNASSIGNED' | 'CLAIMED' | 'RESOLVED' | 'ESCALATED';
export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

export interface Study {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  phase: string;
  therapeuticArea: string;
  status: StudyStatus;
  protocolVersion: string;
  dataCutoffAt: string;
  sites: number;
  enrolled: number;
  target: number;
  lastActivity: string;
}

export interface Site {
  id: string;
  studyId: string;
  name: string;
  country: string;
  timezone: string;
  subjects: number;
  dataQuality: number;
  openQueries: number;
}

export interface Subject {
  id: string;
  studyId: string;
  siteId: string;
  subjectNo: string;
  status: SubjectStatus;
  nextVisit: string;
  completion: number;
  queryCount: number;
  consentVersion: string;
  screeningDate: string;
}

export interface AdverseEvent {
  id: string;
  studyId: string;
  subjectId: string;
  term: string;
  severity: EventSeverity;
  status: EventStatus;
  onsetDate: string;
  receivedAt: string;
  causality: string;
  seriousness: boolean;
  source: string;
  sourceRecordId?: string;
  fingerprint?: string;
  version: number;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
}

export interface DataQuery {
  id: string;
  studyId: string;
  subjectId: string;
  domain: string;
  field: string;
  message: string;
  status: QueryStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  dueAt?: string;
  resolvedAt?: string;
}

export interface ExportJob {
  id: string;
  studyId: string;
  type: 'SDTM' | 'SAFETY' | 'RAW';
  status: ExportStatus;
  progress: number;
  createdAt: string;
  records: number;
  requestedBy?: string;
  snapshotId?: string;
  activeAttempt: number;
  failureReason?: string;
}

export interface ExportAttempt {
  id: string;
  exportId: string;
  attempt: number;
  generation: string;
  status: ExportStatus;
  records: number;
  progress: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface EventAudit {
  id: string;
  eventId: string;
  studyId: string;
  action: 'CREATED' | 'STATUS_CHANGED' | 'CORRECTED';
  version: number;
  snapshot: AdverseEvent;
  actor: string;
  createdAt: string;
}

export interface EventTimelineEntry {
  id: string;
  eventId: string;
  version: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OutboxMessage {
  id: string;
  aggregateId: string;
  aggregateType: 'ADVERSE_EVENT' | 'EXPORT_JOB' | 'DATA_BATCH';
  eventType: string;
  version: number;
  dedupeKey: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  createdAt: string;
  publishedAt?: string;
}

export interface DataBatch {
  id: string;
  studyId: string;
  siteId: string;
  source: 'EDC' | 'SAFETY_DB' | 'LAB' | 'IMAGING';
  sourceBatchId: string;
  receivedAt: string;
  effectiveAt: string;
  status: 'RECEIVED' | 'VALIDATING' | 'ACCEPTED' | 'REJECTED' | 'QUARANTINED';
  rowCount: number;
  acceptedRows: number;
  rejectedRows: number;
  checksum: string;
}

export interface QualityFinding {
  id: string;
  studyId: string;
  batchId: string;
  ruleCode: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER';
  subjectId?: string;
  message: string;
  status: 'OPEN' | 'WAIVED' | 'RESOLVED';
  createdAt: string;
}

export interface ReviewTask {
  id: string;
  studyId: string;
  eventId: string;
  queue: 'MEDICAL' | 'SAFETY' | 'DATA_MANAGEMENT';
  status: ReviewTaskStatus;
  priority: number;
  assignedTo?: string;
  dueAt: string;
  createdAt: string;
}

export interface SignalDefinition {
  id: string;
  studyId: string;
  term: string;
  lookbackDays: number;
  threshold: number;
  expectedRate: number;
  enabled: boolean;
}
