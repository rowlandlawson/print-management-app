import { pool } from '../config/database.js';

export class MaterialMonitoringController {
  // Get material usage trends
  async getMaterialUsageTrends(req, res) {
    try {
      const { period = 'month', months = 6 } = req.query;

      const query = `
        SELECT 
          DATE_TRUNC($1, j.date_requested) as period,
          mu.material_name,
          SUM(mu.quantity) as total_quantity,
          SUM(mu.total_cost) as total_cost,
          AVG(mu.unit_cost) as average_unit_cost
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        WHERE j.date_requested >= CURRENT_DATE - INTERVAL '${months} months'
        GROUP BY period, mu.material_name
        ORDER BY period DESC, total_cost DESC
      `;

      const result = await pool.query(query, [period]);

      res.json({ material_usage_trends: result.rows });
    } catch (error) {
      console.error('Get material usage trends error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get waste analysis
  async getWasteAnalysis(req, res) {
    try {
      const { months = 3 } = req.query;

      const query = `
        SELECT 
          type,
          waste_reason,
          COUNT(*) as occurrence_count,
          SUM(total_cost) as total_cost,
          AVG(total_cost) as average_cost
        FROM waste_expenses 
        WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months'
        GROUP BY type, waste_reason
        ORDER BY total_cost DESC
      `;

      const result = await pool.query(query);

      res.json({ waste_analysis: result.rows });
    } catch (error) {
      console.error('Get waste analysis error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get stock level monitoring
  async getStockLevels(req, res) {
    try {
      const query = `
        SELECT 
          material_name,
          current_stock,
          threshold,
          unit_of_measure,
          unit_cost,
          (current_stock * unit_cost) as stock_value,
          ROUND((current_stock / threshold) * 100, 2) as stock_percentage,
          CASE 
            WHEN current_stock <= threshold THEN 'CRITICAL'
            WHEN current_stock <= threshold * 1.5 THEN 'LOW'
            ELSE 'NORMAL'
          END as stock_status
        FROM inventory 
        WHERE is_active = true 
        ORDER BY stock_percentage ASC, stock_value DESC
      `;

      const result = await pool.query(query);

      res.json({ stock_levels: result.rows });
    } catch (error) {
      console.error('Get stock levels error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get material cost analysis
  async getMaterialCostAnalysis(req, res) {
    try {
      const { months = 6 } = req.query;

      const query = `
        SELECT 
          mu.material_name,
          COUNT(DISTINCT j.id) as jobs_count,
          SUM(mu.quantity) as total_quantity,
          SUM(mu.total_cost) as total_cost,
          AVG(mu.unit_cost) as avg_unit_cost,
          MAX(mu.unit_cost) as max_unit_cost,
          MIN(mu.unit_cost) as min_unit_cost
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        WHERE j.date_requested >= CURRENT_DATE - INTERVAL '${months} months'
        GROUP BY mu.material_name
        ORDER BY total_cost DESC
      `;

      const result = await pool.query(query);

      res.json({ material_cost_analysis: result.rows });
    } catch (error) {
      console.error('Get material cost analysis error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get automatic stock updates from job materials
  async getAutomaticStockUpdates(req, res) {
    try {
      const { days = 30 } = req.query;

      const query = `
        SELECT 
          mu.material_name,
          i.current_stock as current_inventory,
          SUM(mu.quantity) as materials_used,
          i.threshold,
          (i.current_stock - SUM(mu.quantity)) as projected_stock,
          CASE 
            WHEN (i.current_stock - SUM(mu.quantity)) <= i.threshold THEN 'NEEDS_REORDER'
            WHEN (i.current_stock - SUM(mu.quantity)) <= i.threshold * 1.5 THEN 'MONITOR'
            ELSE 'HEALTHY'
          END as stock_health
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        JOIN inventory i ON mu.material_name = i.material_name
        WHERE j.date_requested >= CURRENT_DATE - INTERVAL '${days} days'
        AND j.status IN ('in_progress', 'completed')
        AND i.is_active = true
        GROUP BY mu.material_name, i.current_stock, i.threshold
        ORDER BY stock_health, projected_stock ASC
      `;

      const result = await pool.query(query);

      res.json({ automatic_updates: result.rows });
    } catch (error) {
      console.error('Get automatic stock updates error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const materialMonitoringController = new MaterialMonitoringController();