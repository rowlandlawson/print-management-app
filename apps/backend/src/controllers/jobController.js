import { pool } from '../config/database.js';
import { NotificationService } from '../services/notificationService.js';
import { broadcastToAdmins } from '../websocket/notificationServer.js';

const notificationService = new NotificationService();

export const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, worker_id, customer_id } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        j.*,
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as worker_name,
        COUNT(*) OVER() as total_count
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN users u ON j.worker_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Apply filters
    if (status) {
      paramCount++;
      query += ` AND j.status = $${paramCount}`;
      params.push(status);
    }

    if (worker_id) {
      paramCount++;
      query += ` AND j.worker_id = $${paramCount}`;
      params.push(worker_id);
    }

    if (customer_id) {
      paramCount++;
      query += ` AND j.customer_id = $${paramCount}`;
      params.push(customer_id);
    }

    // For workers, only show their own jobs
    if (req.user.role === 'worker') {
      paramCount++;
      query += ` AND j.worker_id = $${paramCount}`;
      params.push(req.user.userId);
    }

    query += ` ORDER BY j.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      jobs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const jobResult = await pool.query(`
      SELECT 
        j.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        u.name as worker_name
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN users u ON j.worker_id = u.id
      WHERE j.id = $1
    `, [id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Check if worker has access to this job
    if (req.user.role === 'worker' && job.worker_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get materials used
    const materialsResult = await pool.query(
      'SELECT * FROM materials_used WHERE job_id = $1',
      [id]
    );

    // Get waste expenses
    const wasteResult = await pool.query(
      'SELECT * FROM waste_expenses WHERE job_id = $1',
      [id]
    );

    // Get payments
    const paymentsResult = await pool.query(
      'SELECT * FROM payments WHERE job_id = $1 ORDER BY date DESC',
      [id]
    );

    res.json({
      job,
      materials: materialsResult.rows,
      waste: wasteResult.rows,
      payments: paymentsResult.rows
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createJob = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      customer_name,
      customer_phone,
      customer_email,
      description,
      total_cost,
      date_requested,
      delivery_deadline,
      mode_of_payment
    } = req.body;

    // Generate ticket ID
    const ticketId = `PRESS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Find or create customer
    let customerResult = await client.query(
      'SELECT id FROM customers WHERE phone = $1',
      [customer_phone]
    );

    let customerId;
    if (customerResult.rows.length > 0) {
      customerId = customerResult.rows[0].id;
      // Update customer last interaction
      await client.query(
        'UPDATE customers SET last_interaction_date = CURRENT_TIMESTAMP WHERE id = $1',
        [customerId]
      );
    } else {
      customerResult = await client.query(
        `INSERT INTO customers (name, phone, email) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [customer_name, customer_phone, customer_email]
      );
      customerId = customerResult.rows[0].id;
    }

    // Create job
    const jobResult = await client.query(
      `INSERT INTO jobs (
        ticket_id, customer_id, worker_id, description, total_cost, 
        date_requested, delivery_deadline, mode_of_payment, balance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        ticketId,
        customerId,
        req.user.userId,
        description,
        total_cost,
        date_requested,
        delivery_deadline,
        mode_of_payment,
        total_cost 
      ]
    );

    const job = jobResult.rows[0];

    // Update customer stats
    await client.query(
      `UPDATE customers 
       SET total_jobs_count = total_jobs_count + 1,
           total_amount_spent = total_amount_spent + $1,
           last_interaction_date = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [total_cost, customerId]
    );

    // Notify admins about new job
    await notificationService.notifyNewJob(job, req.user);
    broadcastToAdmins({
      type: 'new_notification',
      notification: {
        title: 'New Job Created',
        message: `New job ${job.ticket_id} created by ${req.user.name} for ${customer_name}`,
        type: 'new_job',
        relatedEntityId: job.id,
        createdAt: new Date()
      }
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Job created successfully',
      job
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updateJobStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status, materials, waste } = req.body;

    // Get current job status
    const currentJob = await client.query(
      'SELECT status, worker_id FROM jobs WHERE id = $1',
      [id]
    );

    if (currentJob.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check access
    if (req.user.role === 'worker' && currentJob.rows[0].worker_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const oldStatus = currentJob.rows[0].status;

    // Update job status
    await client.query(
      'UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    // Record materials used if provided
    if (materials && Array.isArray(materials)) {
      for (const material of materials) {
        await client.query(
          `INSERT INTO materials_used (job_id, material_name, paper_size, paper_type, grammage, quantity, unit_cost, total_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            material.material_name,
            material.paper_size,
            material.paper_type,
            material.grammage,
            material.quantity,
            material.unit_cost,
            material.quantity * material.unit_cost
          ]
        );

        // Update inventory if material exists
        if (material.update_inventory) {
          await client.query(
            'UPDATE inventory SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE material_name = $2',
            [material.quantity, material.material_name]
          );
        }
      }
    }

    // Record waste if provided
    if (waste && Array.isArray(waste)) {
      for (const wasteItem of waste) {
        await client.query(
          `INSERT INTO waste_expenses (job_id, type, description, quantity, unit_cost, total_cost, waste_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            wasteItem.type,
            wasteItem.description,
            wasteItem.quantity,
            wasteItem.unit_cost,
            wasteItem.total_cost,
            wasteItem.waste_reason
          ]
        );
      }
    }

    // Notify admins about status change
    if (oldStatus !== status) {
      const jobResult = await client.query(
        'SELECT ticket_id FROM jobs WHERE id = $1',
        [id]
      );
      
      const job = { 
        id, 
        ticket_id: jobResult.rows[0].ticket_id,
        status 
      };

      await notificationService.notifyStatusChange(job, oldStatus, status, req.user);
      broadcastToAdmins({
        type: 'new_notification',
        notification: {
          title: 'Job Status Updated',
          message: `Job ${job.ticket_id} status changed from ${oldStatus} to ${status} by ${req.user.name}`,
          type: 'status_change',
          relatedEntityId: id,
          createdAt: new Date()
        }
      });
    }

    await client.query('COMMIT');

    res.json({ message: 'Job status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const getJobByTicketId = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const result = await pool.query(`
      SELECT 
        j.*,
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as worker_name,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', p.id,
            'amount', p.amount,
            'date', p.date,
            'payment_type', p.payment_type
          )
        ) as payments
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN users u ON j.worker_id = u.id
      LEFT JOIN payments p ON j.id = p.job_id
      WHERE j.ticket_id = $1
      GROUP BY j.id, c.name, c.phone, u.name
    `, [ticketId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job: result.rows[0] });
  } catch (error) {
    console.error('Get job by ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      total_cost,
      delivery_deadline,
      mode_of_payment
    } = req.body;

    // Check if job exists and user has access
    const currentJob = await pool.query(
      'SELECT worker_id FROM jobs WHERE id = $1',
      [id]
    );

    if (currentJob.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (req.user.role === 'worker' && currentJob.rows[0].worker_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `UPDATE jobs 
       SET description = $1, total_cost = $2, delivery_deadline = $3, 
           mode_of_payment = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [description, total_cost, delivery_deadline, mode_of_payment, id]
    );

    res.json({
      message: 'Job updated successfully',
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};