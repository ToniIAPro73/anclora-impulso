import { Router, type Router as ExpressRouter } from 'express';
import * as oauthController from '../controllers/oauth.controller';
import { authenticate } from '../middleware/auth';

const router: ExpressRouter = Router();

router.get('/google', oauthController.googleRedirect);
router.get('/google/callback', oauthController.googleCallback);
router.get('/github', oauthController.githubRedirect);
router.get('/github/callback', oauthController.githubCallback);
router.get('/anclora-identity/status', oauthController.ancloraIdentityStatus);
router.get('/anclora-identity', oauthController.ancloraIdentityRedirect);
router.get('/anclora-identity/login', oauthController.ancloraIdentityRedirect);
router.get('/anclora-identity/callback', oauthController.ancloraIdentityCallback);
router.post('/anclora-identity/link/init', authenticate, oauthController.initAncloraIdentityLink);
router.get('/anclora-identity/link', authenticate, oauthController.getAncloraIdentityLink);
router.delete('/anclora-identity/link', authenticate, oauthController.unlinkAncloraIdentity);
router.post('/anclora-identity/logout', oauthController.ancloraIdentityLogout);
router.post('/oauth/exchange', oauthController.exchangeOAuthHandoff);

export default router;
