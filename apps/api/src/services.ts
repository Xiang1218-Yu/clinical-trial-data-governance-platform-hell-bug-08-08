import { createHash, randomUUID } from 'node:crypto';
import {
  adverseEvents, auditEntries, dataBatches, eventTimeline, exportAttempts, exports, outboxMessages,
  qualityFindings, queries, reviewTasks, signalDefinitions, sites, studies, subjects,
} from './store.js';
import type {
  AdverseEvent, DataBatch, EventAudit, EventSeverity, EventStatus, ExportAttempt, ExportJob,
  OutboxMessage, QualityFinding, ReviewTask, SignalDefinition,
} from './domain.js';

const statusTransitions: Record<EventStatus, EventStatus[]> = {
  OPEN: ['MEDICAL_REVIEW', 'CLOSED'],
  MEDICAL_REVIEW: ['OPEN', 'CONFIRMED', 'CLOSED'],
  CONFIRMED: ['REPORTED', 'CLOSED'],
  REPORTED: ['CLOSED'],
  CLOSED: [],
};

export class DomainConflictError extends Error {
  statusCode = 409;
  constructor(message: string, public details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainConflictError';
  }
}

function now() { return new Date().toISOString(); }
function clone<T>(value: T): T { return structuredClone(value); }
function normalize(value: string) { return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' '); }
function studyFor(studyId: string) {
  const study = studies.find((item) => item.id === studyId);
  if (!study) throw new DomainConflictError('study not found', { studyId });
  return study;
}
function eventFor(eventId: string) {
  const event = adverseEvents.find((item) => item.id === eventId);
  if (!event) throw new DomainConflictError('event not found', { eventId });
  return event;
}
function eventFingerprint(input: { studyId: string; subjectId: string; source?: string; sourceRecordId?: string; term: string; onsetDate?: string }) {
  const identity = input.sourceRecordId
    ? [input.studyId, input.subjectId, normalize(input.source ?? 'unknown'), normalize(input.sourceRecordId)].join('|')
    : [input.studyId, input.subjectId, normalize(input.term), input.onsetDate ?? 'unknown'].join('|');
  return createHash('sha256').update(identity).digest('hex');
}
function appendAudit(event: AdverseEvent, action: EventAudit['action'], actor: string) {
  auditEntries.unshift({ id: `audit-${randomUUID().slice(0, 10)}`, eventId: event.id, studyId: event.studyId, action, version: event.version, snapshot: clone(event), actor, createdAt: now() });
}
function appendTimeline(event: AdverseEvent, type: string, payload: Record<string, unknown>) {
  eventTimeline.unshift({ id: `timeline-${randomUUID().slice(0, 10)}`, eventId: event.id, version: event.version, type, payload: clone(payload), createdAt: now() });
}
function appendOutbox(aggregateId: string, aggregateType: OutboxMessage['aggregateType'], eventType: string, version: number, payload: Record<string, unknown>) {
  const dedupeKey = `${aggregateType}:${aggregateId}`;
  const existing = outboxMessages.find((message) => message.dedupeKey === dedupeKey);
  if (existing) {
    if (existing.version <= version) {
      existing.payload = clone(payload);
      existing.eventType = eventType;
      existing.version = version;
      existing.createdAt = now();
    }
    return existing;
  }
  const message: OutboxMessage = {
    id: `outbox-${randomUUID().slice(0, 10)}`,
    aggregateId,
    aggregateType,
    eventType,
    version,
    dedupeKey,
    payload: clone(payload),
    status: 'PENDING',
    createdAt: now(),
  };
  outboxMessages.push(message);
  outboxMessages.sort((left, right) => {
    if (left.aggregateId !== right.aggregateId) return left.aggregateId.localeCompare(right.aggregateId);
    return left.version - right.version;
  });
  return message;
}

function scope<T extends { studyId: string }>(items: T[], studyId?: string) { return items.filter((item) => !studyId || item.studyId === studyId); }
function expectedRecords(studyId: string, type: ExportJob['type']) {
  const studySubjects = subjects.filter((item) => item.studyId === studyId).length;
  const studyEvents = adverseEvents.filter((item) => item.studyId === studyId).length;
  const studyQueries = queries.filter((item) => item.studyId === studyId).length;
  const weights = { SDTM: 18, SAFETY: 11, RAW: 31 };
  return Math.max(1, studySubjects * weights[type] + studyEvents * 7 + studyQueries * 3 + Math.ceil(studyFor(studyId).enrolled / 10));
}
function signalFor(studyId: string, definition: SignalDefinition, asOf = new Date()) {
  const end = asOf.getTime();
  const start = end - definition.lookbackDays * 24 * 60 * 60 * 1000;
  const events = adverseEvents.filter((event) => event.studyId === studyId && event.term === definition.term && Number.isFinite(Date.parse(event.onsetDate)) && Date.parse(event.onsetDate) >= start && Date.parse(event.onsetDate) <= end);
  const study = studyFor(studyId);
  const observed = events.length;
  const expected = Math.max(0.1, study.enrolled * definition.expectedRate * definition.lookbackDays / 365);
  const score = Number((observed / expected).toFixed(2));
  return { term: definition.term, windowDays: definition.lookbackDays, observed, expected: Number(expected.toFixed(2)), score, level: score >= definition.threshold * 1.5 ? 'ESCALATED' : score >= definition.threshold ? 'WATCH' : 'NORMAL' };
}

