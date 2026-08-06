import type {
  CreateSolicitudOperativaDTO,
  SolicitudOperativa,
  UpdateSolicitudOperativaDTO,
} from '../types/solicitudOperativa.types';

export interface ISolicitudOperativaRepository {
  create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  findAll(): Promise<SolicitudOperativa[]>;
  findById(id: number): Promise<SolicitudOperativa | null>;
  update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  delete(id: number): Promise<void>;
}
