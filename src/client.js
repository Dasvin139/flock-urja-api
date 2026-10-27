import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { config } from './config.js';
import {
  decodeSvelteKitData,
  extractMeterDetail,
  MeterNotFoundError,
} from './decoder.js';

export class PortalClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || config.urja.baseUrl;
    this.email = options.email || config.urja.email;
    this.password = options.password || config.urja.password;

    this.jar = new CookieJar();
    this.http = wrapper(
      axios.create({
        baseURL: this.baseUrl,
        jar: this.jar,
        withCredentials: true,
        timeout: 10000,
        headers: {
          'User-Agent': 'FlockUrjaService/1.0',
        },
      })
    );

    this._loginPromise = null;
  }

  async login() {
    if (this._loginPromise) {
      return this._loginPromise;
    }

    this._loginPromise = (async () => {
      try {
        const params = new URLSearchParams();
        params.append('email', this.email);
        params.append('password', this.password);

        const response = await this.http.post('/login', params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: this.baseUrl,
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        });

   
        const cookies = await this.jar.getCookies(this.baseUrl);
        const hasSession = cookies.some((c) =>
          c.key.includes('session_token') || c.key.includes('better-auth')
        );

        if (!hasSession && response.status !== 200 && response.status !== 303) {
          throw new Error('Authentication succeeded but session cookie was not set');
        }

        return true;
      } finally {
        this._loginPromise = null;
      }
    })();

    return this._loginPromise;
  }

  async _requestWithAuth(requestFn) {
    try {
      return await requestFn();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        await this.login();
        return await requestFn();
      }
      throw err;
    }
  }


  async getMetersPage(page = 1, q = '') {
    return this._requestWithAuth(async () => {
      const response = await this.http.get('/portal/meters/search', {
        params: { q, page },
      });

      if (typeof response.data !== 'object') {
        throw new Error('Portal returned non-JSON response for meters search');
      }

      return response.data;
    });
  }

  
  async getAllMeters() {
    const firstPage = await this.getMetersPage(1, '');
    const total = firstPage.total || 0;
    const pageSize = firstPage.pageSize || 20;
    let allMeters = [...(firstPage.data || [])];

    if (total <= allMeters.length) {
      return allMeters;
    }

    const totalPages = Math.ceil(total / pageSize);
    for (let p = 2; p <= totalPages; p++) {
      const pageData = await this.getMetersPage(p, '');
      const items = pageData.data || [];
      if (items.length === 0) break;
      allMeters.push(...items);
    }

    return allMeters;
  }

 
  async getMeterDetail(meterId) {
    return this._requestWithAuth(async () => {
      try {
        const response = await this.http.get(
          `/meters/${encodeURIComponent(meterId)}/__data.json`,
          {
            params: { 'x-sveltekit-invalidated': '001' },
          }
        );

        if (typeof response.data !== 'object') {
          throw new Error('Portal returned unexpected HTML/text for meter detail');
        }

        const decoded = decodeSvelteKitData(response.data);
        return extractMeterDetail(decoded);
      } catch (err) {
        if (err instanceof MeterNotFoundError || err.response?.status === 404) {
          const error = new Error(`Meter '${meterId}' not found`);
          error.status = 404;
          throw error;
        }
        throw err;
      }
    });
  }

  async getMeterEnergy(meterId) {
    return this._requestWithAuth(async () => {
      try {
        const response = await this.http.get(
          `/portal/meters/${encodeURIComponent(meterId)}/energy`
        );

        if (!response.data || !Array.isArray(response.data.data)) {
          throw new Error('Unexpected energy response format from portal');
        }

        return response.data.data;
      } catch (err) {
        if (err.response?.status === 404) {
          const error = new Error(`Meter '${meterId}' energy data not found`);
          error.status = 404;
          throw error;
        }
        throw err;
      }
    });
  }
}