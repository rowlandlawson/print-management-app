import express from 'express';
import { customerController } from '../controllers/customerController.js';
import { authenticateToken, requireWorkerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all customer routes
router.use(authenticateToken, requireWorkerOrAdmin);

// Customer routes
router.get('/', customerController.getCustomers);
router.get('/stats', customerController.getCustomerStats);
router.get('/search/:query', customerController.searchCustomers);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);

export default router;