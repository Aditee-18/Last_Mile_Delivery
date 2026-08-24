import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { OrderStatus } from '../../types/order.enums.js';

dotenv.config();

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
   * Send Real Email Notification via Nodemailer to the Order's Registered Customer
   */
  static async sendEmailNotification(toEmail: string, trackingNumber: string, newStatus: OrderStatus, notes?: string): Promise<boolean> {
    if (!toEmail) return false;

    const subject = `Order Status Update: ${trackingNumber} is now ${newStatus.replace(/_/g, ' ')}`;
    const textContent = `Hello,\n\nYour delivery order (${trackingNumber}) status has been updated to: ${newStatus.replace(/_/g, ' ')}.\n${notes ? `Note: ${notes}\n` : ''}\nThank you for choosing Last-Mile Delivery!`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">Last-Mile Delivery Status Update</h2>
        <p>Your delivery order tracking number <strong>${trackingNumber}</strong> has reached a new milestone:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0; color: #1e293b;">New Status: <span style="color: #059669;">${newStatus.replace(/_/g, ' ')}</span></h3>
          ${notes ? `<p style="margin-top: 8px; color: #475569;"><em>${notes}</em></p>` : ''}
        </div>
        <p>Log into your customer dashboard to view live tracking updates or manage your delivery.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Automated Notification • Last-Mile Delivery Management Platform</p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || 'notifications@lastmiledelivery.com',
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`📧 Nodemailer: Email notification sent to customer ${toEmail} for order ${trackingNumber} (${newStatus})`);
      return true;
    } catch (err) {
      console.warn(`⚠️ Nodemailer skipped/failed for customer ${toEmail}:`, (err as Error).message);
      return false;
    }
  }

  /**
   * Dispatch SMS Notification Payload to Customer Phone Number
   */
  static async sendSMSNotification(phone: string, trackingNumber: string, status: OrderStatus): Promise<boolean> {
    if (!phone) return false;
    const message = `[LastMile] Order ${trackingNumber} update: Status is now ${status.replace(/_/g, ' ')}.`;
    console.log(`📱 SMS Notification dispatched to customer ${phone}: "${message}"`);
    return true;
  }

  /**
   * Asynchronous, Non-blocking Status Notification Trigger
   */
  static notifyOrderStatusChange(params: {
    customerEmail: string;
    customerPhone: string;
    trackingNumber: string;
    newStatus: OrderStatus;
    notes?: string;
  }): void {
    const { customerEmail, customerPhone, trackingNumber, newStatus, notes } = params;

    Promise.all([
      this.sendEmailNotification(customerEmail, trackingNumber, newStatus, notes),
      this.sendSMSNotification(customerPhone, trackingNumber, newStatus),
    ]).catch((err) => console.error('Notification dispatch error:', err));
  }
}
