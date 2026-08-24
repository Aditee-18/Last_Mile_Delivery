import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { UserRole } from '../../types/order.enums.js';
import { CustomerController } from './customer.controller.js';
import { orderQuoteSchema, createOrderSchema, rescheduleOrderSchema } from './customer.schema.js';

const router = Router();

// Apply Authentication & Customer Role Requirement
router.use(authenticateJWT);
router.use(requireRole(UserRole.CUSTOMER));

// Pre-confirmation Price Quote
router.post('/orders/quote', validateRequest(orderQuoteSchema), CustomerController.calculateQuote);

// Book Order
router.post('/orders/create', validateRequest(createOrderSchema), CustomerController.createOrder);

// Customer Orders List
router.get('/orders', CustomerController.listMyOrders);

// Customer Analytics
router.get('/analytics', CustomerController.getAnalytics);

// Reschedule Failed Order
router.post('/orders/:id/reschedule', validateRequest(rescheduleOrderSchema), CustomerController.rescheduleFailedOrder);

export default router;
