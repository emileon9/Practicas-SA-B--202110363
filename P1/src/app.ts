import express, { type Application } from 'express';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import solicitudOperativaRoutes from './routes/solicitudOperativa.routes';

export const app: Application = express();

app.use(express.json());
app.use(solicitudOperativaRoutes);

// 404 antes que el error handler: solo debe activarse si ninguna ruta respondio.
app.use(notFoundHandler);
// Middleware de errores al final: Express lo reconoce por tener 4 parametros.
app.use(errorHandler);
