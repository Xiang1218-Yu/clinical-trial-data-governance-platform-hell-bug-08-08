import assert from 'node:assert/strict';
import {
  adverseEvents, auditEntries, dataBatches, eventTimeline, outboxMessages,
} from './store.js';
import {
  cancelExport, createEvent, createExport, ingestBatch, listOutbox, listTimeline,
  retryExport, updateEventStatus,
} from './services.js';

function groupByAggregate(messages: ReturnType<typeof listOutbox>) {
  const grouped = new Map<string, typeof messages>();
  for (const message of messages) {
    const key = `${message.aggregateType}:${message.aggregateId}`;
    const list = grouped.get(key) ?? [];
    list.push(message);
    grouped.set(key, list);
  }
  return grouped;
}

// ---------- ADVERSE_EVENT: every business version survives ----------
const event = createEvent({
  studyId: 'st-101', subjectId: 'sub-001', term: 'Headache', severity: 'MODERATE',
  seriousness: false, causality: 'Possible', actor: 'tester',
});
updateEventStatus(event.id, 'MEDICAL_REVIEW', undefined, 'tester');
updateEventStatus(event.id, 'CONFIRMED', undefined, 'tester');

const aeMessages = listOutbox().filter((message) => message.aggregateId === event.id);
assert.equal(aeMessages.length, 3, 'created + two status versions must each produce a message');
assert.deepEqual(aeMessages.map((message) => message.version), [1, 2, 3], 'messages ordered by version progression');
assert.deepEqual(
  aeMessages.map((message) => message.eventType),
  ['ADVERSE_EVENT_CREATED', 'ADVERSE_EVENT_STATUS_CHANGED', 'ADVERSE_EVENT_STATUS_CHANGED'],
);
assert.ok(aeMessages.every((message) => message.status === 'PENDING'));
// Different event types / versions must have distinct dedupe keys.
assert.equal(new Set(aeMessages.map((message) => message.dedupeKey)).size, 3);
assert.equal(aeMessages[0].dedupeKey, `ADVERSE_EVENT:${event.id}:ADVERSE_EVENT_CREATED:1`);
assert.equal(aeMessages[1].dedupeKey, `ADVERSE_EVENT:${event.id}:ADVERSE_EVENT_STATUS_CHANGED:2`);

// Payload frozen at write time: v1 message keeps the v1 OPEN snapshot despite later changes.
const v1Payload = aeMessages[0].payload as { event: typeof event };
assert.equal(v1Payload.event.status, 'OPEN');
assert.equal(v1Payload.event.version, 1);
assert.equal(aeMessages[2].payload.next, 'CONFIRMED');

// Audit + timeline changes are mirrored 1:1 in the outbox.
assert.equal(auditEntries.filter((entry) => entry.eventId === event.id).length, 3);
assert.equal(eventTimeline.filter((entry) => entry.eventId === event.id).length, 3);

// Idempotency: an exact replay (same aggregate/eventType/version) hits the existing record.
const beforeReplay = outboxMessages.length;
const replayed = updateEventStatus(event.id, 'CONFIRMED', undefined, 'tester-again'); // same status: no change, no write
assert.equal(replayed.version, 3);
const duplicateCreate = createEvent({
  studyId: event.studyId, subjectId: event.subjectId, term: 'Headache', severity: 'MODERATE',
  seriousness: false, causality: 'Possible',
});
assert.equal(duplicateCreate.id, event.id, 'fingerprint-deduped create returns the same event');
assert.equal(outboxMessages.length, beforeReplay, 'replays must not create duplicate outbox rows');

// Mutating the aggregate after the fact must not rewrite a frozen payload.
const current = adverseEvents.find((item) => item.id === event.id)!;
current.status = 'REPORTED';
current.version = 99;
assert.equal((aeMessages[0].payload as { event: { status: string } }).event.status, 'OPEN');
current.status = 'CONFIRMED';
current.version = 3;

