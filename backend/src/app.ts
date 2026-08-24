import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testDbConnection } from './config/database.js';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import agentRoutes from './modules/agent/agent.routes.js';
import trackingRoutes from './modules/orders/order.tracking.routes.js';
import { authenticateJWT } from './middleware/auth.middleware.js';
import { requireRole } from './middleware/rbac.middleware.js';
import { UserRole } from './types/order.enums.js';

import { PublicAnalyticsController } from './modules/analytics/public.analytics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await testDbConnection();
  res.json({
    status: 'online',
    timestamp: new Date(),
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV,
  });
});

// Public Analytics Endpoint
app.get('/api/analytics/public', PublicAnalyticsController.getPublicMetrics);

// System Module Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/orders', trackingRoutes);

// Role Protection Test Endpoints (Demonstrating RBAC Middleware)
app.get('/api/test/admin-only', authenticateJWT, requireRole(UserRole.ADMIN), (req, res) => {
  res.json({ success: true, message: 'Welcome Admin!', user: req.user });
});

app.get('/api/test/agent-only', authenticateJWT, requireRole(UserRole.DELIVERY_AGENT), (req, res) => {
  res.json({ success: true, message: 'Welcome Delivery Agent!', user: req.user });
});

app.get('/api/test/customer-only', authenticateJWT, requireRole(UserRole.CUSTOMER), (req, res) => {
  res.json({ success: true, message: 'Welcome Customer!', user: req.user });
});

// Bootstrap Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`🚀 Last-Mile Delivery Backend running on http://localhost:${PORT}`);
    await testDbConnection();
  });
}

export default app;
