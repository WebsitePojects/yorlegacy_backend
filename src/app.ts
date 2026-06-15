import express, { type NextFunction, type Request, type Response } from 'express';
import { applyCors, applyRequestContext } from './lib/http.js';
import { enforceOfficeCsrf } from './modules/auth/csrf.js';
import { attachAuthUser } from './modules/auth/request-auth.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { compensationRouter } from './routes/compensation.js';
import { healthRouter } from './routes/health.js';
import { memberRouter } from './routes/member.js';
import { pagesRouter } from './routes/pages.js';

export const app = express();

app.use(applyRequestContext);
app.use(applyCors);
app.use(express.json({ limit: '256kb' }));
app.use(attachAuthUser);
app.use(enforceOfficeCsrf);
app.use(healthRouter);
app.use(compensationRouter);
app.use(authRouter);
app.use(memberRouter);
app.use(adminRouter);
app.use(pagesRouter);

// Catch-all error handler. Logs the real error server-side but never leaks internal
// detail (DB/constraint text, stack hints) to clients — route handlers already return
// their own specific 4xx messages for user-facing validation failures.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('EXPRESS ERROR:', err);
  res.status(500).json({ message: 'Internal server error. Please try again later.' });
});
