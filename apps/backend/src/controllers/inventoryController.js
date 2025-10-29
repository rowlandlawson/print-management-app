import { pool } from '../config/database.js';
import { NotificationService } from '../services/notificationService.js';
import { broadcastToAdmins } from '../websocket/notificationServer.js';

const notificationService = new NotificationService();

export class InventoryController {
  // Get all inventory items
  async getInventory(req, res) {
    try {
      const { page = 1, limit = 50, category, low_stock } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          *,
          COUNT(*) OVER() as total_count
        FROM inventory 
        WHERE is_active = true
      `;
      const params = [];
      let paramCount = 0;

      if (category) {
        paramCount++;
        query += ` AND category = $${paramCount}`;
        params.push(category);
      }

      if (low_stock === 'true') {
        paramCount++;
        query += ` AND current_stock <= threshold`;
      }

      query += ` ORDER BY material_name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      res.json({
        inventory: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.rows[0]?.total_count || 0
        }
      });
    } catch (error) {
      console.error('Get inventory error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create inventory item
  async createInventory(req, res) {
    try {
      const {
        material_name,
        category,
        paper_size,
        paper_type,
        grammage,
        supplier,
        current_stock,
        unit_of_measure,
        unit_cost,
        selling_price,
        threshold,
        reorder_quantity
      } = req.body;

      const result = await pool.query(
        `INSERT INTO inventory (
          material_name, category, paper_size, paper_type, grammage, supplier,
          current_stock, unit_of_measure, unit_cost, selling_price, threshold, reorder_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          material_name,
          category,
          paper_size,
          paper_type,
          grammage,
          supplier,
          current_stock,
          unit_of_measure,
          unit_cost,
          selling_price,
          threshold,
          reorder_quantity
        ]
      );

      res.status(201).json({
        message: 'Inventory item created successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Create inventory error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update inventory item
  async updateInventory(req, res) {
    try {
      const { id } = req.params;
      const {
        material_name,
        category,
        paper_size,
        paper_type,
        grammage,
        supplier,
        current_stock,
        unit_of_measure,
        unit_cost,
        selling_price,
        threshold,
        reorder_quantity,
        is_active
      } = req.body;

      const result = await pool.query(
        `UPDATE inventory 
         SET material_name = $1, category = $2, paper_size = $3, paper_type = $4, 
             grammage = $5, supplier = $6, current_stock = $7, unit_of_measure = $8,
             unit_cost = $9, selling_price = $10, threshold = $11, reorder_quantity = $12,
             is_active = $13, updated_at = CURRENT_TIMESTAMP
         WHERE id = $14
         RETURNING *`,
        [
          material_name,
          category,
          paper_size,
          paper_type,
          grammage,
          supplier,
          current_stock,
          unit_of_measure,
          unit_cost,
          selling_price,
          threshold,
          reorder_quantity,
          is_active,
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const updatedItem = result.rows[0];

      // Check for low stock and notify
      if (updatedItem.current_stock <= updatedItem.threshold) {
        await notificationService.notifyLowStock(updatedItem);
        broadcastToAdmins({
          type: 'new_notification',
          notification: {
            title: 'Low Stock Alert',
            message: `${updatedItem.material_name} is running low. Current stock: ${updatedItem.current_stock} ${updatedItem.unit_of_measure}`,
            type: 'low_stock',
            relatedEntityId: updatedItem.id,
            createdAt: new Date()
          }
        });
      }

      res.json({
        message: 'Inventory item updated successfully',
        item: updatedItem
      });
    } catch (error) {
      console.error('Update inventory error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete inventory item (soft delete)
  async deleteInventory(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'UPDATE inventory SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      res.json({ message: 'Inventory item deleted successfully' });
    } catch (error) {
      console.error('Delete inventory error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get low stock alerts
  async getLowStockAlerts(req, res) {
    try {
      const result = await pool.query(
        `SELECT * FROM inventory 
         WHERE is_active = true AND current_stock <= threshold 
         ORDER BY current_stock ASC`
      );

      res.json({ low_stock_items: result.rows });
    } catch (error) {
      console.error('Get low stock error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get inventory categories
  async getCategories(req, res) {
    try {
      const result = await pool.query(
        'SELECT DISTINCT category FROM inventory WHERE is_active = true ORDER BY category'
      );

      const categories = result.rows.map(row => row.category);
      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const inventoryController = new InventoryController();