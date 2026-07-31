import type { ISolicitudOperativaRepository } from '../interfaces/solicitudOperativa.repository.interface';
import type { ISolicitudOperativaService } from '../interfaces/solicitudOperativa.service.interface';
import type {
  CreateSolicitudOperativaDTO,
  EstadoSolicitud,
  SolicitudOperativa,
  UpdateSolicitudOperativaDTO,
} from '../types/solicitudOperativa.types';

export class SolicitudNotFoundError extends Error {
  constructor(id: number) {
    super(`SolicitudOperativa con id ${id} no existe`);
    this.name = 'SolicitudNotFoundError';
  }
}

export class InvalidSolicitudDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSolicitudDataError';
  }
}

export class InvalidEstadoTransitionError extends Error {
  constructor(actual: EstadoSolicitud, siguiente: EstadoSolicitud) {
    super(`Transicion de estado invalida: ${actual} -> ${siguiente}`);
    this.name = 'InvalidEstadoTransitionError';
  }
}

// Unica fuente de verdad de las transiciones de estado permitidas.
const TRANSICIONES_VALIDAS: Record<EstadoSolicitud, readonly EstadoSolicitud[]> = {
  registrada: ['en_proceso', 'cancelada'],
  en_proceso: ['completada', 'cancelada'],
  completada: [],
  cancelada: [],
};

export class SolicitudOperativaService implements ISolicitudOperativaService {
  constructor(private readonly repository: ISolicitudOperativaRepository) {}

  async create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa> {
    this.validateTitulo(data.titulo);
    this.validateAreaSolicitante(data.areaSolicitante);
    this.validatePrioridad(data.prioridad);
    this.validateCostoEstimado(data.costoEstimado);

    // El estado inicial es siempre 'registrada', sin importar lo que envie el llamador.
    return this.repository.create({
      titulo: data.titulo,
      areaSolicitante: data.areaSolicitante,
      prioridad: data.prioridad,
      costoEstimado: data.costoEstimado,
      estado: 'registrada',
    });
  }

  async findAll(): Promise<SolicitudOperativa[]> {
    return this.repository.findAll();
  }

  async findById(id: number): Promise<SolicitudOperativa> {
    const solicitud = await this.repository.findById(id);
    if (!solicitud) {
      throw new SolicitudNotFoundError(id);
    }
    return solicitud;
  }

  async update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa> {
    const existente = await this.repository.findById(id);
    if (!existente) {
      throw new SolicitudNotFoundError(id);
    }

    if (data.titulo !== undefined) {
      this.validateTitulo(data.titulo);
    }
    if (data.areaSolicitante !== undefined) {
      this.validateAreaSolicitante(data.areaSolicitante);
    }
    if (data.prioridad !== undefined) {
      this.validatePrioridad(data.prioridad);
    }
    if (data.costoEstimado !== undefined) {
      this.validateCostoEstimado(data.costoEstimado);
    }
    if (data.estado !== undefined) {
      this.validateTransicionEstado(existente.estado, data.estado);
    }

    return this.repository.update(id, data);
  }

  async delete(id: number): Promise<void> {
    const existente = await this.repository.findById(id);
    if (!existente) {
      throw new SolicitudNotFoundError(id);
    }
    await this.repository.delete(id);
  }

  private validateTitulo(titulo: string): void {
    if (titulo.trim().length === 0) {
      throw new InvalidSolicitudDataError('El titulo es obligatorio');
    }
  }

  private validateAreaSolicitante(areaSolicitante: string): void {
    if (areaSolicitante.trim().length === 0) {
      throw new InvalidSolicitudDataError('El area solicitante es obligatoria');
    }
  }

  private validatePrioridad(prioridad: number): void {
    if (!Number.isInteger(prioridad) || prioridad < 1 || prioridad > 5) {
      throw new InvalidSolicitudDataError('La prioridad debe ser un entero entre 1 y 5');
    }
  }

  private validateCostoEstimado(costoEstimado: string): void {
    const valor = Number(costoEstimado);
    if (Number.isNaN(valor) || valor <= 0) {
      throw new InvalidSolicitudDataError('El costo estimado debe ser mayor que 0');
    }
  }

  private validateTransicionEstado(actual: EstadoSolicitud, siguiente: EstadoSolicitud): void {
    if (!TRANSICIONES_VALIDAS[actual].includes(siguiente)) {
      throw new InvalidEstadoTransitionError(actual, siguiente);
    }
  }
}
