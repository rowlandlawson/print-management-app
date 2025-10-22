import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
  login, 
  adminLogin,
  register,
  getCurrentUser, 
  changePassword, 
  updateProfile,
  forgotPassword,
  resetPassword,
  adminResetUserPassword
} from '../controllers/authController.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (require any valid token)
router.get('/me', authenticateToken, getCurrentUser);
router.post('/change-password', authenticateToken, changePassword);
router.put('/profile', authenticateToken, updateProfile);

router.post('/admin/reset-user-password', authenticateToken, requireAdmin, adminResetUserPassword);

// Add these to your auth routes file
import { pool } from '../config/database.js';

// Debug: Check all users
router.get('/debug-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, user_name, role, is_active FROM users');
    res.json({ 
      totalUsers: result.rows.length,
      users: result.rows 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Check specific user by email
router.get('/debug-user/:email', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, user_name, role, is_active, password_hash FROM users WHERE email = $1',
      [req.params.email]
    );
    res.json({ 
      user: result.rows[0] || null,
      exists: result.rows.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this to your auth routes to fix the admin username
router.post('/fix-admin-username', async (req, res) => {
  try {
    // Remove newline from admin username
    const result = await pool.query(
      `UPDATE users 
       SET user_name = 'admin', updated_at = CURRENT_TIMESTAMP 
       WHERE email = 'admin@printpress.com' 
       RETURNING id, email, user_name, role`
    );
    
    res.json({ 
      message: 'Admin username fixed',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this to your auth routes
router.post('/reset-admin-password', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('admin!123', 12);
    
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE email = 'admin@printpress.com' 
       RETURNING id, email, user_name, role`,
      [hashedPassword]
    );
    
    res.json({ 
      message: 'Admin password reset to: admin!123',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;