// Fixture: like ok.mjs, but without a shutdown handler, as a server whose graceful shutdown was switched
// off. Outside a container SIGTERM still kills it at once; with the check's PID 1 preload it keeps
// listening, as it would in a container.
import { createServer } from 'node:http';
createServer((_req, res) => res.end('ok')).listen(Number(process.env.NITRO_PORT), '127.0.0.1', () => {
  console.log(`Listening on http://127.0.0.1:${process.env.NITRO_PORT}`);
});
// With the preload nothing outside ends this server but its runner. Should a run die before it can
// (a failed test, a killed worker), the fixture stops itself after a minute instead of listening for
// hours. No test keeps it that long; the unref'd timer keeps nothing alive on its own.
setTimeout(() => process.exit(0), 60_000).unref();
