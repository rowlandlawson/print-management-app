import PDFDocument from 'pdfkit';
import { pool } from '../config/database.js';

class ReceiptService {
  async generatePDFReceipt(paymentId) {
    try {
      // Get receipt data
      const result = await pool.query(`
        SELECT 
          p.*,
          j.ticket_id,
          j.total_cost,
          j.amount_paid,
          j.balance,
          j.description as job_description,
          c.name as customer_name,
          c.phone as customer_phone,
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
        throw new Error('Payment not found');
      }

      const receipt = result.rows[0];

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        
        doc.on('error', reject);

        // Add content to PDF
        this.addReceiptContent(doc, receipt);
        doc.end();
      });
    } catch (error) {
      console.error('Generate PDF receipt error:', error);
      throw error;
    }
  }

  addReceiptContent(doc, receipt) {
    // Header
    doc.fontSize(20).font('Helvetica-Bold')
       .text(receipt.business_name || 'PRINTPRESS SUITE', 50, 50, { align: 'center' });
    
    doc.fontSize(10).font('Helvetica')
       .text('OFFICIAL RECEIPT', 50, 80, { align: 'center' });
    
    doc.moveDown();

    // Receipt details
    const leftColumn = 50;
    const rightColumn = 300;
    let yPosition = 120;

    // Receipt Number and Date
    doc.fontSize(10).font('Helvetica-Bold')
       .text('Receipt Number:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(receipt.receipt_number, rightColumn, yPosition);
    
    yPosition += 20;
    doc.font('Helvetica-Bold')
       .text('Date:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(new Date(receipt.date).toLocaleDateString('en-NG'), rightColumn, yPosition);
    
    yPosition += 30;

    // Customer Information
    doc.font('Helvetica-Bold').fontSize(12)
       .text('CUSTOMER INFORMATION', leftColumn, yPosition);
    
    yPosition += 20;
    doc.fontSize(10)
       .text('Name:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(receipt.customer_name, rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Phone:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(receipt.customer_phone, rightColumn, yPosition);
    
    yPosition += 30;

    // Job Information
    doc.font('Helvetica-Bold').fontSize(12)
       .text('JOB DETAILS', leftColumn, yPosition);
    
    yPosition += 20;
    doc.fontSize(10)
       .text('Ticket ID:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(receipt.ticket_id, rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Description:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(receipt.job_description || 'N/A', rightColumn, yPosition, { 
         width: 250, 
         align: 'left' 
       });
    
    yPosition += 30;

    // Payment Details
    doc.font('Helvetica-Bold').fontSize(12)
       .text('PAYMENT DETAILS', leftColumn, yPosition);
    
    yPosition += 20;
    doc.fontSize(10)
       .text('Amount Paid:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(`₦${parseFloat(receipt.amount).toLocaleString()}`, rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Payment Method:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(this.formatPaymentMethod(receipt.payment_method), rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Payment Type:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(this.formatPaymentType(receipt.payment_type), rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Total Job Cost:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(`₦${parseFloat(receipt.total_cost).toLocaleString()}`, rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Total Paid:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(`₦${parseFloat(receipt.amount_paid).toLocaleString()}`, rightColumn, yPosition);
    
    yPosition += 15;
    doc.font('Helvetica-Bold')
       .text('Remaining Balance:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(`₦${parseFloat(receipt.balance).toLocaleString()}`, rightColumn, yPosition);
    
    yPosition += 30;

    // Recorded By
    doc.font('Helvetica-Bold')
       .text('Recorded By:', leftColumn, yPosition);
    doc.font('Helvetica')
       .text(receipt.recorded_by_name, rightColumn, yPosition);

    // Footer
    const footerY = doc.page.height - 100;
    doc.fontSize(8).font('Helvetica')
       .text('Thank you for your business!', 50, footerY, { align: 'center' });
    
    doc.text('This is an official receipt from PrintPress Suite', 50, footerY + 15, { align: 'center' });
    
    // Add page border
    doc.rect(40, 40, doc.page.width - 80, doc.page.height - 120)
       .strokeColor('#cccccc')
       .stroke();
  }

  formatPaymentMethod(method) {
    const methods = {
      'cash': 'Cash',
      'transfer': 'Bank Transfer',
      'pos': 'POS Payment'
    };
    return methods[method] || method;
  }

  formatPaymentType(type) {
    const types = {
      'deposit': 'Deposit',
      'installment': 'Installment',
      'full_payment': 'Full Payment',
      'balance': 'Balance Payment'
    };
    return types[type] || type;
  }

  async generateHTMLReceipt(paymentId) {
    // Similar to PDF but returns HTML string for web printing
    // Implementation for HTML receipt generation
    // This can be used for browser printing
  }
}

export default new ReceiptService();