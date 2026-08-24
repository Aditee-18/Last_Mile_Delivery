import { Router } from 'express';
import { AdminController } from './admin.controller';
import { AdminZoneController } from './admin.zone.controller';
import { AdminRateController } from './admin.rate.controller';
import { AdminAnalyticsController } from './admin.analytics';
import { validateRequest } from '../../middleware/validate.middleware';
import { createZoneSchema, createAreaSchema, bulkCsvSchema } from './admin.schema';
import { updateRateCardSchema, updateSurchargeSchema } from './admin.schema';
import { createAgentSchema } from '../auth/auth.schema';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '../../types/order.enums';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole(UserRole.ADMIN));

router.post('/agents/create', validateRequest(createAgentSchema), AdminController.createAgent);
router.get('/agents', AdminController.listAgents);

router.get('/analytics/overview', AdminAnalyticsController.getOverview);

router.post('/zones', validateRequest(createZoneSchema), AdminZoneController.createZone);
router.get('/zones', AdminZoneController.listZones);
router.delete('/zones/:id', AdminZoneController.deleteZone);

router.post('/areas', validateRequest(createAreaSchema), AdminZoneController.createArea);
router.post('/areas/bulk-csv', validateRequest(bulkCsvSchema), AdminZoneController.bulkImportPincodes);

router.get('/rate-cards', AdminRateController.listRateCards);
router.put('/rate-cards/:id', validateRequest(updateRateCardSchema), AdminRateController.updateRateCard);

router.get('/surcharges', AdminRateController.listSurcharges);
router.put('/surcharges/:id', validateRequest(updateSurchargeSchema), AdminRateController.updateSurcharge);

router.get('/orders', AdminController.listOrders);
router.put('/orders/:id/assign', AdminController.manualAssignAgent);
router.post('/orders/:id/auto-assign', AdminController.triggerAutoAssign);
router.put('/orders/:id/override-status', AdminController.overrideStatus);
router.post('/orders/create-on-behalf', AdminController.createOnBehalfOrder);

export default router;
