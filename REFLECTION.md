
# Candidate Reflection

**Candidate:** Dasvin
**Date:** 26 October 2026
--------------------------------------

### 1. What assumptions did you make?

I assumed that the portal's timestamps (`DD/MM/YYYY HH:MM`) represent Indian Standard Time (`+05:30`), because the network locations reference Jaipur and Rajasthan. I converted them into standard ISO-8601 strings so downstream services wouldn't have to guess the timezone. I also assumed that missing or placeholder values (`"-"`, `"N/A"`, empty strings) should be parsed as `null` rather than `0`, so that downstream billing or data tools don't treat missing data as zero consumption. Finally, because transformer `DT-007` appeared with two different names (`Sanganer DT 7` and `Old Malviya Nagar Xfmr`), I assumed the code in brackets is the true primary key, while the name is just a display label.

### 2. Which part was the most difficult, and how did you get unstuck?

The hardest part was decoding the meter details from `/meters/{id}/__data.json`. I expected a normal JSON object with keys and values, but instead found SvelteKit's serialized format where objects had integers pointing to indexes in a flat array (for example, `meterId: 1` pointed to index `1` which was `"J100002"`, and `hierarchy: 21` pointed to a map of even more indexes). It looked confusing at first. I got unstuck by printing out the raw JSON, picking meter `J100002`, and manually tracing the numbers with pen and paper. Once I saw how the pointers linked together, I wrote a recursive resolver function in `src/decoder.js` and wrote a test against the saved fixture to make sure it resolved every field cleanly.

### 3. If you had another day, what would you improve?

If I had another day, I would build a background sync job to assemble the full network hierarchy tree. Right now, to get the hierarchy of all meters, you have to query all 403 meter endpoints one by one. Doing that synchronously during an API call would be too slow and would hammer the portal. With more time, I would write a background task that slowly crawls the 403 meters at a polite rate (e.g., 3–5 requests at a time with small delays), joins them by Zone $\rightarrow$ Circle $\rightarrow$ Division $\rightarrow$ Substation $\rightarrow$ Feeder $\rightarrow$ DT $\rightarrow$ Meter, stores the clean tree in SQLite or Redis, and exposes a `GET /api/v1/hierarchy` endpoint.

### 4. What mistake did you make while solving this?

Before I actually inspected the network tab in Chrome, I initially assumed the portal was an old server-side website that rendered raw HTML tables, and I almost started writing web scrapers using Cheerio/BeautifulSoup. When I opened the browser DevTools and checked the Network requests during login and navigation, I realized that the frontend is actually a modern SvelteKit application talking to clean internal JSON endpoints. Realizing this saved me from writing unnecessary HTML scraping code. It was a good reminder to always inspect and verify how an upstream system works before writing code based on assumptions.

### 5. If you were reviewing your own submission, what would you criticise?

I would criticise the fact that the cache is stored entirely in memory. It works fine for ~400 meters on a single machine, but if the Node server restarts or crashes, the cache is completely lost, and the next incoming request has to wait for 21 upstream requests to re-index all the meters. In a real production setup, I would use an external cache like Redis so the cached data survives server restarts and can be shared if multiple instances of the service are running.
