import { Router } from 'express';
import { rateLimit } from '../lib/rate-limit.js';
import { getPageBySlug } from '../modules/pages/page-service.js';
import {
  buildPublicRegistrationPreview,
  buildPublicRegistrationSubmit
} from '../modules/operations/legacy-parity-service.js';
import { getProductionEncodingService, isProductionMode } from '../modules/production/runtime.js';
import { newsService } from '../modules/news/news-service.js';
import { submitPublicContactMessage } from '../modules/support/support-service.js';

export const pagesRouter = Router();
const contactHits = new Map<string, number[]>();
const registrationPreviewHits = new Map<string, number[]>();

function isRegistrationPreviewRateLimited(remoteKey: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = (registrationPreviewHits.get(remoteKey) ?? []).filter((value) => now - value < windowMs);
  bucket.push(now);
  registrationPreviewHits.set(remoteKey, bucket);
  return bucket.length > 20;
}

// Public announcements bulletin — published news posts only.
pagesRouter.get('/api/public/announcements', async (_request, response) => {
  try {
    response.status(200).json({ posts: await newsService.listPublished() });
  } catch (error) {
    console.error('[public-announcements] load failed:', error);
    response.status(200).json({ posts: [] });
  }
});

// Public (anonymous) contact-us submission. Lightweight per-IP rate limit.
pagesRouter.post('/api/public/contact', async (request, response) => {
  const remoteKey = String(request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown');
  const now = Date.now();
  // Sweep stale IP buckets so the map can't grow unbounded across many unique IPs.
  for (const [key, hits] of contactHits) {
    const fresh = hits.filter((v) => now - v < 60_000);
    if (fresh.length === 0) contactHits.delete(key);
    else contactHits.set(key, fresh);
  }
  const bucket = contactHits.get(remoteKey) ?? [];
  bucket.push(now);
  contactHits.set(remoteKey, bucket);
  if (bucket.length > 5) {
    response.status(429).json({ message: 'Too many messages. Please wait a minute and try again.' });
    return;
  }

  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  const email = typeof request.body?.email === 'string' ? request.body.email.trim() : '';
  const subject = typeof request.body?.subject === 'string' ? request.body.subject.trim() : '';
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';

  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || subject.length < 3 || message.length < 10) {
    response.status(400).json({ message: 'Please provide your name, a valid email, a subject, and a message (10+ characters).' });
    return;
  }

  try {
    const submitted = await submitPublicContactMessage({ name, email, subject, message });
    response.status(200).json({ status: 'submitted', id: submitted.id });
  } catch {
    response.status(500).json({ message: 'Unable to send your message right now. Please try again later.' });
  }
});

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

const registrationSubmitRateLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'registration-submit' });

pagesRouter.post('/api/registration/submit', registrationSubmitRateLimit, async (request, response) => {
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
      const result = await service.submitRegistration(request.authUser ?? null, payload);
      // Respond immediately — registration is instant. The PV/SMB walk-up is processed in
      // the background (fire-and-forget here + the 10s drainer as backstop), and the live
      // SSE stream pushes the credited points to dashboards as soon as they land. This is
      // what removes the multi-second wait while the ancestor chain is credited.
      // GATE-SMB-INSTANT-20260615: drain compensation + reconcile salesmatch right after
      // the response so PV propagation, SMB pairing, binary cycle, and shadow earnings
      // credit within ~1s of encode (the 10s drainer is the backstop). Fire-and-forget so
      // the registration request itself never blocks on the tree walk.
      void service
        .processCompensationQueue(200)
        .then(() => service.reconcileShadowEarnings())
        .then(() => service.reconcileSalesmatchAllEligible())
        .catch((queueError) => console.error('[compensation-queue] background processing error:', queueError));
      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to submit registration.' });
    }
    return;
  }

  response.status(200).json(buildPublicRegistrationSubmit(request.authUser ?? null, payload));
});
