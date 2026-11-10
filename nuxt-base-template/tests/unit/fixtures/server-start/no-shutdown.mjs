// Fixture: like ok.mjs, but without a shutdown handler, as a server whose graceful shutdown was switched
// off. Outside a container SIGTERM still kills it at once; with the check's PID 1 preload it keeps
// listening, as it would in a container.
import { createServer } from 'node:http';
createServer((_req, res) => res.end('ok')).listen(Number(process.env.NITRO_PORT), '127.0.0.1', () => {
  console.log(`Listening on http://127.0.0.1:${process.env.NITRO_PORT}`);
});
