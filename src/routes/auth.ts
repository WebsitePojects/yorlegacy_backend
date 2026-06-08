import { Router } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../modules/auth/auth-service.js';
import { getDemoCredentials } from '../modules/auth/demo-users.js';
import {
  createCsrfCookie,
  createCsrfToken,
  createExpiredCsrfCookie,
  createExpiredSessionCookie,
  createSessionCookie,
  createSessionToken,
  CSRF_COOKIE_NAME,
  readCookie
} from '../modules/auth/session.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  scope: z.enum(['member', 'office']).optional()
});

export const authRouter = Router();

authRouter.get('/api/auth/me', (req, res) => {
  if (!req.authUser) {
    res.status(200).json({
      authenticated: false,
      user: null
    });
    return;
  }

  const existingCsrfToken = readCookie(req.headers.cookie, CSRF_COOKIE_NAME);
  if (!existingCsrfToken) {
    res.append('Set-Cookie', createCsrfCookie(createCsrfToken()));
  }

  res.status(200).json({
    authenticated: true,
    user: req.authUser
  });
});

authRouter.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid credentials payload'
    });
    return;
  }

  const { username, password, rememberMe, scope } = parsed.data;
  const user = await authenticateUser(username, password);

  if (!user) {
    res.status(401).json({
      message: 'Invalid username or password'
    });
    return;
  }

  // Enforce portal-role isolation/scoping
  if (scope === 'member' && user.role !== 'member') {
    res.status(403).json({
      message: 'Access denied: Members-only portal'
    });
    return;
  }

  if (scope === 'office' && user.role === 'member') {
    res.status(403).json({
      message: 'Access denied: Office-only portal'
    });
    return;
  }

  const token = createSessionToken(user, rememberMe);
  const csrfToken = createCsrfToken();

  res.setHeader('Set-Cookie', [
    createSessionCookie(token, rememberMe),
    createCsrfCookie(csrfToken, rememberMe)
  ]);
  res.status(200).json({
    authenticated: true,
    user
  });
});

authRouter.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', [createExpiredSessionCookie(), createExpiredCsrfCookie()]);
  res.status(200).json({
    authenticated: false
  });
});

authRouter.get('/api/auth/demo-credentials', (_req, res) => {
  res.status(200).json(getDemoCredentials());
});
