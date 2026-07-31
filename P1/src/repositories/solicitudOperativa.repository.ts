import { prisma } from '../config/prisma.client';
import type { SolicitudOperativa as PrismaSolicitudOperativa } from '../generated/prisma/client';
import type { ISolicitudOperativaRepository } from '../interfaces/solicitudOperativa.repository.interface';
import type {
  CreateSolicitudOperativaDTO,
  SolicitudOperativa,
  UpdateSolicitudOperativaDTO,
} from '../types/solicitudOperativa.types';

// El repositorio es la unica capa que conoce el modelo generado por Prisma.
// Este mapeo evita que ese modelo se filtre hacia services/controllers.
function toDomain(record: PrismaSolicitudOperativa): SolicitudOperativa {
  return {
    id: record.id,
    titulo: record.titulo,
    areaSolicitante: record.areaSolicitante,
    prioridad: record.prioridad,
    // .toString(), no .toNumber(): preserva la precision del Decimal.
    costoEstimado: record.costoEstimado.toString(),
    estado: record.estado,
  };
}

export class SolicitudOperativaRepository implements ISolicitudOperativaRepository {
  async create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa> {
    const created = await prisma.solicitudOperativa.create({
      data: {
        titulo: data.titulo,
        areaSolicitante: data.areaSolicitante,
        prioridad: data.prioridad,
        costoEstimado: data.costoEstimado,
        ...(data.estado !== undefined && { estado: data.estado }),
      },
    });
    return toDomain(created);
  }

  async findAll(): Promise<SolicitudOperativa[]> {
    const records = await prisma.solicitudOperativa.findMany({
      orderBy: { id: 'asc' },
    });
    return records.map(toDomain);
  }

  async findById(id: number): Promise<SolicitudOperativa | null> {
    const record = await prisma.solicitudOperativa.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa> {
    const updated = await prisma.solicitudOperativa.update({
      where: { id },
      data: {
        ...(data.titulo !== undefined && { titulo: data.titulo }),
        ...(data.areaSolicitante !== undefined && { areaSolicitante: data.areaSolicitante }),
        ...(data.prioridad !== undefined && { prioridad: data.prioridad }),
        ...(data.costoEstimado !== undefined && { costoEstimado: data.costoEstimado }),
        ...(data.estado !== undefined && { estado: data.estado }),
      },
    });
    return toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await prisma.solicitudOperativa.delete({ where: { id } });
  }
}
