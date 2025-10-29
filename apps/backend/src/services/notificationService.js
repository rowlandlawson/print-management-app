import { pool } from '../config/database.js';
import emailService from './emailService.js';

export class NotificationService {
  // Database notification methods
  async createNotification(data) {
    // Get all admin users
    const adminUsers = await pool.query(
      'SELECT id FROM users WHERE role = $1 AND is_active = true',
      ['admin']
    );

    const notificationPromises = adminUsers.rows.map(admin => 
      pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id, priority, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          admin.id,
          data.title,
          data.message,
          data.type,
          data.relatedEntityType,
          data.relatedEntityId,
          data.priority || 'medium',
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        ]
      )
    );

    await Promise.all(notificationPromises);
  }

  async getUserNotifications(userId, options = {}) {
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
    `;
    
    const params = [userId];
    
    if (options.unreadOnly) {
      query += ' AND is_read = false';
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      query += ' LIMIT $2';
      params.push(options.limit);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  async markAsRead(notificationId, userId) {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  async markAllAsRead(userId) {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  }

  async getUnreadCount(userId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  // Business logic notification methods
  async notifyNewJob(job, worker) {
    const title = 'New Job Created';
    const message = `New job ${job.ticket_id} created by ${worker.name} for customer`;

    await this.createNotification({
      title,
      message,
      type: 'new_job',
      relatedEntityType: 'job',
      relatedEntityId: job.id,
      priority: 'medium'
    });
  }

  async notifyPaymentUpdate(payment, job, updatedBy) {
    const title = 'Payment Received';
    const message = `Payment of ₦${payment.amount.toLocaleString()} recorded for job ${job.ticket_id} by ${updatedBy.name}`;

    await this.createNotification({
      title,
      message,
      type: 'payment_update',
      relatedEntityType: 'payment',
      relatedEntityId: payment.id,
      priority: 'high'
    });

    // Also send email notification to admin
    const adminResult = await pool.query(
      'SELECT email FROM users WHERE role = $1 AND is_active = true',
      ['admin']
    );

    if (adminResult.rows.length > 0) {
      const adminEmail = adminResult.rows[0].email;
      
      // Get customer details for email
      const customerResult = await pool.query(
        `SELECT c.name, j.total_cost, j.amount_paid, j.balance 
         FROM jobs j 
         JOIN customers c ON j.customer_id = c.id 
         WHERE j.id = $1`,
        [payment.job_id]
      );

      if (customerResult.rows.length > 0) {
        const customer = customerResult.rows[0];
        await emailService.sendPaymentNotification(
          adminEmail,
          customer.name,
          job.ticket_id,
          payment.amount,
          payment.payment_type,
          customer.amount_paid,
          customer.balance
        );
      }
    }
  }

  async notifyStatusChange(job, oldStatus, newStatus, updatedBy) {
    const title = 'Job Status Updated';
    const message = `Job ${job.ticket_id} status changed from ${oldStatus} to ${newStatus} by ${updatedBy.name}`;

    await this.createNotification({
      title,
      message,
      type: 'status_change',
      relatedEntityType: 'job',
      relatedEntityId: job.id,
      priority: 'medium'
    });

    // Send email to customer if job is completed
    if (newStatus === 'completed') {
      const customerResult = await pool.query(
        `SELECT c.email, c.name, j.description, j.total_cost 
         FROM jobs j 
         JOIN customers c ON j.customer_id = c.id 
         WHERE j.id = $1`,
        [job.id]
      );

      if (customerResult.rows.length > 0 && customerResult.rows[0].email) {
        const customer = customerResult.rows[0];
        await emailService.sendJobCompletionNotification(
          customer.email,
          customer.name,
          job.ticket_id,
          customer.description,
          customer.total_cost
        );
      }
    }
  }

  async notifyLowStock(inventory) {
    const title = 'Low Stock Alert';
    const message = `${inventory.material_name} is running low. Current stock: ${inventory.current_stock} ${inventory.unit_of_measure}`;

    await this.createNotification({
      title,
      message,
      type: 'low_stock',
      relatedEntityType: 'inventory',
      relatedEntityId: inventory.id,
      priority: 'high'
    });

    // Send email alert to admin
    const adminResult = await pool.query(
      'SELECT email FROM users WHERE role = $1 AND is_active = true',
      ['admin']
    );

    if (adminResult.rows.length > 0) {
      const adminEmail = adminResult.rows[0].email;
      await emailService.sendLowStockAlert(
        adminEmail,
        inventory.material_name,
        inventory.current_stock,
        inventory.threshold,
        inventory.unit_of_measure,
        inventory.unit_cost
      );
    }
  }

  async sendMonthlyReport(month, year, financialData, jobStats) {
    const adminResult = await pool.query(
      'SELECT email FROM users WHERE role = $1 AND is_active = true',
      ['admin']
    );

    if (adminResult.rows.length > 0) {
      const adminEmail = adminResult.rows[0].email;
      
      await emailService.sendMonthlyReport(
        adminEmail,
        month,
        year,
        financialData.revenue,
        financialData.expenses,
        financialData.profit,
        jobStats
      );
    }
  }

async notifyLowStock(inventory) {
  const title = 'Low Stock Alert';
  const message = `${inventory.material_name} is running low. Current stock: ${inventory.current_stock} ${inventory.unit_of_measure}`;

  await this.createNotification({
    title,
    message,
    type: 'low_stock',
    relatedEntityType: 'inventory',
    relatedEntityId: inventory.id,
    priority: 'high'
  });
}
}

// Export a default instance
export default new NotificationService();