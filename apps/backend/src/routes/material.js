import express from 'express';
import { materialController } from '../controllers/materialController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply admin middleware to all material routes
router.use(authenticateToken, requireAdmin);

// Material management routes
router.get('/', materialController.getMaterials);
router.post('/', materialController.createMaterial);
router.put('/:id', materialController.updateMaterial);
router.delete('/:id', materialController.deleteMaterial);
router.get('/categories', materialController.getMaterialCategories);

export default router;