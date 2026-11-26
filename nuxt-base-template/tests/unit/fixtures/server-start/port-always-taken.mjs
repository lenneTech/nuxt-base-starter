// Fixture: every start finds its port taken (Node's own uncaught EADDRINUSE, as in Nitro).
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';

const port = Number(process.env.NITRO_PORT);
createNetServer().listen(port, '127.0.0.1', () => {
  createServer().listen(port, '127.0.0.1');
});
