// Fixture: listens on NITRO_PORT, announces it like Nitro, renders 200. On SIGTERM it does what Nitro's
// node server does: close the server, then exit with code 0.
import { createServer } from 'node:http';
const server = createServer((_req, res) => res.end('ok')).listen(Number(process.env.NITRO_PORT), '127.0.0.1', () => {
  console.log(`Listening on http://127.0.0.1:${process.env.NITRO_PORT}`);
  console.log(`api=${process.env.NUXT_API_URL}`);
});
process.once('SIGTERM', () => server.close(() => process.exit(0)));
