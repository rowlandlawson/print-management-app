import express from 'express';
import {
  getAllJobs,
  getJobById,
  createJob,
  updateJobStatus,
  getJobByTicketId,
  updateJob
} from '../controllers/jobController.js';
import { authenticateToken, requireWorkerOrAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireWorkerOrAdmin);
router.get('/', getAllJobs);
router.get('/:id', getJobById);
router.get('/ticket/:ticketId', getJobByTicketId);
router.post('/', createJob);
router.patch('/:id/status', updateJobStatus);
router.put('/:id', updateJob);

export default router;