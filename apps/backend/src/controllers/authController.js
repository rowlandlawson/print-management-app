import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database.js';

/**
 * @desc Admin login only (email or username)
 */
// export const adminLogin = async (req, res) => {
//   try {
//     const { identifier, password } = req.body; 

//     if (!identifier || !password) {
//       return res.status(400).json({ error: 'Email/Username and password are required' });
//     }

//     // Query database for active admin using email OR username
//     const result = await pool.query(
//       `SELECT * FROM users 
//        WHERE (email = $1 OR user_name = $1) 
//        AND role = $2 
//        AND is_active = true`,
//       [identifier.toLowerCase(), 'admin']
//     );

//     if (result.rows.length === 0) {
//       return res.status(401).json({ error: 'Invalid admin credentials' });
//     }

//     const user = result.rows[0];

//     // Check password
//     const isValidPassword = await bcrypt.compare(password, user.password_hash);
//     if (!isValidPassword) {
//       return res.status(401).json({ error: 'Invalid admin credentials' });
//     }

//     // Generate JWT
//     const token = jwt.sign(
//       { 
//         userId: user.id,
//         email: user.email,
//         username: user.user_name,
//         role: user.role,
//         name: user.name
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRES_IN }
//     );

//     const { password_hash, ...userWithoutPassword } = user;

//     res.json({
//       message: 'Admin login successful',
//       token,
//       user: userWithoutPassword,
//     });
//   } catch (error) {
//     console.error('Admin login error:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };
export const adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    console.log('🔍 Admin login attempt:', { identifier });

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    // Query database for active admin using email OR username
    const result = await pool.query(
      `SELECT * FROM users 
       WHERE (email = $1 OR user_name = $1) 
       AND role = $2 
       AND is_active = true`,
      [identifier.toLowerCase(), 'admin']
    );

    console.log('🔍 Query result:', {
      rowsFound: result.rows.length,
      userFound: result.rows[0] ? {
        id: result.rows[0].id,
        email: result.rows[0].email,
        user_name: result.rows[0].user_name,
        role: result.rows[0].role,
        is_active: result.rows[0].is_active
      } : null
    });

    if (result.rows.length === 0) {
      console.log('❌ No admin user found or wrong role');
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const user = result.rows[0];

    // Check password
    console.log('🔍 Checking password...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('🔍 Password valid:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        username: user.user_name,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const { password_hash, ...userWithoutPassword } = user;

    console.log('✅ Admin login successful');
    res.json({
      message: 'Admin login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
/**
 * @desc Register a new user
 */
export const register = async (req, res) => {
  try {
    const { name, email, user_name, password } = req.body;

    if (!name || !email || !user_name || !password) {
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    }

    const existingUser = await pool.query(
      `SELECT * FROM users WHERE email = $1 OR user_name = $2`,
      [email.toLowerCase(), user_name.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    // Optional: validate password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long, include at least one uppercase letter and one special character'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO users (name, email, user_name, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'worker', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, user_name, role, is_active, created_at, updated_at`,
      [name, email.toLowerCase(), user_name.toLowerCase(), passwordHash]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Login with email or username
 */
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required' });
    }

    const result = await pool.query(
      `SELECT * FROM users 
       WHERE (email = $1 OR user_name = $1) 
       AND is_active = true`,
      [identifier.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.user_name,
        role: user.role,
        name: user.name 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Get current authenticated user
 */
export const getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, email, user_name, name, role, is_active,
        hourly_rate, monthly_salary, payment_method,
        bank_name, account_number, account_name,
        phone, address, date_joined,
        created_at, updated_at
       FROM users WHERE id = $1 AND is_active = true`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Change password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{6,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters long, include at least one uppercase letter and one special character' 
      });
    }

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Update user profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, address, user_name } = req.body;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, phone = $3, address = $4, user_name = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6 
       RETURNING id, email, user_name, name, role, phone, address, created_at, updated_at`,
      [name, email, phone, address, user_name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Forgot password - generate reset token (self-reset for any user)
 */
export const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body; 
    if (!identifier) {
      return res.status(400).json({ error: 'Email or username is required' });
    }

    const userResult = await pool.query(
      `SELECT id, email FROM users WHERE email = $1 OR user_name = $1`,
      [identifier.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    console.log(`📩 Password reset link for ${user.email}: ${resetLink}`);

    res.json({ message: 'Password reset link sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Admin resets password for any user (link sent to admin)
 */
export const adminResetUserPassword = async (req, res) => {
  try {
    const { userId } = req.body;
    const adminId = req.user.userId;

    // Check admin privileges
    const adminResult = await pool.query(
      'SELECT role, email FROM users WHERE id = $1 AND is_active = true',
      [adminId]
    );

    if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reset passwords for other users' });
    }

    const adminEmail = adminResult.rows[0].email;

    const userResult = await pool.query(
      'SELECT id, user_name, email FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    console.log(`📩 Admin ${adminEmail} can reset password for ${user.user_name} (${user.email}): ${resetLink}`);

    res.json({ 
      message: 'Reset link sent to admin successfully',
      resetLink: resetLink // Optional: return link in response for testing
    });
  } catch (error) {
    console.error('Admin reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Reset password using token (both admin and user)
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const tokenResult = await pool.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = tokenResult.rows[0].user_id;

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long, include at least one uppercase letter and one special character'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newPasswordHash, userId]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};