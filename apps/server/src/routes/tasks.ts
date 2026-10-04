import {
  createTaskSchema,
  idParamSchema,
  linkMergeRequestSchema,
  paginatedSchema,
  taskCountsSchema,
  taskFiltersSchema,
  taskMergeRequestParamSchema,
  taskSchema,
  updateTaskSchema,
} from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import { getTaskCounts, listTasks } from '../services/taskListService.js';
import {
  createTask,
  deleteTask,
  getTask,
  linkMergeRequest,
  unlinkMergeRequest,
  updateTask,
} from '../services/taskService.js';

const taskPageSchema = paginatedSchema(taskSchema);

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/tasks', async (request) =>
    taskPageSchema.parse(await listTasks(taskFiltersSchema.parse(request.query))),
  );

  app.get('/api/tasks/counts', async (request) =>
    taskCountsSchema.parse(await getTaskCounts(taskFiltersSchema.parse(request.query))),
  );

  app.get('/api/tasks/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return taskSchema.parse(await getTask(id));
  });

  app.post('/api/tasks', async (request, reply) => {
    const task = await createTask(
      createTaskSchema.parse(request.body),
      request.authUser?.id ?? null,
    );
    return reply.code(201).send(taskSchema.parse(task));
  });

  app.patch('/api/tasks/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return taskSchema.parse(
      await updateTask(id, updateTaskSchema.parse(request.body), request.authUser?.id ?? null),
    );
  });

  app.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await deleteTask(id);
    return reply.code(204).send();
  });

  app.post('/api/tasks/:id/merge-requests', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const { mergeRequestId } = linkMergeRequestSchema.parse(request.body);
    return taskSchema.parse(
      await linkMergeRequest(id, mergeRequestId, request.authUser?.id ?? null),
    );
  });

  app.delete('/api/tasks/:id/merge-requests/:mrId', async (request) => {
    const { id, mrId } = taskMergeRequestParamSchema.parse(request.params);
    return taskSchema.parse(await unlinkMergeRequest(id, mrId, request.authUser?.id ?? null));
  });
};
