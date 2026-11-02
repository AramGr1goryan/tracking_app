import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { createServices } from './services.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const db = openDatabase();
const app = createApp(createServices(db));
const server = app.listen(port, host, () => console.log(`Time tracker API is listening on http://${host}:${port}`));

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);