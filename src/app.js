import express from 'express';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { PortalClient } from './client.js';
import { globalCache } from './cache.js';
import { transformEnergyReadings } from './transform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(client = new PortalClient(), cache = globalCache) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const openApiPath = path.join(__dirname, '..', 'openapi.json');
  if (fs.existsSync(openApiPath)) {
    const openApiDoc = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
    app.get('/openapi.json', (req, res) => res.json(openApiDoc));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));
  }


  app.get('/api/v1/meters', async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
      const q = (req.query.q || '').trim().toLowerCase();
      const make = (req.query.make || '').trim().toLowerCase();
      const status = (req.query.status || '').trim().toLowerCase();
      const phaseType = (req.query.phase_type || '').trim().toLowerCase();
      const dtCode = (req.query.dt_code || '').trim().toLowerCase();
      const forceRefresh = req.query.refresh === 'true';

  
      const allMeters = await cache.getOrSet(
        'all_meters',
        () => client.getAllMeters(),
        config.cache.metersTtlMs,
        forceRefresh
      );

    
      let filtered = allMeters.filter((meter) => {
        if (q) {
          const matchId = meter.meterId?.toLowerCase().includes(q);
          const matchSerial = meter.serialNo?.toLowerCase().includes(q);
          if (!matchId && !matchSerial) return false;
        }
        if (make && meter.make?.toLowerCase() !== make) return false;
        if (status && meter.installStatus?.toLowerCase() !== status) return false;
        if (phaseType && meter.phaseType?.toLowerCase() !== phaseType) return false;
        if (dtCode && meter.dtCode?.toLowerCase() !== dtCode) return false;

        return true;
      });

      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const startIndex = (page - 1) * pageSize;
      const items = filtered.slice(startIndex, startIndex + pageSize);

      res.json({
        items,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      });
    } catch (err) {
      next(err);
    }
  });


  app.get('/api/v1/meters/:meterId', async (req, res, next) => {
    try {
      const { meterId } = req.params;
      const forceRefresh = req.query.refresh === 'true';

      const detail = await cache.getOrSet(
        `meter_detail:${meterId}`,
        () => client.getMeterDetail(meterId),
        config.cache.detailTtlMs,
        forceRefresh
      );

      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/meters/:meterId/consumption', async (req, res, next) => {
    try {
      const { meterId } = req.params;
      const { from, to, refresh } = req.query;
      const forceRefresh = refresh === 'true';

      const rawReadings = await cache.getOrSet(
        `meter_energy:${meterId}`,
        () => client.getMeterEnergy(meterId),
        config.cache.energyTtlMs,
        forceRefresh
      );

      const transformed = transformEnergyReadings(rawReadings, {
        fromDate: from,
        toDate: to,
      });

      res.json({
        meter_id: meterId,
        ...transformed,
      });
    } catch (err) {
      next(err);
    }
  });


  app.use((err, req, res, next) => {
    const status = err.status || (err.response?.status === 404 ? 404 : 502);

    if (status === 404) {
      return res.status(404).json({
        error: 'not_found',
        message: err.message || 'Resource not found',
      });
    }

    console.error('API Error:', err.message);
    res.status(502).json({
      error: 'bad_gateway',
      message: 'Failed to communicate with the upstream Urja portal',
      details: err.message,
    });
  });

  return app;
}