import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  cancelExport, createEvent, createExport, dashboard, DomainConflictError, ingestBatch,
  listAudits, listEvents, listOutbox, listQualityFindings, listReviewTasks, listSignals,
  listTimeline, retryExport, snapshot, updateEventStatus,
} from './services.js';
import { studies } from './store.js';
import type { EventSeverity, EventStatus, ExportJob } from './domain.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof DomainConflictError) return reply.code(error.statusCode).send({ message: error.message, details: error.details });
  app.log.error(error);
  return reply.code(500).send({ message: 'internal server error' });
});

app.get('/api/health', async () => ({ status: 'ok', service: 'clinical-trial-api', timestamp: new Date().toISOString() }));
app.get('/api/dashboard', async (request) => dashboard((request.query as { studyId?: string }).studyId));
app.get('/api/studies', async () => studies);
app.get('/api/sites', async (request) => snapshot((request.query as { studyId?: string }).studyId).sites);
app.get('/api/subjects', async (request) => snapshot((request.query as { studyId?: string }).studyId).subjects);
app.get('/api/queries', async (request) => snapshot((request.query as { studyId?: string }).studyId).queries);
app.get('/api/exports', async (request) => snapshot((request.query as { studyId?: string }).studyId).exports);
app.get('/api/events', async (request) => listEvents(request.query as { studyId?: string; status?: EventStatus; severity?: EventSeverity; term?: string; limit?: number; cursor?: string }));
app.post('/api/events', async (request, reply) => {
  const body = request.body as Parameters<typeof createEvent>[0];
  if (!body.studyId || !body.subjectId || !body.term || !body.severity || typeof body.seriousness !== 'boolean' || !body.causality) return reply.code(400).send({ message: 'studyId, subjectId, term, severity, seriousness and causality are required' });
  return reply.code(201).send(createEvent(body));
});
app.patch('/api/events/:id/status', async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as { status: EventStatus; expectedVersion?: number; actor?: string };
  return updateEventStatus(id, body.status, body.expectedVersion, body.actor);
});
app.get('/api/events/:id/audit', async (request) => listAudits((request.params as { id: string }).id));
app.get('/api/events/:id/timeline', async (request) => listTimeline((request.params as { id: string }).id));
app.post('/api/exports', async (request, reply) => {
  const body = request.body as { studyId?: string; type?: ExportJob['type']; requestedBy?: string };
  if (!body.studyId || !body.type) return reply.code(400).send({ message: 'studyId and type are required' });
  return reply.code(201).send(createExport(body.studyId, body.type, body.requestedBy));
});
app.post('/api/exports/:id/retry', async (request) => retryExport((request.params as { id: string }).id, (request.body as { requestedBy?: string } | undefined)?.requestedBy));
app.post('/api/exports/:id/cancel', async (request) => cancelExport((request.params as { id: string }).id));
app.get('/api/reviews', async (request) => listReviewTasks((request.query as { studyId?: string }).studyId));
app.get('/api/quality/findings', async (request) => listQualityFindings((request.query as { studyId?: string }).studyId));
app.get('/api/signals', async (request) => listSignals((request.query as { studyId?: string }).studyId));
app.get('/api/outbox', async (request) => listOutbox((request.query as { studyId?: string }).studyId));
app.post('/api/data-batches', async (request, reply) => reply.code(201).send(ingestBatch(request.body as Parameters<typeof ingestBatch>[0])));

app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' }).catch((error) => { app.log.error(error); process.exit(1); });
