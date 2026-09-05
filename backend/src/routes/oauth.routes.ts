import { Router, type Router as ExpressRouter } from 'express';
import * as oauthController from '../controllers/oauth.controller';

const router: ExpressRouter = Router();

router.get('/google', oauthController.googleRedirect);
router.get('/google/callback', oauthController.googleCallback);
router.get('/github', oauthController.githubRedirect);
router.get('/github/callback', oauthController.githubCallback);

export default router;
