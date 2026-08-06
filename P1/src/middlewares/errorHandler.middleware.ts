import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { InvalidIdError } from '../controllers/solicitudOperativa.controller';
import {
  InvalidEstadoTransitionError,
  InvalidSolicitudDataError,
  SolicitudNotFoundError,
} from '../services/solicitudOperativa.service';

interface ErrorResponseBody {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

const PRISMA_RECORD_NOT_FOUND_CODE = 'P2025';

// Deteccion estructural (duck typing) en vez de "instanceof Prisma.PrismaClientKnownRequestError":
// importar la clase real obligaria a traer generated/prisma a middlewares/, rompiendo la regla
// de que repositories/ es la unica capa que conoce Prisma (ver docs/ARCHITECTURE.md).
function isPrismaKnownRequestError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'clientVersion' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof z.ZodError) {
    const body: ErrorResponseBody = {
      success: false,
      message: 'Error de validacion',
      errors: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
    res.status(400).json(body);
    return;
  }

  if (error instanceof InvalidIdError || error instanceof InvalidSolicitudDataError) {
    res.status(400).json({ success: false, message: error.message } satisfies ErrorResponseBody);
    return;
  }

  if (error instanceof SolicitudNotFoundError) {
    res.status(404).json({ success: false, message: error.message } satisfies ErrorResponseBody);
    return;
  }

  if (error instanceof InvalidEstadoTransitionError) {
    res.status(409).json({ success: false, message: error.message } satisfies ErrorResponseBody);
    return;
  }

  if (isPrismaKnownRequestError(error)) {
    if (error.code === PRISMA_RECORD_NOT_FOUND_CODE) {
      res.status(404).json({ success: false, message: 'Recurso no encontrado' } satisfies ErrorResponseBody);
      return;
    }
    // Mensaje generico: el detalle real de Prisma puede incluir nombres de tabla/columna.
    res
      .status(400)
      .json({ success: false, message: 'Error al procesar la solicitud en la base de datos' } satisfies ErrorResponseBody);
    return;
  }

  res.status(500).json({ success: false, message: 'Error interno del servidor' } satisfies ErrorResponseBody);
}
