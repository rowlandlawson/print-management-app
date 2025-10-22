import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail(to, subject, html) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
      });

      if (error) {
        console.error('❌ Resend error:', error);
        return false;
      }

      console.log('✅ Email sent successfully:', data.id);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }

  async sendWorkerAccountCreated(adminEmail, workerEmail, workerName, temporaryPassword) {
    const subject = 'New Worker Account Created - PrintPress Suite';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2563eb; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .password { background: #fef3c7; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🆕 New Worker Account</h1>
        </div>
        <div class="content">
          <p>Hello Admin,</p>
          <p>You have successfully created a new worker account in <strong>PrintPress Suite</strong>.</p>
          
          <div class="details">
            <h3 style="margin: 0 0 12px 0; color: #2563eb;">Account Details</h3>
            <p style="margin: 8px 0;"><strong>👤 Worker Name:</strong> ${workerName}</p>
            <p style="margin: 8px 0;"><strong>📧 Email:</strong> ${workerEmail}</p>
            <p style="margin: 8px 0;"><strong>🔑 Temporary Password:</strong> <span class="password">${temporaryPassword}</span></p>
          </div>

          <p><strong>⚠️ Important:</strong> The worker should change their password after first login for security.</p>
          
          <div class="footer">
            <p>This is an automated message from PrintPress Suite.</p>
            <p>If you didn't create this account, please contact support immediately.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  async sendPasswordResetRequest(adminEmail, userName, resetToken) {
    const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    const subject = 'Password Reset Request - PrintPress Suite';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .reset-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #dc2626; }
          .reset-link { background: #fef2f2; padding: 12px; border-radius: 4px; word-break: break-all; font-family: monospace; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .btn { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello Admin,</p>
          <p>A password reset has been requested for user: <strong>${userName}</strong></p>
          
          <div class="reset-box">
            <h3 style="margin: 0 0 12px 0; color: #dc2626;">Reset Instructions</h3>
            <p>Please share this reset link with the user:</p>
            <div class="reset-link">
              <a href="${resetLink}" style="color: #dc2626; text-decoration: none;">${resetLink}</a>
            </div>
            <a href="${resetLink}" class="btn">Reset Password</a>
          </div>

          <p><strong>⏰ Note:</strong> This reset link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email and review your account security.</p>
          
          <div class="footer">
            <p>This is an automated message from PrintPress Suite.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  async sendPasswordResetConfirmation(adminEmail, userName) {
    const subject = 'Password Reset Completed - PrintPress Suite';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .success-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #059669; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Password Reset Completed</h1>
        </div>
        <div class="content">
          <p>Hello Admin,</p>
          
          <div class="success-box">
            <h3 style="margin: 0 0 12px 0; color: #059669;">Reset Successful</h3>
            <p>The password has been successfully reset for user: <strong>${userName}</strong></p>
            <p style="color: #059669; font-weight: bold;">✓ The user can now login with their new password.</p>
          </div>

          <p>If this wasn't authorized, please review your security settings and consider changing admin credentials.</p>
          
          <div class="footer">
            <p>This is an automated message from PrintPress Suite.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  async sendJobCompletionNotification(customerEmail, customerName, ticketId, jobDescription, totalCost) {
    const subject = 'Your Print Job is Ready! - PrintPress Suite';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .job-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #7c3aed; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .amount { color: #059669; font-weight: bold; font-size: 18px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Your Order is Ready!</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${customerName}</strong>,</p>
          
          <div class="job-box">
            <h3 style="margin: 0 0 12px 0; color: #7c3aed;">Job Details</h3>
            <p style="margin: 8px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
            <p style="margin: 8px 0;"><strong>Description:</strong> ${jobDescription}</p>
            <p style="margin: 8px 0;"><strong>Total Cost:</strong> <span class="amount">₦${totalCost.toLocaleString()}</span></p>
            <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">Ready for Pickup</span></p>
          </div>

          <p>You can come to our office to pick up your completed order during business hours:</p>
          <ul>
            <li><strong>Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM</li>
            <li><strong>Address:</strong> 123 Printing Street, Your City</li>
            <li><strong>Phone:</strong> +234 123 456 7890</li>
          </ul>

          <p>Please bring your ticket ID or this email for verification.</p>
          
          <div class="footer">
            <p>Thank you for choosing PrintPress Suite!</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(customerEmail, subject, html);
  }

  async sendLowStockAlert(adminEmail, materialName, currentStock, threshold, unitOfMeasure, unitCost) {
    const subject = 'Low Stock Alert - PrintPress Suite';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ea580c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .alert-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ea580c; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .stock-low { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚠️ Low Stock Alert</h1>
        </div>
        <div class="content">
          <p>Hello Admin,</p>
          
          <div class="alert-box">
            <h3 style="margin: 0 0 12px 0; color: #ea580c;">Inventory Alert</h3>
            <p style="margin: 8px 0;"><strong>Material:</strong> ${materialName}</p>
            <p style="margin: 8px 0;"><strong>Current Stock:</strong> <span class="stock-low">${currentStock} ${unitOfMeasure}</span></p>
            <p style="margin: 8px 0;"><strong>Threshold:</strong> ${threshold} ${unitOfMeasure}</p>
            <p style="margin: 8px 0;"><strong>Unit Cost:</strong> ₦${unitCost.toLocaleString()}</p>
            <p style="margin: 8px 0; color: #dc2626;"><strong>Action Required:</strong> Please reorder this material soon.</p>
          </div>

          <p>You can manage your inventory in the PrintPress Suite admin dashboard.</p>
          
          <div class="footer">
            <p>This is an automated alert from PrintPress Suite.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  async sendPaymentNotification(adminEmail, customerName, ticketId, amount, paymentType, totalPaid, balance) {
    const subject = 'Payment Received - PrintPress Suite';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .payment-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #059669; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .amount { color: #059669; font-weight: bold; font-size: 18px; }
          .balance { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>💰 Payment Received</h1>
        </div>
        <div class="content">
          <p>Hello Admin,</p>
          
          <div class="payment-box">
            <h3 style="margin: 0 0 12px 0; color: #059669;">Payment Details</h3>
            <p style="margin: 8px 0;"><strong>Customer:</strong> ${customerName}</p>
            <p style="margin: 8px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
            <p style="margin: 8px 0;"><strong>Payment Type:</strong> ${paymentType}</p>
            <p style="margin: 8px 0;"><strong>Amount Paid:</strong> <span class="amount">₦${amount.toLocaleString()}</span></p>
            <p style="margin: 8px 0;"><strong>Total Paid:</strong> ₦${totalPaid.toLocaleString()}</p>
            <p style="margin: 8px 0;"><strong>Remaining Balance:</strong> <span class="balance">₦${balance.toLocaleString()}</span></p>
          </div>

          <p>This payment has been recorded in the system and the customer's balance has been updated.</p>
          
          <div class="footer">
            <p>This is an automated notification from PrintPress Suite.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  async sendMonthlyReport(adminEmail, month, year, revenue, expenses, profit, jobStats) {
    const subject = `Monthly Financial Report - ${month} ${year} - PrintPress Suite`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .report-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #7c3aed; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          .positive { color: #059669; font-weight: bold; }
          .negative { color: #dc2626; font-weight: bold; }
          .stat { display: flex; justify-content: space-between; margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Monthly Financial Report</h1>
        </div>
        <div class="content">
          <p>Hello Admin,</p>
          <p>Here is your financial summary for <strong>${month} ${year}</strong>:</p>
          
          <div class="report-box">
            <h3 style="margin: 0 0 16px 0; color: #7c3aed;">Financial Summary</h3>
            
            <div class="stat">
              <span><strong>Total Revenue:</strong></span>
              <span class="positive">₦${revenue.toLocaleString()}</span>
            </div>
            
            <div class="stat">
              <span><strong>Total Expenses:</strong></span>
              <span class="negative">₦${expenses.toLocaleString()}</span>
            </div>
            
            <div class="stat">
              <span><strong>Net Profit:</strong></span>
              <span class="${profit >= 0 ? 'positive' : 'negative'}">₦${profit.toLocaleString()}</span>
            </div>
            
            <div class="stat">
              <span><strong>Profit Margin:</strong></span>
              <span class="${profit >= 0 ? 'positive' : 'negative'}">${revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>

          <div class="report-box">
            <h3 style="margin: 0 0 16px 0; color: #7c3aed;">Job Statistics</h3>
            
            <div class="stat">
              <span><strong>Total Jobs:</strong></span>
              <span>${jobStats.totalJobs}</span>
            </div>
            
            <div class="stat">
              <span><strong>Completed Jobs:</strong></span>
              <span class="positive">${jobStats.completedJobs}</span>
            </div>
            
            <div class="stat">
              <span><strong>In Progress:</strong></span>
              <span>${jobStats.inProgress}</span>
            </div>
            
            <div class="stat">
              <span><strong>Average Job Value:</strong></span>
              <span>₦${jobStats.averageValue?.toLocaleString() || '0'}</span>
            </div>
          </div>

          <p>You can view detailed reports in your PrintPress Suite admin dashboard.</p>
          
          <div class="footer">
            <p>This is an automated monthly report from PrintPress Suite.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }
}

export default new EmailService();