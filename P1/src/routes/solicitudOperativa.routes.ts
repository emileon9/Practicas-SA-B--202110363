import { Router } from 'express';
import { container } from '../config/container';

const router = Router();
const { solicitudOperativaController } = container;

router.post('/solicitudes', solicitudOperativaController.create);
router.get('/solicitudes', solicitudOperativaController.findAll);
router.get('/solicitudes/:id', solicitudOperativaController.findById);
router.put('/solicitudes/:id', solicitudOperativaController.update);
router.delete('/solicitudes/:id', solicitudOperativaController.delete);

export default router;
