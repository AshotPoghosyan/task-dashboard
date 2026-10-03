import { idParamSchema, updateUserSchema, userListSchema, userSchema } from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../plugins/auth.js';
import { listUsers, updateUser } from '../services/userService.js';

/** Admin-only user management. */
export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/users', async (request) => {
    requireAdmin(request);
    return userListSchema.parse({ items: await listUsers() });
  });

  app.patch('/api/users/:id', async (request) => {
    requireAdmin(request);
    const { id } = idParamSchema.parse(request.params);
    return userSchema.parse(await updateUser(id, updateUserSchema.parse(request.body)));
  });
};
