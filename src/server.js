import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`🚀 Urja API service listening on http://localhost:${config.port}`);
  console.log(`📖 API Documentation (Swagger UI): http://localhost:${config.port}/docs`);
  console.log(`🩺 Health check: http://localhost:${config.port}/health`);
});