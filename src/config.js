import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  urja: {
    baseUrl: (process.env.URJA_BASE_URL || 'https://urja-ops.flockenergy.tech').replace(/\/+$/, ''),
    email: process.env.URJA_EMAIL || 'operator@urja.local',
    password: process.env.URJA_PASSWORD || '',
  },
  cache: {
    metersTtlMs: parseInt(process.env.CACHE_TTL_METERS_MS, 10) || 5 * 60 * 1000, 
    detailTtlMs: parseInt(process.env.CACHE_TTL_DETAIL_MS, 10) || 10 * 60 * 1000, 
    energyTtlMs: parseInt(process.env.CACHE_TTL_ENERGY_MS, 10) || 2 * 60 * 1000, 
  },
};


if (!config.urja.password) {
  console.warn('⚠️ Warning: URJA_PASSWORD is not set in your environment or .env file!');
}