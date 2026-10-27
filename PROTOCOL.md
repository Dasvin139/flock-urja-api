# PROTOCOL.md: How the Urja Meter Ops Portal Works

**Observation date:** 26 October 2026
**Base URL:** `https://urja-ops.flockenergy.tech`

This is what we found by inspecting the portal in Chrome DevTools and then repeating the requests with `curl`.
Where something was not tested, we say so.

## 1. Overview

The portal is a SvelteKit web application. Users log in, view and search a list of electricity meters, and open
individual meter pages with details and energy readings.

Instead of scraping HTML, we found the JSON endpoints the pages use. There are three:

| Purpose | Endpoint | Format |
|---|---|---|
| Meter list and search | `GET /portal/meters/search?q=&page=N` | plain JSON |
| Energy readings | `GET /portal/meters/{meterId}/energy` | plain JSON |
| Meter details and network hierarchy | `GET /meters/{meterId}/__data.json?x-sveltekit-invalidated=001` | SvelteKit compact JSON (needs decoding) |

## 2. Login and Session Management

- Login is `POST /login` with a **form body** (`application/x-www-form-urlencoded`), not JSON.
  The fields are `email` and `password`. There is no CSRF token field.
- On success the server replies HTTP 200 with the body
  `{"type":"redirect","status":303,"location":"/meters"}` and sets the session cookie.
- The cookie is `__Secure-better-auth.session_token` with `Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax`.
  No token is returned in the JSON body and nothing is stored in local storage.
- The cookie is required for the protected `/portal/...` endpoints.
- A request made about 40 minutes after login did not contain a new cookie. So the session appears to have a
  fixed one-hour lifetime, although longer-term behaviour was not tested.
- Logout: the UI uses `/api/auth/sign-out`. Opening it directly in the browser showed "page not found", so it is
  probably POST-only. We did not test it further.

## 3. Behaviour When a Session Is Invalid

A request to a `/portal/...` endpoint without a valid session returns HTTP 401 with JSON:

```json
{"error":"unauthorized","message":"A valid session is required."}
```

A fabricated cookie value gives the same response. A client can therefore detect an expired session by a 401,
log in again, and retry the failed request once. If the second attempt also fails, it should report an error.

Unknown paths return an **HTML** 404 page, not JSON (we saw this by guessing `/portal/meters`).

## 4. Retrieving and Searching Meters

`GET /portal/meters/search?q=<text>&page=<n>`

```json
{"data":[{"meterId":"J100005","serialNo":"HP63682","make":"Allied","phaseType":"three",
          "installStatus":"Faulty","dtCode":"DT-006"}],
 "total":1,"page":1,"pageSize":20}
```

- The portal has 403 meters (`J100000` to `J100402`) and returns 20 per page.
- The page size cannot be changed: `pageSize` and `limit` were both ignored. A full listing takes 21 requests.
- Page 21 has three meters. Page 22 returns `"data":[]` with `total` still 403 and no error. Page 0 behaves like page 1.
- `q` is a case-insensitive partial match on meter ID and serial number only. For example, `J100005`, `j100005`
  and `100005` all find the same meter, `HP63682` (its serial number) also finds it, and `J10000` returns ten meters.
- Searching by make (`Genus`), status (`faulty`) or transformer code (`DT-021`) returned no results.
  Filtering on those fields has to be done by the client after fetching the list.
- `total` is the count after filtering.

## 5. Retrieving Energy Readings

`GET /portal/meters/{meterId}/energy`

```json
{"data":[{"timestamp":"23/06/2026 23:30","kwh":"48438.74","kvah":"52313.84","voltR":"226"},
         {"timestamp":"24/06/2026 00:00","kwh":"48439.16","kvah":"52314.29","voltR":"229"}]}
```

- Readings are 30 minutes apart. The data we saw covered about a week, 23 June to 30 June 2026.
- All numbers are **strings**. Timestamps are `DD/MM/YYYY HH:MM` with no timezone.
- `kwh` and `kvah` are **cumulative** meter readings (they only go up), not consumption per interval.
  Interval consumption is the current reading minus the previous one. In the example above,
  48439.16 - 48438.74 = 0.42 kWh.
