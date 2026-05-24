import { app } from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`yorlegacy-backend listening on http://127.0.0.1:${env.PORT}`);
});
