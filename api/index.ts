import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from './[...all].js';

export default function indexHandler(req: IncomingMessage, res: ServerResponse) {
  return handler(req, res);
}
