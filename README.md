# Flock Urja API

A clean, documented REST API service that wraps the legacy **Urja Meter Ops Portal** — a SvelteKit web application used to manage ~403 electricity smart meters across Jaipur.

Instead of scraping HTML, this service talks directly to the portal's JSON endpoints, handles session management automatically, normalises messy data into clean responses, and serves everything through a standard REST API with full OpenAPI documentation.

## Architecture

```
Client  ──▶  Express API  ──▶  In-Memory Cache  ──▶  Portal Client  ──▶  Urja Portal
              (routes)         (TTL-based)            (Axios + cookies)    (SvelteKit app)
```

**Key modules:**

| File | Responsibility |
|------|---------------|
| `src/config.js` | Loads environment variables, defines cache TTLs |
| `src/client.js` | Handles login, cookie persistence, 401 auto-retry, portal requests |
| `src/decoder.js` | Decodes SvelteKit's compact JSON format into usable objects |
| `src/transform.js` | Converts string numbers → floats, timestamps → ISO-8601, cumulative → interval kWh |
| `src/cache.js` | Simple in-memory TTL cache to avoid hammering the portal |
| `src/app.js` | Express routes, Swagger UI, error handling |
| `src/server.js` | Application entry point |

## Quick Start

### Prerequisites

- **Node.js** v18 or higher
- Valid Urja portal credentials (provided in the assignment brief)

### Setup

```bash
# Clone the repository
git clone https://github.com/Dasvin139/flock-urja-api.git
cd flock-urja-api

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
# Edit .env and add your portal email and password
```

### Run

```bash
# Start the server
npm start

# Or with auto-reload during development
npm run dev
```

The server starts on `http://localhost:3000` by default.

### Test

```bash
npm test
```

Runs 13 tests covering the decoder, transformer, cache, client (mocked), and API routes.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/meters` | List all meters (with filtering and pagination) |
| `GET` | `/api/v1/meters/:meterId` | Get meter details and network hierarchy |
| `GET` | `/api/v1/meters/:meterId/consumption` | Get energy consumption with interval calculations |
| `GET` | `/docs` | Interactive Swagger UI |
| `GET` | `/openapi.json` | Raw OpenAPI 3.0 specification |

## Sample Requests

### List meters with filtering

```bash
# Get first page of all meters
curl http://localhost:3000/api/v1/meters

# Search by meter ID or serial number
curl "http://localhost:3000/api/v1/meters?q=J100005"

# Filter by make, with pagination
curl "http://localhost:3000/api/v1/meters?make=genus&page=2&page_size=10"

# Filter by status
curl "http://localhost:3000/api/v1/meters?status=faulty"

# Force cache refresh
curl "http://localhost:3000/api/v1/meters?refresh=true"
```

### Get meter details

```bash
curl http://localhost:3000/api/v1/meters/J100002
```

Returns decoded meter info including the full network hierarchy (Zone → Circle → Division → Subdivision → Substation → Feeder → DT).

### Get energy consumption

```bash
# All readings with calculated interval kWh
curl http://localhost:3000/api/v1/meters/J100000/consumption

# Filter by date range (ISO-8601)
curl "http://localhost:3000/api/v1/meters/J100000/consumption?from=2026-06-24T00:00:00&to=2026-06-25T00:00:00"
```

## Design Decisions

1. **No HTML scraping** — The portal exposes JSON endpoints for all three data types (meter list, details, energy readings). Using these directly is faster, more reliable, and less brittle than parsing HTML.

2. **In-memory TTL cache** — The portal has 403 meters across 21 pages. Without caching, every filtered list request would fire 21 sequential HTTP requests. The cache stores the full list for 5 minutes, meter details for 10 minutes, and energy data for 2 minutes. A `?refresh=true` parameter lets callers bypass the cache when needed.

3. **Lazy login with single-flight lock** — The client doesn't log in at startup. It waits until the first request that needs authentication, then logs in once. If multiple requests arrive simultaneously, they all share the same login promise instead of firing separate login requests.

4. **Interval kWh from cumulative readings** — The portal stores cumulative meter readings, not per-interval consumption. The transformer calculates interval consumption by subtracting consecutive readings. When a reading is lower than its predecessor (meter reset), the interval is set to `null` rather than a misleading negative number.

5. **Timezone handling** — Portal timestamps are `DD/MM/YYYY HH:MM` with no timezone. Since all meters are in Jaipur, timestamps are converted to ISO-8601 with `+05:30` offset.

## Assumptions

- All meters are in the IST timezone (`+05:30`).
- The portal's page size of 20 is fixed and cannot be changed server-side.
- A 401 response always means the session has expired (not a permissions issue).
- Missing or unparseable numeric values should become `null`, not `0`.
- The DT code (e.g., `DT-007`) is a more reliable identifier than the DT name, since duplicate names exist.

## What Was Intentionally Skipped

- **Persistent cache** (Redis, SQLite) — An in-memory cache is sufficient for this assignment. A production system would use Redis for shared state across instances.
- **Rate limiting** — Not needed for a single-user evaluation, but would be important in production.
- **Authentication on this API** — The assignment brief didn't require it. In production, this API should have its own auth layer.
- **WebSocket / real-time updates** — The portal doesn't support push notifications; polling is the only option.

## Future Improvements

- Add Redis for persistent, shared caching across multiple server instances.
- Implement request queuing to limit concurrent connections to the portal.
- Add an endpoint to return the full network hierarchy tree.
- Add rate limiting and API key authentication.
- Set up CI/CD with automated test runs on push.

## Related Documents

- [`PROTOCOL.md`](./PROTOCOL.md) — Detailed reverse-engineering of the legacy portal's behavior
- [`REFLECTION.md`](./REFLECTION.md) — Answers to the reflection questions
- [`openapi.json`](./openapi.json) — Exported OpenAPI 3.0 specification
