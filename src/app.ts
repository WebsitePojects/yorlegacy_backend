import express from 'express';
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
app.use(express.json());
app.use(attachAuthUser);
app.use(enforceOfficeCsrf);
app.use(healthRouter);
app.use(compensationRouter);
app.use(authRouter);
app.use(memberRouter);
app.use(adminRouter);
app.use(pagesRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('EXPRESS ERROR:', err);
  const message = typeof err?.message === 'string' ? err.message : String(err ?? 'Internal server error');
  res.status(500).json({ message });
});
