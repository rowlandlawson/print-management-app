import express from 'express';
import {
  recordPayment,
  getPaymentsByJob,
  getAllPayments,
  getReceiptData,
  getPaymentStats
} from '../controllers/paymentController.js';
import { downloadReceiptPDF } from '../controllers/paymentController.js';
import { authenticateToken, requireWorkerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken, requireWorkerOrAdmin);

// Record a new payment
router.post('/', recordPayment);
router.get('/', getAllPayments);
router.get('/job/:jobId', getPaymentsByJob);
router.get('/receipt/:paymentId', getReceiptData);
router.get('/stats', getPaymentStats);

router.get('/receipt/:paymentId/pdf', downloadReceiptPDF);

export default router;