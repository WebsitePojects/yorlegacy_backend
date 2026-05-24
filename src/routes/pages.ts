import { Router } from 'express';
import { getPageBySlug } from '../modules/pages/page-service';

export const pagesRouter = Router();

pagesRouter.get('/api/pages/:slug', async (request, response) => {
  const page = await getPageBySlug(request.params.slug);

  if (!page) {
    response.status(404).json({ message: 'Page not found' });
    return;
  }

  response.status(200).json(page);
});
