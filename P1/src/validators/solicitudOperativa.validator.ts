import { z } from 'zod';

const tituloSchema = z
  .string({ error: 'El titulo es obligatorio' })
  .trim()
  .min(1, 'El titulo es obligatorio')
  .max(200, 'El titulo no puede superar los 200 caracteres');

const areaSolicitanteSchema = z
  .string({ error: 'El area solicitante es obligatoria' })
  .trim()
  .min(1, 'El area solicitante es obligatoria')
  .max(100, 'El area solicitante no puede superar los 100 caracteres');

const prioridadSchema = z
  .number({ error: 'La prioridad es obligatoria' })
  .int('La prioridad debe ser un numero entero')
  .min(1, 'La prioridad minima permitida es 1')
  .max(5, 'La prioridad maxima permitida es 5');

// string, no number: misma representacion decimal-safe que usan types/ y repositories/
// (ver docs/ARCHITECTURE.md, decision de diseno #1) para no perder precision monetaria.
const costoEstimadoSchema = z
  .string({ error: 'El costo estimado es obligatorio' })
  .regex(/^\d+(\.\d{1,2})?$/, 'El costo estimado debe ser un valor decimal valido (hasta 2 decimales)')
  .refine((value) => Number(value) > 0, 'El costo estimado debe ser mayor que 0');

// Los mismos cuatro literales que EstadoSolicitud en types/ y en el enum de prisma/schema.prisma.
const estadoSchema = z.enum(['registrada', 'en_proceso', 'completada', 'cancelada']);

export const createSolicitudOperativaSchema = z
  .object({
    titulo: tituloSchema,
    areaSolicitante: areaSolicitanteSchema,
    prioridad: prioridadSchema,
    costoEstimado: costoEstimadoSchema,
  })
  .strict();

export const updateSolicitudOperativaSchema = z
  .object({
    titulo: tituloSchema,
    areaSolicitante: areaSolicitanteSchema,
    prioridad: prioridadSchema,
    costoEstimado: costoEstimadoSchema,
    estado: estadoSchema,
  })
  .partial()
  .strict();

export type CreateSolicitudOperativaInput = z.infer<typeof createSolicitudOperativaSchema>;
export type UpdateSolicitudOperativaInput = z.infer<typeof updateSolicitudOperativaSchema>;