- Different meters start at different totals (about 48,438 kWh for `J100000`, about 6,850 kWh for another meter).
- The latest readings are from June 2026, months before the date we tested. We did not test a date or
  date-range parameter.

## 6. Meter Details and Network Hierarchy

`GET /meters/{meterId}/__data.json?x-sveltekit-invalidated=001`

The response includes serial number, make, phase type, installation status, installation type, and the
meter's position in the network:

**Zone → Circle → Division → Subdivision → Substation → Feeder → Distribution Transformer (DT) → Meter**

For `J100002` this is Jaipur Zone 3 (Z-03), Circle 3 (C-03), Division 3 (D-03), Subdivision 3 (SD-03),
Substation 3 (SS-03), Feeder 3 (F-003) and Vaishali DT 3 (`DT-003`). The DT code matches the `dtCode` in the meter list.

Things to know:

- The response uses SvelteKit's compact serialized format. It contains a flat `data` array, and numbers inside the
  objects are **positions in that array**, not values. It must be decoded before use.
- The details come as `{"parameterName": ..., "parameterValue": ...}` pairs, not one plain object.
- Each hierarchy value contains its code in brackets, for example `"Feeder 3 (F-003)"`.
- The first two entries in `nodes` are `{"type":"skip"}`; the data is in the last node.
- Without the `x-sveltekit-invalidated=001` parameter, the response also includes a layout node with the
  logged-in user's name and email.
- The hierarchy is only available **per meter**. We found no endpoint that returns the whole tree, so building it means
  requesting all 403 meters.
- For an unknown meter ID the data contains an error node instead:
  `{"type":"error","error":{"message":"Meter not found"},"status":404}`.
  The outer HTTP status for this case was not checked.

## 7. Data Inconsistencies and Other Observations

- **Duplicate transformer code:** `DT-007` appears with two names: `Sanganer DT 7` (meter `J100006`) and
  `Old Malviya Nagar Xfmr` (meter `J100400`). Everything above it in the hierarchy is identical (Zone 1, Circle 1,
  Division 7, Subdivision 7, Substation 7, Feeder 7). The code is a more reliable identifier than the name.
- **The last three meters:** `J100400`, `J100401` and `J100402` are all Genus three-phase meters with serial
  numbers beginning `GN`, and all use `DT-007`. In the first 400 meters we looked at, each meter had its own
  `dtCode`. These three look different from the rest.
- **Decommissioned meters with readings:** `J100000` is marked `Decommissioned` but still has a week of
  energy readings.
- **Serial numbers** do not follow one format and can contain special characters, such as `L&84997`.
- **Installation status** values seen: `Installed`, `Faulty`, `Decommissioned`.
- **Installation type** values seen: `CT Operated`, `Whole Current`.

The data should be validated before it is used for reporting.

## 8. Security Observation

We requested the detail endpoint for `J100002` **without any session cookie** and received HTTP 200 with the
meter's details and hierarchy. The `/portal/...` endpoints return 401 in the same situation.

One possible explanation is that the login check is skipped when the `x-sveltekit-invalidated=001` parameter
is used. This is a guess; the cause was not established.

We did not explore this further, and our service does not use it. It logs in with the provided credentials
and sends the session cookie like a normal user. This should be reported to the portal owners so they can
verify it. We shouldn't assume the endpoint is intentionally public.

## 9. Areas Not Tested

- The HTTP method of the logout request.
- Whether the session can be refreshed under other circumstances, or over a longer period.
- Date or date-range parameters on the energy endpoint.
- Whether energy readings differ for three-phase, faulty or decommissioned meters.
- Whether any meter has missing hierarchy levels.
- How the detail endpoint behaves with an expired (rather than missing) session.
- The outer HTTP status for an unknown meter on the detail endpoint.

## 10. Implications for the API Design

- Log in on first use; on a 401, log in again once and retry once.
- List all meters by looping over pages until a page is empty or `total` items have been collected.
- Filter by make, status, phase type or transformer in our own code, since the portal's search can't.
- Decode the compact detail format, and split names from the codes in brackets.
- Convert number strings to numbers and timestamps to ISO-8601, and compute interval consumption from the cumulative readings.
- Treat the DT code, not the name, as the identity of a transformer.
