import { pool } from '../config/database.js';
import notificationService from '../services/notificationService.js';
import { broadcastToAdmins } from '../websocket/notificationServer.js';
import receiptService from '../services/receiptService.js';

export const recordPayment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      job_id,
      amount,
      payment_type,
      payment_method,
      notes
    } = req.body;

    if (!job_id || !amount || !payment_type || !payment_method) {
      return res.status(400).json({ 
        error: 'Job ID, amount, payment type, and payment method are required' 
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Check if job exists and get current payment status
    const jobResult = await client.query(
      `SELECT j.*, c.name as customer_name 
       FROM jobs j 
       LEFT JOIN customers c ON j.customer_id = c.id 
       WHERE j.id = $1`,
      [job_id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Create payment
    const paymentResult = await client.query(
      `INSERT INTO payments (job_id, amount, payment_type, payment_method, receipt_number, notes, recorded_by, recorded_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        job_id,
        amount,
        payment_type,
        payment_method,
        receiptNumber,
        notes,
        req.user.name,
        req.user.userId
      ]
    );

    const payment = paymentResult.rows[0];

    // Update job payment status
    const newAmountPaid = parseFloat(job.amount_paid) + parseFloat(amount);
    const newBalance = parseFloat(job.total_cost) - newAmountPaid;

    let paymentStatus = 'partially_paid';
    if (newBalance <= 0) {
      paymentStatus = 'fully_paid';
    } else if (newAmountPaid === 0) {
      paymentStatus = 'pending';
    }

    await client.query(
      'UPDATE jobs SET amount_paid = $1, balance = $2, payment_status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [newAmountPaid, newBalance, paymentStatus, job_id]
    );

    // Update customer total spent
    await client.query(
      `UPDATE customers 
       SET total_amount_spent = total_amount_spent + $1,
           last_interaction_date = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [amount, job.customer_id]
    );

    // Notify admins
    await notificationService.notifyPaymentUpdate(payment, job, req.user);
    broadcastToAdmins({
      type: 'new_notification',
      notification: {
        title: 'Payment Received',
        message: `Payment of ₦${amount.toLocaleString()} recorded for job ${job.ticket_id} by ${req.user.name}`,
        type: 'payment_update',
        relatedEntityId: payment.id,
        createdAt: new Date()
      }
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: `Payment of ₦${amount.toLocaleString()} recorded successfully`,
      payment: {
        ...payment,
        receipt_number: receiptNumber
      },
      job_update: {
        amount_paid: newAmountPaid,
        balance: newBalance,
        payment_status: paymentStatus
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const getPaymentsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const result = await pool.query(
      `SELECT p.*, u.name as recorded_by_name 
       FROM payments p
       LEFT JOIN users u ON p.recorded_by_id = u.id
       WHERE p.job_id = $1 
       ORDER BY p.date DESC`,
      [jobId]
    );

    res.json({ payments: result.rows });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, start_date, end_date, payment_method } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.*,
        j.ticket_id,
        c.name as customer_name,
        u.name as recorded_by_name,
        COUNT(*) OVER() as total_count
      FROM payments p
      LEFT JOIN jobs j ON p.job_id = j.id
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN users u ON p.recorded_by_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Apply filters
    if (start_date && end_date) {
      paramCount++;
      query += ` AND p.date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount++;
    }

    if (payment_method) {
      paramCount++;
      query += ` AND p.payment_method = $${paramCount}`;
      params.push(payment_method);
    }

    query += ` ORDER BY p.date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      payments: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows[0]?.total_count || 0
      }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReceiptData = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const result = await pool.query(`
      SELECT 
        p.*,
        j.ticket_id,
        j.total_cost,
        j.amount_paid,
        j.balance,
        j.description as job_description,
        j.date_requested,
        j.delivery_deadline,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        u.name as recorded_by_name,
        business.name as business_name,
        business.phone as business_phone,
        business.address as business_address
      FROM payments p
      LEFT JOIN jobs j ON p.job_id = j.id
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN users u ON p.recorded_by_id = u.id
      LEFT JOIN users business ON business.role = 'admin'
      WHERE p.id = $1
      LIMIT 1
    `, [paymentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const receipt = result.rows[0];

    // Get all payments for this job to show payment history
    const paymentHistory = await pool.query(
      `SELECT 
        amount, 
        payment_type, 
        date, 
        payment_method, 
        receipt_number,
        notes
       FROM payments 
       WHERE job_id = (SELECT job_id FROM payments WHERE id = $1)
       ORDER BY date ASC`,
      [paymentId]
    );

    const receiptData = {
      receipt: {
        receipt_number: receipt.receipt_number,
        date: receipt.date,
        business: {
          name: receipt.business_name || 'PrintPress Suite',
          phone: receipt.business_phone || '+234 123 456 7890',
          address: receipt.business_address || '123 Printing Street, Your City'
        },
        customer: {
          name: receipt.customer_name,
          phone: receipt.customer_phone,
          email: receipt.customer_email
        },
        job: {
          ticket_id: receipt.ticket_id,
          description: receipt.job_description,
          date_requested: receipt.date_requested,
          delivery_deadline: receipt.delivery_deadline,
          total_cost: receipt.total_cost
        },
        payment: {
          amount: receipt.amount,
          amount_paid: receipt.amount_paid,
          balance: receipt.balance,
          method: receipt.payment_method,
          type: receipt.payment_type,
          recorded_by: receipt.recorded_by_name,
          notes: receipt.notes
        },
        payment_history: paymentHistory.rows
      }
    };

    res.json(receiptData);
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPaymentStats = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let groupBy;
    switch (period) {
      case 'daily':
        groupBy = 'DATE(p.date)';
        break;
      case 'weekly':
        groupBy = 'EXTRACT(YEAR FROM p.date), EXTRACT(WEEK FROM p.date)';
        break;
      case 'monthly':
      default:
        groupBy = 'EXTRACT(YEAR FROM p.date), EXTRACT(MONTH FROM p.date)';
        break;
    }

    const query = `
      SELECT 
        ${groupBy} as period,
        COUNT(*) as payment_count,
        SUM(p.amount) as total_amount,
        AVG(p.amount) as average_payment,
        COUNT(DISTINCT p.job_id) as unique_jobs,
        COUNT(DISTINCT j.customer_id) as unique_customers
      FROM payments p
      LEFT JOIN jobs j ON p.job_id = j.id
      WHERE p.date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY ${groupBy}
      ORDER BY period DESC
      LIMIT 12
    `;

    const result = await pool.query(query);

    // Get payment method distribution
    const methodDistribution = await pool.query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payments 
      WHERE date >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `);

    res.json({
      payment_stats: result.rows,
      method_distribution: methodDistribution.rows,
      period: period
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadReceiptPDF = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const pdfBuffer = await receiptService.generatePDFReceipt(paymentId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${paymentId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download receipt PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};