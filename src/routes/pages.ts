import { Router } from 'express';
import { getPageBySlug } from '../modules/pages/page-service.js';
import {
  buildPublicRegistrationPreview,
  buildPublicRegistrationSubmit
} from '../modules/operations/legacy-parity-service.js';

export const pagesRouter = Router();

pagesRouter.get('/api/pages/:slug', async (request, response) => {
  const page = await getPageBySlug(request.params.slug);

  if (!page) {
    response.status(404).json({ message: 'Page not found' });
    return;
  }

  response.status(200).json(page);
});

pagesRouter.post('/api/registration/preview', (request, response) => {
  response.status(200).json(
    buildPublicRegistrationPreview(request.authUser ?? null, {
      origin: request.body?.origin,
      fullName: request.body?.fullName,
      username: request.body?.username,
      email: request.body?.email,
      phone: request.body?.phone,
      password: request.body?.password,
      activationCode: request.body?.activationCode,
      referralCode: request.body?.referralCode,
      placementParentUsername: request.body?.placementParentUsername,
      placementSide: request.body?.placementSide
    })
  );
});

pagesRouter.post('/api/registration/submit', (request, response) => {
  response.status(200).json(
    buildPublicRegistrationSubmit(request.authUser ?? null, {
      origin: request.body?.origin,
      fullName: request.body?.fullName,
      username: request.body?.username,
      email: request.body?.email,
      phone: request.body?.phone,
      password: request.body?.password,
      activationCode: request.body?.activationCode,
      referralCode: request.body?.referralCode,
      placementParentUsername: request.body?.placementParentUsername,
      placementSide: request.body?.placementSide
    })
  );
});
