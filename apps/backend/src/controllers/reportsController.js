import { pool } from '../config/database.js';

export class ReportsController {
  // Get automatic monthly financial summary
  async getMonthlyFinancialSummary(req, res) {
    try {
      const { year, month } = req.query;
      const currentDate = new Date();
      const targetYear = year || currentDate.getFullYear();
      const targetMonth = month || currentDate.getMonth() + 1;

      // Calculate date range for the month
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Total revenue from completed jobs
      const revenueQuery = `
        SELECT COALESCE(SUM(total_cost), 0) as total_revenue
        FROM jobs 
        WHERE status = 'completed' 
        AND date_requested BETWEEN $1 AND $2
      `;

      // Total material costs
      const materialCostsQuery = `
        SELECT COALESCE(SUM(mu.total_cost), 0) as material_costs
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        WHERE j.status = 'completed'
        AND j.date_requested BETWEEN $1 AND $2
      `;

      // Total waste costs
      const wasteCostsQuery = `
        SELECT COALESCE(SUM(total_cost), 0) as waste_costs
        FROM waste_expenses 
        WHERE created_at BETWEEN $1 AND $2
      `;

      // Operational costs
      const operationalCostsQuery = `
        SELECT COALESCE(SUM(amount), 0) as operational_costs
        FROM operational_expenses 
        WHERE expense_date BETWEEN $1 AND $2
      `;

      // Labor costs (from worker salaries)
      const laborCostsQuery = `
        SELECT COALESCE(SUM(
          CASE 
            WHEN u.hourly_rate IS NOT NULL THEN u.hourly_rate * 160 -- Approx monthly hours
            WHEN u.monthly_salary IS NOT NULL THEN u.monthly_salary
            ELSE 0 
          END
        ), 0) as labor_costs
        FROM users u
        WHERE u.role = 'worker' 
        AND u.is_active = true
      `;

      const params = [startDateStr, endDateStr];

      const [
        revenueResult,
        materialResult,
        wasteResult,
        operationalResult,
        laborResult
      ] = await Promise.all([
        pool.query(revenueQuery, params),
        pool.query(materialCostsQuery, params),
        pool.query(wasteCostsQuery, params),
        pool.query(operationalCostsQuery, params),
        pool.query(laborCostsQuery)
      ]);

      const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);
      const totalMaterialCosts = parseFloat(materialResult.rows[0].material_costs);
      const totalWasteCosts = parseFloat(wasteResult.rows[0].waste_costs);
      const totalOperationalCosts = parseFloat(operationalResult.rows[0].operational_costs);
      const totalLaborCosts = parseFloat(laborResult.rows[0].labor_costs);

      // Calculate profits
      const grossProfit = totalRevenue - totalMaterialCosts;
      const totalExpenses = totalWasteCosts + totalOperationalCosts + totalLaborCosts;
      const netProfit = grossProfit - totalExpenses;

      // Get job statistics
      const jobStatsQuery = `
        SELECT 
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_jobs,
          COUNT(CASE WHEN payment_status = 'fully_paid' THEN 1 END) as fully_paid_jobs,
          COALESCE(AVG(total_cost), 0) as average_job_value,
          COALESCE(MAX(total_cost), 0) as highest_job_value
        FROM jobs
        WHERE date_requested BETWEEN $1 AND $2
      `;

      const jobStatsResult = await pool.query(jobStatsQuery, params);

      // Get top performing materials
      const topMaterialsQuery = `
        SELECT 
          mu.material_name,
          SUM(mu.quantity) as total_quantity,
          SUM(mu.total_cost) as total_cost,
          COUNT(DISTINCT j.id) as jobs_count
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        WHERE j.date_requested BETWEEN $1 AND $2
        GROUP BY mu.material_name
        ORDER BY total_cost DESC
        LIMIT 10
      `;

      const topMaterialsResult = await pool.query(topMaterialsQuery, params);

      res.json({
        period: {
          month: targetMonth,
          year: targetYear,
          start_date: startDateStr,
          end_date: endDateStr,
          month_name: startDate.toLocaleString('default', { month: 'long' })
        },
        revenue: {
          total_revenue: totalRevenue,
          total_material_costs: totalMaterialCosts,
          gross_profit: grossProfit,
          gross_profit_margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
        },
        expenses: {
          material_costs: totalMaterialCosts,
          waste_costs: totalWasteCosts,
          operational_costs: totalOperationalCosts,
          labor_costs: totalLaborCosts,
          total_expenses: totalExpenses
        },
        profit: {
          net_profit: netProfit,
          profit_margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
          is_profitable: netProfit > 0
        },
        job_stats: jobStatsResult.rows[0],
        top_materials: topMaterialsResult.rows,
        efficiency_metrics: {
          material_efficiency: totalMaterialCosts > 0 ? (totalRevenue / totalMaterialCosts) : 0,
          waste_percentage: totalMaterialCosts > 0 ? (totalWasteCosts / totalMaterialCosts) * 100 : 0
        }
      });
    } catch (error) {
      console.error('Monthly financial summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get profit/loss statement for custom date range
  async getProfitLossStatement(req, res) {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      // Revenue breakdown by job
      const revenueBreakdownQuery = `
        SELECT 
          j.ticket_id,
          j.description,
          j.total_cost as revenue,
          c.name as customer_name,
          j.date_requested,
          j.status
        FROM jobs j
        LEFT JOIN customers c ON j.customer_id = c.id
        WHERE j.date_requested BETWEEN $1 AND $2
        AND j.status = 'completed'
        ORDER BY j.total_cost DESC
      `;

      // Expense breakdown
      const expenseBreakdownQuery = `
        SELECT 
          'Materials' as category,
          material_name as description,
          total_cost as amount,
          created_at as date
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        WHERE j.date_requested BETWEEN $1 AND $2
        
        UNION ALL
        
        SELECT 
          'Waste' as category,
          type || ' - ' || description as description,
          total_cost as amount,
          created_at as date
        FROM waste_expenses 
        WHERE created_at BETWEEN $1 AND $2
        
        UNION ALL
        
        SELECT 
          'Operational' as category,
          category || ' - ' || description as description,
          amount,
          expense_date as date
        FROM operational_expenses 
        WHERE expense_date BETWEEN $1 AND $2
        
        ORDER BY amount DESC
      `;

      const [revenueBreakdown, expenseBreakdown] = await Promise.all([
        pool.query(revenueBreakdownQuery, [start_date, end_date]),
        pool.query(expenseBreakdownQuery, [start_date, end_date])
      ]);

      // Calculate totals
      const totalRevenue = revenueBreakdown.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0);
      const totalExpenses = expenseBreakdown.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
      const netProfit = totalRevenue - totalExpenses;

      res.json({
        period: { start_date, end_date },
        summary: {
          total_revenue: totalRevenue,
          total_expenses: totalExpenses,
          net_profit: netProfit,
          profit_margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
        },
        revenue_breakdown: revenueBreakdown.rows,
        expense_breakdown: expenseBreakdown.rows
      });
    } catch (error) {
      console.error('Profit loss statement error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get material monitoring dashboard
  async getMaterialMonitoringDashboard(req, res) {
    try {
      const { months = 6 } = req.query;

      // Material usage trends
      const usageTrendsQuery = `
        SELECT 
          DATE_TRUNC('month', j.date_requested) as period,
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

      // Waste analysis
      const wasteAnalysisQuery = `
        SELECT 
          type,
          waste_reason,
          COUNT(*) as occurrence_count,
          SUM(total_cost) as total_cost,
          AVG(total_cost) as average_cost,
          (SUM(total_cost) / (SELECT COALESCE(SUM(total_cost), 1) FROM waste_expenses 
           WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months')) * 100 as percentage_of_total
        FROM waste_expenses 
        WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months'
        GROUP BY type, waste_reason
        ORDER BY total_cost DESC
      `;

      // Stock level analysis
      const stockAnalysisQuery = `
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
            ELSE 'HEALTHY'
          END as stock_status
        FROM inventory 
        WHERE is_active = true 
        ORDER BY stock_percentage ASC, stock_value DESC
      `;

      // Material cost efficiency
      const costEfficiencyQuery = `
        SELECT 
          mu.material_name,
          COUNT(DISTINCT j.id) as jobs_count,
          SUM(mu.quantity) as total_quantity,
          SUM(mu.total_cost) as total_cost,
          AVG(mu.unit_cost) as avg_unit_cost,
          (SUM(j.total_cost) - SUM(mu.total_cost)) as generated_profit,
          CASE 
            WHEN SUM(mu.total_cost) > 0 
            THEN ((SUM(j.total_cost) - SUM(mu.total_cost)) / SUM(mu.total_cost)) * 100 
            ELSE 0 
          END as return_on_material
        FROM materials_used mu
        JOIN jobs j ON mu.job_id = j.id
        WHERE j.date_requested >= CURRENT_DATE - INTERVAL '${months} months'
        AND j.status = 'completed'
        GROUP BY mu.material_name
        ORDER BY return_on_material DESC
      `;

      const [
        usageTrendsResult,
        wasteAnalysisResult,
        stockAnalysisResult,
        costEfficiencyResult
      ] = await Promise.all([
        pool.query(usageTrendsQuery),
        pool.query(wasteAnalysisQuery),
        pool.query(stockAnalysisQuery),
        pool.query(costEfficiencyQuery)
      ]);

      res.json({
        monitoring_period: `${months} months`,
        material_usage_trends: usageTrendsResult.rows,
        waste_analysis: wasteAnalysisResult.rows,
        stock_levels: stockAnalysisResult.rows,
        cost_efficiency: costEfficiencyResult.rows,
        summary: {
          total_materials_tracked: usageTrendsResult.rows.length,
          critical_stock_items: stockAnalysisResult.rows.filter(item => item.stock_status === 'CRITICAL').length,
          total_waste_cost: wasteAnalysisResult.rows.reduce((sum, item) => sum + parseFloat(item.total_cost), 0),
          average_material_return: costEfficiencyResult.rows.length > 0 ? 
            costEfficiencyResult.rows.reduce((sum, item) => sum + parseFloat(item.return_on_material), 0) / costEfficiencyResult.rows.length : 0
        }
      });
    } catch (error) {
      console.error('Material monitoring dashboard error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get business performance overview
  async getBusinessPerformance(req, res) {
    try {
      const { period = 'month' } = req.query;

      // Revenue trends
      const revenueTrendsQuery = `
        SELECT 
          DATE_TRUNC($1, date_requested) as period,
          COUNT(*) as job_count,
          COALESCE(SUM(total_cost), 0) as total_revenue,
          COALESCE(SUM(amount_paid), 0) as collected_revenue,
          COALESCE(AVG(total_cost), 0) as average_job_value
        FROM jobs
        WHERE date_requested >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY period
        ORDER BY period DESC
      `;

      // Customer acquisition trends
      const customerTrendsQuery = `
        SELECT 
          DATE_TRUNC($1, first_interaction_date) as period,
          COUNT(*) as new_customers,
          COUNT(CASE WHEN total_jobs_count > 1 THEN 1 END) as repeat_customers
        FROM customers
        WHERE first_interaction_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY period
        ORDER BY period DESC
      `;

      // Efficiency metrics
      const efficiencyMetricsQuery = `
        SELECT 
          DATE_TRUNC($1, j.date_requested) as period,
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
          AVG(EXTRACT(EPOCH FROM (j.updated_at - j.created_at)) / 3600) as avg_completion_hours,
          (COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::FLOAT / COUNT(*) * 100) as completion_rate
        FROM jobs j
        WHERE j.date_requested >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY period
        ORDER BY period DESC
      `;

      const [
        revenueTrendsResult,
        customerTrendsResult,
        efficiencyMetricsResult
      ] = await Promise.all([
        pool.query(revenueTrendsQuery, [period]),
        pool.query(customerTrendsQuery, [period]),
        pool.query(efficiencyMetricsQuery, [period])
      ]);

      res.json({
        period,
        revenue_trends: revenueTrendsResult.rows,
        customer_trends: customerTrendsResult.rows,
        efficiency_metrics: efficiencyMetricsResult.rows,
        performance_indicators: {
          total_periods: revenueTrendsResult.rows.length,
          average_revenue: revenueTrendsResult.rows.length > 0 ? 
            revenueTrendsResult.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0) / revenueTrendsResult.rows.length : 0,
          customer_growth_rate: customerTrendsResult.rows.length > 1 ? 
            ((customerTrendsResult.rows[0].new_customers - customerTrendsResult.rows[1].new_customers) / customerTrendsResult.rows[1].new_customers) * 100 : 0
        }
      });
    } catch (error) {
      console.error('Business performance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Export report data
  async exportReportData(req, res) {
    try {
      const { report_type, start_date, end_date } = req.query;

      let query;
      let filename;

      switch (report_type) {
        case 'financial_summary':
          query = `
            SELECT 
              j.ticket_id,
              j.description,
              j.total_cost as revenue,
              j.amount_paid as collected,
              j.balance as outstanding,
              j.status,
              j.payment_status,
              c.name as customer_name,
              j.date_requested,
              j.created_at
            FROM jobs j
            LEFT JOIN customers c ON j.customer_id = c.id
            WHERE j.date_requested BETWEEN $1 AND $2
            ORDER BY j.date_requested DESC
          `;
          filename = `financial_summary_${start_date}_to_${end_date}.csv`;
          break;

        case 'material_usage':
          query = `
            SELECT 
              mu.material_name,
              mu.paper_size,
              mu.paper_type,
              mu.grammage,
              mu.quantity,
              mu.unit_cost,
              mu.total_cost,
              j.ticket_id,
              j.description as job_description,
              j.date_requested
            FROM materials_used mu
            JOIN jobs j ON mu.job_id = j.id
            WHERE j.date_requested BETWEEN $1 AND $2
            ORDER BY mu.total_cost DESC
          `;
          filename = `material_usage_${start_date}_to_${end_date}.csv`;
          break;

        case 'expenses':
          query = `
            SELECT 
              'Materials' as category,
              mu.material_name as description,
              mu.total_cost as amount,
              mu.created_at as date
            FROM materials_used mu
            JOIN jobs j ON mu.job_id = j.id
            WHERE j.date_requested BETWEEN $1 AND $2
            
            UNION ALL
            
            SELECT 
              'Waste' as category,
              type || ' - ' || description as description,
              total_cost as amount,
              created_at as date
            FROM waste_expenses 
            WHERE created_at BETWEEN $1 AND $2
            
            UNION ALL
            
            SELECT 
              'Operational' as category,
              category || ' - ' || description as description,
              amount,
              expense_date as date
            FROM operational_expenses 
            WHERE expense_date BETWEEN $1 AND $2
            
            ORDER BY amount DESC
          `;
          filename = `expenses_${start_date}_to_${end_date}.csv`;
          break;

        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      const result = await pool.query(query, [start_date, end_date]);

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Convert to CSV
      if (result.rows.length > 0) {
        const headers = Object.keys(result.rows[0]).join(',');
        const rows = result.rows.map(row => 
          Object.values(row).map(field => 
            `"${String(field || '').replace(/"/g, '""')}"`
          ).join(',')
        );
        
        const csv = [headers, ...rows].join('\n');
        res.send(csv);
      } else {
        res.send('No data available for the selected period');
      }
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const reportsController = new ReportsController();