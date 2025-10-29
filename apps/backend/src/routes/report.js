import express from 'express';
import { reportsController } from '../controllers/reportsController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// Financial reports
router.get('/monthly-financial-summary', reportsController.getMonthlyFinancialSummary);
router.get('/profit-loss-statement', reportsController.getProfitLossStatement);

// Material monitoring reports
router.get('/material-monitoring-dashboard', reportsController.getMaterialMonitoringDashboard);

// Business performance reports
router.get('/business-performance', reportsController.getBusinessPerformance);

// Data export
router.get('/export-data', reportsController.exportReportData);

export default router;