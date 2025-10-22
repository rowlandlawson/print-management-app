import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getWebSocketStatus } from '../controllers/websocketController.js';

const router = express.Router();

// Get WebSocket connection status (Admin only)
router.get('/status', authenticateToken, requireAdmin, getWebSocketStatus);

export default router;