export function dashboard(studyId?: string) {
  const scopedStudies = studyId ? studies.filter((item) => item.id === studyId) : studies;
  const scopedSubjects = scope(subjects, studyId);
  const scopedEvents = scope(adverseEvents, studyId);
  const scopedQueries = scope(queries, studyId);
  const scopedFindings = scope(qualityFindings, studyId);
  const completed = scopedSubjects.filter((item) => item.status === 'COMPLETED').length;
  const scopedDefinitions = signalDefinitions.filter((item) => item.enabled && (!studyId || item.studyId === studyId));
  return {
    studies: scopedStudies,
    metrics: {
      activeStudies: scopedStudies.filter((item) => item.status === 'ACTIVE' || item.status === 'RECRUITING').length,
      enrolledSubjects: scopedStudies.reduce((sum, item) => sum + item.enrolled, 0),
      dataQuality: Math.round(scopedSubjects.reduce((sum, item) => sum + item.completion, 0) / Math.max(scopedSubjects.length, 1)),
      openQueries: scopedQueries.filter((item) => item.status === 'OPEN').length,
      blockerFindings: scopedFindings.filter((item) => item.severity === 'BLOCKER' && item.status === 'OPEN').length,
      seriousEvents: scopedEvents.filter((item) => item.seriousness).length,
      completionRate: Math.round((completed / Math.max(scopedSubjects.length, 1)) * 100),
      overdueQueries: scopedQueries.filter((item) => item.status === 'OPEN' && item.dueAt && Date.parse(item.dueAt) < Date.now()).length,
    },
    eventTrend: buildMonthlyTrend(scopedEvents),
    safetySignals: scopedDefinitions.map((definition) => signalFor(definition.studyId, definition)),
    workflow: {
      unassignedReviews: scope(reviewTasks, studyId).filter((item) => item.status === 'UNASSIGNED').length,
      escalatedReviews: scope(reviewTasks, studyId).filter((item) => item.status === 'ESCALATED').length,
      quarantinedBatches: scope(dataBatches, studyId).filter((item) => item.status === 'QUARANTINED').length,
    },
  };
}

function buildMonthlyTrend(events: AdverseEvent[]) {
  const months: { label: string; value: number }[] = [];
  const anchor = new Date('2026-10-01T00:00:00Z');
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - offset, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    months.push({ label: key, value: events.filter((event) => event.receivedAt.slice(0, 7) === key).length });
  }
  return months;
}

export function listEvents(filters: { studyId?: string; status?: EventStatus; severity?: EventSeverity; term?: string; limit?: number; cursor?: string }) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const filtered = adverseEvents.filter((event) => (!filters.studyId || event.studyId === filters.studyId) && (!filters.status || event.status === filters.status) && (!filters.severity || event.severity === filters.severity) && (!filters.term || normalize(event.term).includes(normalize(filters.term))));
  const sorted = filtered.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id));
  const start = filters.cursor ? Math.max(0, sorted.findIndex((item) => item.id === filters.cursor) + 1) : 0;
  return sorted.slice(start, start + limit).map(clone);
}

