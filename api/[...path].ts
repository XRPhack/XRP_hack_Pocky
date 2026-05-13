import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleApiRequest } from '../server/server.js';

export default async function apiRoute(request: IncomingMessage, response: ServerResponse): Promise<void> {
  return handleApiRequest(request, response);
}
