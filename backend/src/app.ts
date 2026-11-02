import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import type { Services } from './services.js';
import { employeeSchema, entriesQuerySchema, reportQuerySchema, startTimerSchema } from './schemas.js';

export function createApp(services: Services) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_request, response) => response.json({ data: { status: 'ok' } }));
  app.get('/api/employees', (_request, response) => response.json({ data: services.listEmployees() }));
  app.post('/api/employees', (request, response) => {
    const body = employeeSchema.parse(request.body);
    response.status(201).json({ data: services.createEmployee(body.fullName, body.position) });
  });
  app.get('/api/time-entries/active', (_request, response) => response.json({ data: services.listActiveTimers() }));
  app.get('/api/time-entries', (request, response) => {
    const filters = entriesQuerySchema.parse(request.query);
    response.json({ data: services.listTimeEntries(filters) });
  });
  app.post('/api/time-entries/start', (request, response) => {
    const body = startTimerSchema.parse(request.body);
    response.status(201).json({ data: services.startTimer(body.employeeId, body.taskDescription) });
  });
  app.post('/api/time-entries/:id/stop', (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'INVALID_ID', 'Некорректный идентификатор записи');
    response.json({ data: services.stopTimer(id) });
  });
  app.get('/api/reports/summary', (request, response) => {
    const query = reportQuerySchema.parse(request.query);
    response.json({ data: services.buildReport(query.startDate, query.endDate, query.employeeId) });
  });
  app.get('/api/reports/employee', (request, response) => {
    const query = reportQuerySchema.parse(request.query);
    const report = services.buildReport(query.startDate, query.endDate, query.employeeId);
    response.json({ data: report.employees });
  });
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Маршрут API не найден' } });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist/frontend')));
    app.get('*splat', (_request, response) => response.sendFile(path.resolve('dist/frontend/index.html')));
  }

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const requestError = error as { type?: unknown };
    if (requestError?.type === 'entity.parse.failed') {
      response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Некорректный JSON в теле запроса' } });
      return;
    }
    if (requestError?.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Тело запроса слишком большое' } });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Проверьте введенные данные' } });
      return;
    }
    if (error instanceof AppError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос. Попробуйте позже' } });
  };
  app.use(errorHandler);
  return app;
}