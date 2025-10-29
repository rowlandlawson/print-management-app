import { pool } from '../config/database.js';

export class OperationalExpensesController {
  // Get all operational expenses
  async getOperationalExpenses(req, res) {
    try {
      const { page = 1, limit = 20, category, month, year } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          oe.*,
          u.name as recorded_by_name,
          COUNT(*) OVER() as total_count
        FROM operational_expenses oe
        LEFT JOIN users u ON oe.recorded_by = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;

      if (category) {
        paramCount++;
        query += ` AND oe.category = $${paramCount}`;
        params.push(category);
      }

      if (month && year) {
        paramCount++;
        query += ` AND EXTRACT(MONTH FROM oe.expense_date) = $${paramCount}`;
        params.push(month);
        paramCount++;
        query += ` AND EXTRACT(YEAR FROM oe.expense_date) = $${paramCount}`;
        params.push(year);
      }

      query += ` ORDER BY oe.expense_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        expenses: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rows[0]?.total_count || 0
        }
      });
    } catch (error) {
      console.error('Get operational expenses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create operational expense
  async createOperationalExpense(req, res) {
    try {
      const {
        description,
        category,
        amount,
        expense_date,
        receipt_number,
        notes
      } = req.body;

      const result = await pool.query(
        `INSERT INTO operational_expenses (description, category, amount, expense_date, receipt_number, notes, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [description, category, amount, expense_date, receipt_number, notes, req.user.userId]
      );

      res.status(201).json({
        message: 'Operational expense recorded successfully',
        expense: result.rows[0]
      });
    } catch (error) {
      console.error('Create operational expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update operational expense
  async updateOperationalExpense(req, res) {
    try {
      const { id } = req.params;
      const {
        description,
        category,
        amount,
        expense_date,
        receipt_number,
        notes
      } = req.body;

      const result = await pool.query(
        `UPDATE operational_expenses 
         SET description = $1, category = $2, amount = $3, expense_date = $4, 
             receipt_number = $5, notes = $6
         WHERE id = $7
         RETURNING *`,
        [description, category, amount, expense_date, receipt_number, notes, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Operational expense not found' });
      }

      res.json({
        message: 'Operational expense updated successfully',
        expense: result.rows[0]
      });
    } catch (error) {
      console.error('Update operational expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete operational expense
  async deleteOperationalExpense(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM operational_expenses WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Operational expense not found' });
      }

      res.json({ message: 'Operational expense deleted successfully' });
    } catch (error) {
      console.error('Delete operational expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get expense categories
  async getExpenseCategories(req, res) {
    try {
      const result = await pool.query(
        'SELECT DISTINCT category FROM operational_expenses ORDER BY category'
      );

      const categories = result.rows.map(row => row.category);
      res.json({ categories });
    } catch (error) {
      console.error('Get expense categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get monthly expense summary
  async getMonthlyExpenseSummary(req, res) {
    try {
      const { year } = req.query;
      const targetYear = year || new Date().getFullYear();

      const query = `
        SELECT 
          EXTRACT(MONTH FROM expense_date) as month,
          category,
          SUM(amount) as total_amount,
          COUNT(*) as expense_count
        FROM operational_expenses 
        WHERE EXTRACT(YEAR FROM expense_date) = $1
        GROUP BY EXTRACT(MONTH FROM expense_date), category
        ORDER BY month, total_amount DESC
      `;

      const result = await pool.query(query, [targetYear]);

      res.json({ monthly_summary: result.rows, year: targetYear });
    } catch (error) {
      console.error('Monthly expense summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const operationalExpensesController = new OperationalExpensesController();