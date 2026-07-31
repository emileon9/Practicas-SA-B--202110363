export type EstadoSolicitud = 'registrada' | 'en_proceso' | 'completada' | 'cancelada';

export interface SolicitudOperativa {
  id: number;
  titulo: string;
  areaSolicitante: string;
  prioridad: number;
  // string, no number: evita perdida de precision del Decimal de Prisma al serializar.
  costoEstimado: string;
  estado: EstadoSolicitud;
}

export interface CreateSolicitudOperativaDTO {
  titulo: string;
  areaSolicitante: string;
  prioridad: number;
  costoEstimado: string;
  estado?: EstadoSolicitud;
}

export interface UpdateSolicitudOperativaDTO {
  titulo?: string;
  areaSolicitante?: string;
  prioridad?: number;
  costoEstimado?: string;
  estado?: EstadoSolicitud;
}
