import { Router } from 'express';
import { getPageBySlug } from '../modules/pages/page-service.js';
import {
  buildPublicRegistrationPreview,
  buildPublicRegistrationSubmit
} from '../modules/operations/legacy-parity-service.js';
import { getProductionEncodingService, isProductionMode } from '../modules/production/runtime.js';

export const pagesRouter = Router();
const registrationPreviewHits = new Map<string, number[]>();

function isRegistrationPreviewRateLimited(remoteKey: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = (registrationPreviewHits.get(remoteKey) ?? []).filter((value) => now - value < windowMs);
  bucket.push(now);
  registrationPreviewHits.set(remoteKey, bucket);
  return bucket.length > 20;
}

pagesRouter.get('/api/pages/:slug', async (request, response) => {
  const page = await getPageBySlug(request.params.slug);

  if (!page) {
    response.status(404).json({ message: 'Page not found' });
    return;
  }

  response.status(200).json(page);
});

pagesRouter.post('/api/registration/preview', async (request, response) => {
  const remoteKey = String(request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown');
  if (isRegistrationPreviewRateLimited(remoteKey)) {
    response.status(429).json({ message: 'Too many registration preview attempts. Please wait a minute and try again.' });
    return;
  }

  const payload = {
    origin: request.body?.origin,
    fullName: request.body?.fullName,
    username: request.body?.username,
    email: request.body?.email,
    phone: request.body?.phone,
    password: request.body?.password,
    activationCode: request.body?.activationCode,
    referralCode: request.body?.referralCode,
    sponsorReferralCode: request.body?.sponsorReferralCode,
    placementContext: request.body?.placementContext,
    placementParentUsername:
      request.body?.placementParentUsername ??
      request.body?.placementContext?.parentUsername,
    placementSide:
      request.body?.placementSide ??
      request.body?.placementContext?.side,
    placementToken: request.body?.placementToken,
    placementReservationId: request.body?.placementReservationId,
    payoutOption: typeof request.body?.payoutOption === 'string' ? request.body.payoutOption : undefined,
    payoutDetails: typeof request.body?.payoutDetails === 'string' ? request.body.payoutDetails : undefined
  };

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      response.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }
    response.status(200).json(await service.previewRegistration(request.authUser ?? null, payload));
    return;
  }

  response.status(200).json(buildPublicRegistrationPreview(request.authUser ?? null, payload));
});

pagesRouter.post('/api/registration/submit', async (request, response) => {
  const payload = {
    origin: request.body?.origin,
    fullName: request.body?.fullName,
    username: request.body?.username,
    email: request.body?.email,
    phone: request.body?.phone,
    password: request.body?.password,
    activationCode: request.body?.activationCode,
    referralCode: request.body?.referralCode,
    sponsorReferralCode: request.body?.sponsorReferralCode,
    placementContext: request.body?.placementContext,
    placementParentUsername:
      request.body?.placementParentUsername ??
      request.body?.placementContext?.parentUsername,
    placementSide:
      request.body?.placementSide ??
      request.body?.placementContext?.side,
    placementToken: request.body?.placementToken,
    placementReservationId: request.body?.placementReservationId,
    payoutOption: typeof request.body?.payoutOption === 'string' ? request.body.payoutOption : undefined,
    payoutDetails: typeof request.body?.payoutDetails === 'string' ? request.body.payoutDetails : undefined
  };

  if (isProductionMode()) {
    const service = getProductionEncodingService();
    if (!service) {
      response.status(503).json({ message: 'Production encoding service is unavailable because Supabase is not configured.' });
      return;
    }

    try {
      response.status(200).json(await service.submitRegistration(request.authUser ?? null, payload));
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to submit registration.' });
    }
    return;
  }

  response.status(200).json(buildPublicRegistrationSubmit(request.authUser ?? null, payload));
});
