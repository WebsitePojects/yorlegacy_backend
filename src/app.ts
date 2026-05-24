import express from 'express';
import { healthRouter } from './routes/health';
import { pagesRouter } from './routes/pages';

export const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(pagesRouter);
