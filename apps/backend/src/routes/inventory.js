import express from 'express';
import { inventoryController } from '../controllers/inventoryController.js';
import { materialMonitoringController } from '../controllers/materialMonitoringController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
        
const router = express.Router();

// Apply admin middleware to all inventory routes
router.use(authenticateToken, requireAdmin);

// Inventory management routes
router.get('/', inventoryController.getInventory);
router.post('/', inventoryController.createInventory);
router.put('/:id', inventoryController.updateInventory);
router.delete('/:id', inventoryController.deleteInventory);
router.get('/alerts/low-stock', inventoryController.getLowStockAlerts);
router.get('/categories', inventoryController.getCategories);

// Material monitoring routes
router.get('/monitoring/usage-trends', materialMonitoringController.getMaterialUsageTrends);
router.get('/monitoring/waste-analysis', materialMonitoringController.getWasteAnalysis);
router.get('/monitoring/stock-levels', materialMonitoringController.getStockLevels);
router.get('/monitoring/cost-analysis', materialMonitoringController.getMaterialCostAnalysis);
router.get('/monitoring/automatic-updates', materialMonitoringController.getAutomaticStockUpdates);

export default router;