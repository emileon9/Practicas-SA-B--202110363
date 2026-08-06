import { SolicitudOperativaController } from '../controllers/solicitudOperativa.controller';
import { SolicitudOperativaRepository } from '../repositories/solicitudOperativa.repository';
import { SolicitudOperativaService } from '../services/solicitudOperativa.service';

// Composition root: unico lugar del proyecto que conoce las clases concretas
// (Repository, Service, Controller) y las conecta entre si mediante constructor injection.
// Ninguna otra capa (routes/, controllers/) instancia estas clases directamente.
const solicitudOperativaRepository = new SolicitudOperativaRepository();
const solicitudOperativaService = new SolicitudOperativaService(solicitudOperativaRepository);
const solicitudOperativaController = new SolicitudOperativaController(solicitudOperativaService);

export const container = {
  solicitudOperativaController,
};
