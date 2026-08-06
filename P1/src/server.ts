import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma.client';

const port = Number(env.PORT);

const server = app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} recibido, cerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
