import express from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  resetUserPassword
} from '../controllers/userController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/reset-password', resetUserPassword);

export default router;