// ---------- EXPORT_JOB: queued/cancelled phases and retry attempts survive ----------
const job = createExport('st-101', 'RAW', 'tester');
cancelExport(job.id); // synchronously CANCELLED before the async RUNNING timers fire
const firstAttemptMessages = listOutbox().filter((message) => message.aggregateId === job.id && message.version === 1);
assert.deepEqual(firstAttemptMessages.map((message) => message.eventType), ['EXPORT_QUEUED', 'EXPORT_CANCELLED'], 'each business phase of attempt 1 is preserved');
const firstAttemptKeys = firstAttemptMessages.map((message) => message.dedupeKey);
assert.equal(new Set(firstAttemptKeys).size, firstAttemptMessages.length, 'phases share version but keep distinct keys via eventType');
assert.equal(firstAttemptMessages[1].payload.error, 'cancelled by user', 'cancel payload frozen at write time');

const retried = retryExport(job.id, 'tester')!;
assert.equal(retried.activeAttempt, 2);
await new Promise((resolve) => setTimeout(resolve, 1100));
const jobMessages = listOutbox().filter((message) => message.aggregateId === job.id);
assert.ok(jobMessages.some((message) => message.eventType === 'EXPORT_RETRY_QUEUED' && message.version === 2));
assert.ok(jobMessages.some((message) => message.eventType === 'EXPORT_RUNNING' && message.version === 2), 'attempt 2 phases are independent of attempt 1');
assert.ok(jobMessages.some((message) => message.eventType === 'EXPORT_COMPLETED' && message.version === 2));
const firstAttemptCancelled = jobMessages.find((message) => message.eventType === 'EXPORT_CANCELLED' && message.version === 1)!;
assert.ok(firstAttemptCancelled, 'the attempt-1 CANCELLED message must not be lost after the retry succeeds');
for (let index = 1; index < jobMessages.length; index += 1) {
  assert.ok(jobMessages[index - 1].version <= jobMessages[index].version, 'attempt versions ascending in listing');
}

// cancelExport on a completed job is a no-op replay: no extra message
const countBeforeCancel = outboxMessages.length;
cancelExport(job.id);
assert.equal(outboxMessages.length, countBeforeCancel);

// ---------- DATA_BATCH: ingest message retained and visible in study scope ----------
const batch = ingestBatch({
  studyId: 'st-101', siteId: 'site-ny', source: 'EDC', sourceBatchId: `EDC-NY-${Date.now()}`,
  effectiveAt: '2026-10-06T07:00:00Z', rowCount: 120, checksum: 'sha256:verify',
});
const batchMessages = listOutbox().filter((message) => message.aggregateId === batch.id);
assert.equal(batchMessages.length, 1);
assert.equal(batchMessages[0].eventType, 'DATA_BATCH_INGESTED');
assert.equal(batchMessages[0].version, 1);
assert.equal(batchMessages[0].dedupeKey, `DATA_BATCH:${batch.id}:DATA_BATCH_INGESTED:1`);
assert.equal((batchMessages[0].payload as { batch: { status: string } }).batch.status, dataBatches.find((item) => item.id === batch.id)!.status);

// ---------- scoped listing includes all three aggregate types ----------
const scoped = listOutbox('st-101');
const types = new Set(scoped.map((message) => message.aggregateType));
assert.deepEqual([...types].sort(), ['ADVERSE_EVENT', 'DATA_BATCH', 'EXPORT_JOB'], 'DATA_BATCH previously dropped from study-scoped outbox');
assert.ok(scoped.some((message) => message.aggregateId === batch.id));

// ---------- global ordering: per aggregate by version progression ----------
for (const [key, list] of groupByAggregate(listOutbox())) {
  const versions = list.map((message) => message.version);
  for (let index = 1; index < versions.length; index += 1) {
    assert.ok(versions[index - 1] <= versions[index], `${key} not ordered by version: ${versions.join(',')}`);
  }
}
// Other studies' aggregates must not leak into the scope.
assert.ok(!listOutbox('st-102').some((message) => message.aggregateId === event.id));

// timeline read API still returns the per-version entries
assert.equal(listTimeline(event.id).length, 3);

console.log(`OK — ${outboxMessages.length} outbox messages; per-version retention, freeze and ordering verified across ADVERSE_EVENT / EXPORT_JOB / DATA_BATCH`);
