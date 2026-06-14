import { createApp } from './src/app.js';
import { env } from './src/config/env.js';

const app = createApp();

app.listen(env.port, () => {
  console.info(`${env.serviceName} listening on port ${env.port}`);
});
