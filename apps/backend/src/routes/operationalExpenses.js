import express from 'express';
import { operationalExpensesController } from '../controllers/operationalExpensesController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply admin middleware to all operational expenses routes
router.use(authenticateToken, requireAdmin);

// Operational expenses routes
router.get('/', operationalExpensesController.getOperationalExpenses);
router.post('/', operationalExpensesController.createOperationalExpense);
router.put('/:id', operationalExpensesController.updateOperationalExpense);
router.delete('/:id', operationalExpensesController.deleteOperationalExpense);
router.get('/categories', operationalExpensesController.getExpenseCategories);
router.get('/monthly-summary', operationalExpensesController.getMonthlyExpenseSummary);

export default router;