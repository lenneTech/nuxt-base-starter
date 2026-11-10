// Fixture: like ok.mjs, but its shutdown fails (a close hook that throws, say) and the handler exits
// with code 1.
import { createServer } from 'node:http';
const server = createServer((_req, res) => res.end('ok')).listen(Number(process.env.NITRO_PORT), '127.0.0.1', () => {
  console.log(`Listening on http://127.0.0.1:${process.env.NITRO_PORT}`);
});
process.once('SIGTERM', () => {
  console.error('shutdown failed: boom while closing');
  server.close(() => process.exit(1));
});
