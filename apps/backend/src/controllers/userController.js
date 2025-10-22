import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import emailService from '../services/emailService.js';

export const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, email, name, user_name, role, is_active,
        hourly_rate, monthly_salary, payment_method,
        bank_name, account_number, account_name,
        phone, address, date_joined,
        created_at, updated_at
       FROM users 
       ORDER BY created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      email,
      name,
      userName,
      phone,
      address,
      dateJoined,
      role = 'worker',
      // Worker payment info
      hourlyRate,
      monthlySalary,
      paymentMethod,
      bankName,
      accountNumber,
      accountName
    } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate temporary password
    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Create user
    const result = await client.query(
      `INSERT INTO users (
        email, name, user_name, password_hash, role,
        phone, address, date_joined,
        hourly_rate, monthly_salary, payment_method,
        bank_name, account_number, account_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id, email, name, user_name, role, is_active,
        hourly_rate, monthly_salary, payment_method,
        bank_name, account_number, account_name,
        phone, address, date_joined,
        created_at`,
      [
        email.toLowerCase(),
        name,
        userName,
        hashedPassword,
        role,
        phone,
        address,
        dateJoined,
        hourlyRate,
        monthlySalary,
        paymentMethod,
        bankName,
        accountNumber,
        accountName
      ]
    );

    const newUser = result.rows[0];

    // Send email to admin with account details
    await emailService.sendWorkerAccountCreated(
      req.user.email, // Admin's email
      newUser.email,
      newUser.name,
      temporaryPassword
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'User created successfully. Account details sent to admin email.',
      user: newUser
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      userName,
      phone,
      address,
      dateJoined,
      role,
      isActive,
      // Worker payment info
      hourlyRate,
      monthlySalary,
      paymentMethod,
      bankName,
      accountNumber,
      accountName
    } = req.body;

    // Prevent modifying the only admin account
    if (role && role !== 'admin') {
      const adminCheck = await pool.query(
        'SELECT COUNT(*) as admin_count FROM users WHERE role = $1 AND id != $2 AND is_active = true',
        ['admin', id]
      );
      
      if (parseInt(adminCheck.rows[0].admin_count) === 0) {
        return res.status(400).json({ error: 'Cannot remove the only active admin' });
      }
    }

    const result = await pool.query(
      `UPDATE users 
       SET 
         name = $1, user_name = $2, phone = $3, address = $4,
         date_joined = $5, role = $6, is_active = $7,
         hourly_rate = $8, monthly_salary = $9, payment_method = $10,
         bank_name = $11, account_number = $12, account_name = $13,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING 
         id, email, name, user_name, role, is_active,
         hourly_rate, monthly_salary, payment_method,
         bank_name, account_number, account_name,
         phone, address, date_joined,
         created_at, updated_at`,
      [
        name,
        userName,
        phone,
        address,
        dateJoined,
        role,
        isActive,
        hourlyRate,
        monthlySalary,
        paymentMethod,
        bankName,
        accountNumber,
        accountName,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if this is the only admin
    const userToDelete = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [id]
    );

    if (userToDelete.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToDelete.rows[0].role === 'admin') {
      const adminCount = await pool.query(
        'SELECT COUNT(*) as admin_count FROM users WHERE role = $1 AND is_active = true',
        ['admin']
      );
      
      if (parseInt(adminCount.rows[0].admin_count) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only active admin' });
      }
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        id, email, name, user_name, role, is_active,
        hourly_rate, monthly_salary, payment_method,
        bank_name, account_number, account_name,
        phone, address, date_joined,
        created_at, updated_at
       FROM users 
       WHERE id = $1`,
      [id]
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

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, id]
    );

    // Send confirmation email to admin
    await emailService.sendPasswordResetConfirmation(req.user.email, user.name);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};