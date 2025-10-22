import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.patch('/mark-all-read', markAllAsRead);

export default router;