import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { OrderStatus } from '../../types/order.enums.js';

dotenv.config();

// Create Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT) || 2525,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export class NotificationService {
  /**
   * Send Email Notification on Order Status Change
   */
  static async sendEmailNotification(toEmail: string, trackingNumber: string, newStatus: OrderStatus, notes?: string): Promise<boolean> {
    const subject = `Order Update: ${trackingNumber} is now ${newStatus.replace(/_/g, ' ')}`;
    const textContent = `Hello,\n\nYour delivery order (${trackingNumber}) status has been updated to: ${newStatus}.\n${notes ? `Note: ${notes}\n` : ''}\nThank you for choosing Last-Mile Delivery!`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20, max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Last-Mile Delivery Status Update</h2>
        <p>Your order tracking number <strong>${trackingNumber}</strong> has reached a new milestone:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0; color: #1e293b;">Status: <span style="color: #059669;">${newStatus.replace(/_/g, ' ')}</span></h3>
          ${notes ? `<p style="margin-top: 8px; color: #475569;"><em>${notes}</em></p>` : ''}
        </div>
        <p>Click below to view full live tracking details on our portal.</p>
        <p style="font-size: 12px; color: #94a3b8;">This is an automated notification.</p>
      </div>
    `;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [MOCK EMAIL] To: ${toEmail} | Subject: "${subject}"`);
      }
      
      // Attempt sending email (swallows errors in dev to prevent blocking API responses)
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || 'notifications@lastmiledelivery.com',
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      return true;
    } catch (err) {
      console.warn(`⚠️ Email notification skipped/failed (${toEmail}):`, (err as Error).message);
      return false;
    }
  }

  /**
   * Send SMS Notification (Console fallback / Twilio ready)
   */
  static async sendSMSNotification(phone: string, trackingNumber: string, status: OrderStatus): Promise<boolean> {
    const message = `[LastMile] Order ${trackingNumber} update: Status is now ${status}.`;
    console.log(`📱 [SMS NOTIFICATION] To: ${phone} | Msg: "${message}"`);
    return true;
  }

  /**
   * Trigger Unified Order Status Notification (Asynchronous / Non-blocking)
   */
  static notifyOrderStatusChange(params: {
    customerEmail: string;
    customerPhone: string;
    trackingNumber: string;
    newStatus: OrderStatus;
    notes?: string;
  }): void {
    const { customerEmail, customerPhone, trackingNumber, newStatus, notes } = params;
    
    // Execute asynchronously without awaiting to ensure ultra-fast API response times
    Promise.all([
      this.sendEmailNotification(customerEmail, trackingNumber, newStatus, notes),
      this.sendSMSNotification(customerPhone, trackingNumber, newStatus),
    ]).catch((err) => console.error('Notification dispatch error:', err));
  }
}
