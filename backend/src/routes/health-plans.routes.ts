import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as controller from '../controllers/health-plans.controller';
import { healthPlanOnboardingSchema, healthPlanStatusSchema } from '../utils/health-plans.validators';

const router: Router = Router();

router.get('/definitions', controller.listDefinitions);
router.use(authenticate);
router.get('/enrollment', controller.getEnrollment);
router.post('/enrollment', controller.enroll);
router.post('/onboarding', validateBody(healthPlanOnboardingSchema), controller.saveOnboarding);
router.get('/home', controller.getHome);
router.post('/actions/:actionId/complete', controller.completeAction);
router.put('/enrollment/status', validateBody(healthPlanStatusSchema), controller.updateStatus);

export default router;
