import { pool } from '../config/database.js';

export class CustomerController {
  // Get all customers
  async getCustomers(req, res) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          c.*,
          COUNT(*) OVER() as total_count
        FROM customers c
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        query += ` AND (c.name ILIKE $${paramCount} OR c.phone ILIKE $${paramCount} OR c.email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY c.last_interaction_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        customers: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rows[0]?.total_count || 0
        }
      });
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get customer details with job history
  async getCustomer(req, res) {
    try {
      const { id } = req.params;

      // Get customer details
      const customerResult = await pool.query(
        'SELECT * FROM customers WHERE id = $1',
        [id]
      );

      if (customerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Get customer job history
      const jobsResult = await pool.query(
        `SELECT 
          j.id, j.ticket_id, j.description, j.status, 
          j.total_cost, j.amount_paid, j.balance,
          j.created_at, j.date_requested
         FROM jobs j
         WHERE j.customer_id = $1
         ORDER BY j.created_at DESC`,
        [id]
      );

      res.json({
        customer: customerResult.rows[0],
        jobs: jobsResult.rows
      });
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search customers
  async searchCustomers(req, res) {
    try {
      const { query } = req.params;

      const result = await pool.query(
        `SELECT id, name, phone, email, total_jobs_count, total_amount_spent
         FROM customers 
         WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
         ORDER BY last_interaction_date DESC
         LIMIT 10`,
        [`%${query}%`]
      );

      res.json({ customers: result.rows });
    } catch (error) {
      console.error('Search customers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update customer information
  async updateCustomer(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, email } = req.body;

      const result = await pool.query(
        `UPDATE customers 
         SET name = $1, phone = $2, email = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [name, phone, email, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json({
        message: 'Customer updated successfully',
        customer: result.rows[0]
      });
    } catch (error) {
      console.error('Update customer error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get customer statistics
  async getCustomerStats(req, res) {
    try {
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN total_jobs_count > 0 THEN 1 END) as active_customers,
          COUNT(CASE WHEN total_jobs_count > 5 THEN 1 END) as repeat_customers,
          AVG(total_jobs_count) as avg_jobs_per_customer,
          AVG(total_amount_spent) as avg_spent_per_customer,
          MAX(total_amount_spent) as highest_spending
        FROM customers
      `);

      // Get top customers
      const topCustomersResult = await pool.query(`
        SELECT name, total_jobs_count, total_amount_spent
        FROM customers 
        ORDER BY total_amount_spent DESC 
        LIMIT 5
      `);

      res.json({
        stats: statsResult.rows[0],
        top_customers: topCustomersResult.rows
      });
    } catch (error) {
      console.error('Get customer stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const customerController = new CustomerController();