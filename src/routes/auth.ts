import { Router } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../modules/auth/auth-service.js';
import { getDemoCredentials } from '../modules/auth/demo-users.js';
import {
  createExpiredSessionCookie,
  createSessionCookie,
  createSessionToken
} from '../modules/auth/session.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
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

  const user = await authenticateUser(parsed.data.email, parsed.data.password);

  if (!user) {
    res.status(401).json({
      message: 'Invalid email or password'
    });
    return;
  }

  const token = createSessionToken(user);

  res.setHeader('Set-Cookie', createSessionCookie(token));
  res.status(200).json({
    authenticated: true,
    user
  });
});

authRouter.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', createExpiredSessionCookie());
  res.status(200).json({
    authenticated: false
  });
});

authRouter.get('/api/auth/demo-credentials', (_req, res) => {
  res.status(200).json(getDemoCredentials());
});
