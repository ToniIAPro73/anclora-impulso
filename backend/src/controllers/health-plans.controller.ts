import { Request, Response, NextFunction } from 'express';
import * as service from '../services/health-plans.service';
import type { HealthPlanOnboardingInput } from '../utils/health-plans.validators';

function locale(req: Request) { return req.query.locale === 'en' ? 'en' : 'es'; }

export async function listDefinitions(req: Request, res: Response, next: NextFunction) { try { res.json(await service.listDefinitions(locale(req))); } catch (error) { next(error); } }
export async function getEnrollment(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getEnrollment(req.user!.userId)); } catch (error) { next(error); } }
export async function enroll(req: Request, res: Response, next: NextFunction) { try { res.status(201).json(await service.enroll(req.user!.userId)); } catch (error) { next(error); } }
export async function saveOnboarding(req: Request<{}, {}, HealthPlanOnboardingInput>, res: Response, next: NextFunction) { try { res.json(await service.saveOnboarding(req.user!.userId, req.body)); } catch (error) { next(error); } }
export async function getHome(req: Request, res: Response, next: NextFunction) { try { res.json(await service.getHome(req.user!.userId, locale(req))); } catch (error) { next(error); } }
export async function completeAction(req: Request, res: Response, next: NextFunction) { try { res.json(await service.completeAction(req.user!.userId, req.params.actionId)); } catch (error) { next(error); } }
export async function updateStatus(req: Request<{}, {}, { status: 'active' | 'paused' | 'left' }>, res: Response, next: NextFunction) { try { res.json(await service.updateStatus(req.user!.userId, req.body.status)); } catch (error) { next(error); } }
