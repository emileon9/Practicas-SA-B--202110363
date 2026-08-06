import type { NextFunction, Request, Response } from 'express';
import type { ISolicitudOperativaService } from '../interfaces/solicitudOperativa.service.interface';
import type { UpdateSolicitudOperativaDTO } from '../types/solicitudOperativa.types';
import {
  createSolicitudOperativaSchema,
  updateSolicitudOperativaSchema,
} from '../validators/solicitudOperativa.validator';

export class InvalidIdError extends Error {
  constructor(rawId: string | undefined) {
    super(`El id '${rawId}' no es un identificador numerico valido`);
    this.name = 'InvalidIdError';
  }
}

// Express 5 tipa los params como string | string[] | undefined (soporte de path-to-regexp
// para segmentos repetidos); un id de recurso nunca es un arreglo.
function parseId(rawId: string | string[] | undefined): number {
  if (typeof rawId !== 'string' || rawId.trim() === '') {
    throw new InvalidIdError(Array.isArray(rawId) ? rawId.join(',') : rawId);
  }
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    throw new InvalidIdError(rawId);
  }
  return id;
}

// exactOptionalPropertyTypes distingue "propiedad ausente" de "propiedad presente con
// valor undefined"; el .partial() de Zod produce lo segundo, el DTO espera lo primero.
function toUpdateDTO(parsed: {
  titulo?: string | undefined;
  areaSolicitante?: string | undefined;
  prioridad?: number | undefined;
  costoEstimado?: string | undefined;
  estado?: UpdateSolicitudOperativaDTO['estado'] | undefined;
}): UpdateSolicitudOperativaDTO {
  return {
    ...(parsed.titulo !== undefined && { titulo: parsed.titulo }),
    ...(parsed.areaSolicitante !== undefined && { areaSolicitante: parsed.areaSolicitante }),
    ...(parsed.prioridad !== undefined && { prioridad: parsed.prioridad }),
    ...(parsed.costoEstimado !== undefined && { costoEstimado: parsed.costoEstimado }),
    ...(parsed.estado !== undefined && { estado: parsed.estado }),
  };
}

export class SolicitudOperativaController {
  constructor(private readonly service: ISolicitudOperativaService) {}

  // Arrow functions: conservan el 'this' correcto cuando Express las use como
  // referencias sueltas (ej. router.post('/', controller.create)), sin necesitar .bind().

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createSolicitudOperativaSchema.parse(req.body);
      const solicitud = await this.service.create(data);
      res.status(201).json(solicitud);
    } catch (error) {
      next(error);
    }
  };

  findAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const solicitudes = await this.service.findAll();
      res.status(200).json(solicitudes);
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params['id']);
      const solicitud = await this.service.findById(id);
      res.status(200).json(solicitud);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params['id']);
      const data = toUpdateDTO(updateSolicitudOperativaSchema.parse(req.body));
      const solicitud = await this.service.update(id, data);
      res.status(200).json(solicitud);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params['id']);
      await this.service.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
