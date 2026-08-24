import { Router } from 'express';
import { OrderTrackingController } from './order.tracking.controller.js';

const router = Router();

// Public Tracking Route (No authentication required)
router.get('/track/:trackingNumber', OrderTrackingController.getTrackingTimeline);

export default router;
