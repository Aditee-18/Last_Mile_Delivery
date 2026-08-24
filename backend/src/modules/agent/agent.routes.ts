import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { UserRole } from '../../types/order.enums.js';
import { AgentController } from './agent.controller.js';
import { updateLocationSchema, updateOrderStatusSchema, failOrderSchema } from './agent.schema.js';

const router = Router();

// Apply Authentication & Delivery Agent Role Requirement
router.use(authenticateJWT);
router.use(requireRole(UserRole.DELIVERY_AGENT));

// Profile & Live Location Update
router.get('/profile', AgentController.getProfile);
router.get('/analytics', AgentController.getAnalytics);
router.put('/location', validateRequest(updateLocationSchema), AgentController.updateLocation);

// Assigned Tasks Manager
router.get('/orders', AgentController.listAssignedOrders);

// Order Status Progression & Failure Flagging
router.put('/orders/:id/status', validateRequest(updateOrderStatusSchema), AgentController.updateOrderStatus);
router.put('/orders/:id/fail', validateRequest(failOrderSchema), AgentController.failOrder);

export default router;
