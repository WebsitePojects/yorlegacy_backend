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
    buildPublicRegistrationPreview({
      fullName: request.body?.fullName,
      email: request.body?.email,
      phone: request.body?.phone,
      password: request.body?.password,
      sponsorCode: request.body?.sponsorCode,
      packageTier: request.body?.packageTier,
      preferredSide: request.body?.preferredSide
    })
  );
});

pagesRouter.post('/api/registration/submit', (request, response) => {
  response.status(200).json(
    buildPublicRegistrationSubmit({
      fullName: request.body?.fullName,
      email: request.body?.email,
      phone: request.body?.phone,
      password: request.body?.password,
      sponsorCode: request.body?.sponsorCode,
      packageTier: request.body?.packageTier,
      preferredSide: request.body?.preferredSide
    })
  );
});
