import type {
  CreateSolicitudOperativaDTO,
  SolicitudOperativa,
  UpdateSolicitudOperativaDTO,
} from '../types/solicitudOperativa.types';

export interface ISolicitudOperativaService {
  create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  findAll(): Promise<SolicitudOperativa[]>;
  // A diferencia del repositorio, "no encontrado" es un error de dominio aqui, no un null.
  findById(id: number): Promise<SolicitudOperativa>;
  update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  delete(id: number): Promise<void>;
}