export function createEvent(input: Pick<AdverseEvent, 'studyId' | 'subjectId' | 'term' | 'severity' | 'seriousness' | 'causality'> & Partial<Pick<AdverseEvent, 'source' | 'sourceRecordId' | 'onsetDate' | 'receivedAt'>> & { actor?: string }) {
  studyFor(input.studyId);
  const subject = subjects.find((item) => item.id === input.subjectId && item.studyId === input.studyId);
  if (!subject) throw new DomainConflictError('subject does not belong to study', { subjectId: input.subjectId, studyId: input.studyId });
  const source = input.source ?? 'Manual entry';
  const fingerprint = eventFingerprint({ ...input, source });
  const existing = adverseEvents.find((item) => item.fingerprint === fingerprint);
  if (existing) return clone(existing);
  const timestamp = input.receivedAt ?? now();
  const event: AdverseEvent = { id: `ae-${randomUUID().slice(0, 8)}`, studyId: input.studyId, subjectId: input.subjectId, term: input.term.trim(), severity: input.severity, status: 'OPEN', onsetDate: input.onsetDate ?? timestamp.slice(0, 10), receivedAt: timestamp, causality: input.causality, seriousness: input.seriousness, source, sourceRecordId: input.sourceRecordId, fingerprint, version: 1, lastModifiedAt: timestamp, lastModifiedBy: input.actor ?? 'system' };
  adverseEvents.unshift(event);
  appendAudit(event, 'CREATED', input.actor ?? 'system');
  appendTimeline(event, 'EVENT_CREATED', { source, sourceRecordId: input.sourceRecordId ?? null });
  appendOutbox(event.id, 'ADVERSE_EVENT', 'ADVERSE_EVENT_CREATED', event.version, { event: clone(event) });
  if (event.seriousness || event.severity === 'LIFE_THREATENING') reviewTasks.unshift({ id: `review-${randomUUID().slice(0, 8)}`, studyId: event.studyId, eventId: event.id, queue: 'MEDICAL', status: 'UNASSIGNED', priority: event.severity === 'LIFE_THREATENING' ? 100 : 90, dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), createdAt: timestamp });
  return clone(event);
}

export function updateEventStatus(id: string, status: EventStatus, expectedVersion?: number, actor = 'system') {
  const event = eventFor(id);
  if (expectedVersion !== undefined && expectedVersion !== event.version) throw new DomainConflictError('event version conflict', { eventId: id, expectedVersion, actualVersion: event.version });
  if (event.status === status) return clone(event);
  if (!statusTransitions[event.status].includes(status)) throw new DomainConflictError('invalid event status transition', { eventId: id, from: event.status, to: status });
  const previous = event.status;
  event.status = status;
  event.version += 1;
  event.lastModifiedAt = now();
  event.lastModifiedBy = actor;
  appendAudit(event, 'STATUS_CHANGED', actor);
  appendTimeline(event, 'STATUS_CHANGED', { previous, next: status, actor });
  appendOutbox(event.id, 'ADVERSE_EVENT', 'ADVERSE_EVENT_STATUS_CHANGED', event.version, { eventId: event.id, previous, next: status, version: event.version });
  const task = reviewTasks.find((item) => item.eventId === event.id && item.status !== 'RESOLVED');
  if (task && ['CONFIRMED', 'CLOSED'].includes(status)) task.status = 'RESOLVED';
  return clone(event);
}

function activeAttempt(exportId: string) { return exportAttempts.filter((item) => item.exportId === exportId).sort((a, b) => b.attempt - a.attempt)[0]; }
function transitionExport(exportId: string, generation: string, status: ExportJob['status'], progress: number, records: number, error?: string) {
  const job = exports.find((item) => item.id === exportId);
  const attempt = exportAttempts.find((item) => item.exportId === exportId && item.generation === generation);
  if (!job || !attempt || job.activeAttempt !== attempt.attempt || attempt.generation !== generation) return;
  job.status = status; job.progress = progress; job.records = records; job.failureReason = error;
  attempt.status = status; attempt.progress = progress; attempt.records = records;
  if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') attempt.finishedAt = now();
  appendOutbox(job.id, 'EXPORT_JOB', `EXPORT_${status}`, attempt.attempt, { exportId, attempt: attempt.attempt, records, progress, error: error ?? null });
}
function scheduleExportAttempt(job: ExportJob, attempt: ExportAttempt) {
  setTimeout(() => transitionExport(job.id, attempt.generation, 'RUNNING', 25, Math.ceil(job.records * 0.25)), 120);
  setTimeout(() => transitionExport(job.id, attempt.generation, 'RUNNING', 70, Math.ceil(job.records * 0.7)), 420);
  setTimeout(() => transitionExport(job.id, attempt.generation, 'COMPLETED', 100, job.records), 900);
}

export function createExport(studyId: string, type: ExportJob['type'], requestedBy = 'system') {
  studyFor(studyId);
  const snapshotId = `snap-${randomUUID().slice(0, 10)}`;
  const job: ExportJob = { id: `exp-${randomUUID().slice(0, 8)}`, studyId, type, status: 'QUEUED', progress: 0, createdAt: now(), records: expectedRecords(studyId, type), requestedBy, snapshotId, activeAttempt: 1 };
  const attempt: ExportAttempt = { id: `attempt-${job.id}-1`, exportId: job.id, attempt: 1, generation: `${job.id}:1:${randomUUID()}`, status: 'QUEUED', records: job.records, progress: 0, startedAt: now() };
  exports.unshift(job); exportAttempts.unshift(attempt);
  appendOutbox(job.id, 'EXPORT_JOB', 'EXPORT_QUEUED', 1, { exportId: job.id, studyId, type, snapshotId });
  scheduleExportAttempt(job, attempt);
  return clone(job);
}

export function retryExport(exportId: string, requestedBy = 'system') {
  const job = exports.find((item) => item.id === exportId);
  if (!job) return undefined;
  if (!['FAILED', 'CANCELLED'].includes(job.status)) throw new DomainConflictError('only failed or cancelled exports can be retried', { exportId, status: job.status });
  const attemptNo = job.activeAttempt + 1;
  job.activeAttempt = attemptNo; job.status = 'QUEUED'; job.progress = 0; job.failureReason = undefined; job.records = expectedRecords(job.studyId, job.type);
  const attempt: ExportAttempt = { id: `attempt-${job.id}-${attemptNo}`, exportId: job.id, attempt: attemptNo, generation: `${job.id}:${attemptNo}:${randomUUID()}`, status: 'QUEUED', records: job.records, progress: 0, startedAt: now() };
  exportAttempts.unshift(attempt);
  appendOutbox(job.id, 'EXPORT_JOB', 'EXPORT_RETRY_QUEUED', attemptNo, { exportId, attempt: attemptNo, requestedBy });
  scheduleExportAttempt(job, attempt);
  return clone(job);
}

export function cancelExport(exportId: string) {
  const job = exports.find((item) => item.id === exportId);
  if (!job) return undefined;
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) return clone(job);
  transitionExport(exportId, activeAttempt(exportId)?.generation ?? '', 'CANCELLED', job.progress, job.records, 'cancelled by user');
  return clone(job);
}

export function snapshot(studyId?: string) {
  return { sites: scope(sites, studyId).map(clone), subjects: scope(subjects, studyId).map(clone), queries: scope(queries, studyId).map(clone), exports: scope(exports, studyId).map(clone), batches: scope(dataBatches, studyId).map(clone) };
}

export function listAudits(eventId: string): EventAudit[] { return auditEntries.filter((item) => item.eventId === eventId).map(clone); }
export function listTimeline(eventId: string) { return eventTimeline.filter((item) => item.eventId === eventId).map(clone); }
export function listOutbox(studyId?: string) { const eventIds = new Set(scope(adverseEvents, studyId).map((item) => item.id)); return outboxMessages.filter((item) => !studyId || (item.aggregateType === 'ADVERSE_EVENT' ? eventIds.has(item.aggregateId) : exports.some((job) => job.id === item.aggregateId && job.studyId === studyId))).map(clone); }
export function listReviewTasks(studyId?: string): ReviewTask[] { return scope(reviewTasks, studyId).map(clone); }
export function listQualityFindings(studyId?: string): QualityFinding[] { return scope(qualityFindings, studyId).map(clone); }
export function listSignals(studyId?: string) { return signalDefinitions.filter((item) => item.enabled && (!studyId || item.studyId === studyId)).map((definition) => ({ definition: clone(definition), result: signalFor(definition.studyId, definition) })); }

export function ingestBatch(input: Pick<DataBatch, 'studyId' | 'siteId' | 'source' | 'sourceBatchId' | 'effectiveAt' | 'rowCount' | 'checksum'>) {
  studyFor(input.studyId);
  if (!sites.some((item) => item.id === input.siteId && item.studyId === input.studyId)) throw new DomainConflictError('site does not belong to study', { siteId: input.siteId, studyId: input.studyId });
  if (dataBatches.some((batch) => batch.studyId === input.studyId && batch.source === input.source && batch.sourceBatchId === input.sourceBatchId)) throw new DomainConflictError('source batch already ingested', { sourceBatchId: input.sourceBatchId });
  const batch: DataBatch = { ...input, id: `batch-${randomUUID().slice(0, 8)}`, receivedAt: now(), status: 'VALIDATING', acceptedRows: 0, rejectedRows: 0 };
  dataBatches.unshift(batch);
  const blocker = input.rowCount > 1000 && input.source === 'LAB';
  batch.status = blocker ? 'QUARANTINED' : 'ACCEPTED'; batch.acceptedRows = blocker ? Math.floor(input.rowCount * 0.95) : input.rowCount; batch.rejectedRows = input.rowCount - batch.acceptedRows;
  if (blocker) qualityFindings.unshift({ id: `finding-${randomUUID().slice(0, 8)}`, studyId: input.studyId, batchId: batch.id, ruleCode: 'LAB-VOLUME-001', severity: 'BLOCKER', message: 'Large laboratory batch requires validation review.', status: 'OPEN', createdAt: now() });
  appendOutbox(batch.id, 'DATA_BATCH', 'DATA_BATCH_INGESTED', 1, { batch: clone(batch) });
  return clone(batch);
}
