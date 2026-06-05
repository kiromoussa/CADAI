# Agent 2 — APS (Autodesk Platform Services) Integration

**Dependency:** Agent 1 (needs Supabase client). Can run in parallel after Agent 1 completes schema.

## Task

Implement the full APS OAuth flow, Model Derivative translation, property extraction, and thumbnail generation.

---

## Research update: prefer `aps-toolkit` for property extraction

The raw Model Derivative `/properties?forceget=true` endpoint works but is slow and paginated on large Revit models. **[aps-toolkit](https://github.com/chuongmep/aps-toolkit)** (Python, by chuongmep) is the recommended **primary path** for property extraction; keep raw MD calls as a fallback.

### Why aps-toolkit

| Capability | Raw Model Derivative API | aps-toolkit |
|---|---|---|
| Property DB access | Paginated REST, manual tree walk | Direct SQLite property DB query |
| Category filtering | Manual parse | `get_data_by_category("Rooms")` etc. |
| Export formats | JSON only | CSV, Excel, Parquet, JSON |
| Offline / local SVF | Not supported | `PropDbReaderRevit.read_from_resource(path)` |
| Auth helpers | Roll your own | Built-in 2-leg and 3-leg OAuth |

### Recommended architecture

```
Next.js API route (/api/aps/properties)
        │
        ▼
Python microservice OR serverless function (aps-toolkit)
        │
        ├── PropDbReaderRevit(urn, token)
        │     └── get_data_by_category("Rooms" | "Windows" | "Doors" | "Stairs" | "Walls")
        │
        └── Returns structured JSON → same ExtractedProperties schema as below
```

**Deployment options:**

1. **Sidecar Python service** — FastAPI wrapper around `aps-toolkit`, called from Next.js via internal HTTP. Best for production.
2. **Vercel Python function** — Single `/api/aps/extract` route using `aps-toolkit` if cold-start latency is acceptable.
3. **Fallback** — If Python service unavailable, fall back to raw MD `/properties` endpoint (implement in `lib/aps/modelDerivative.ts`).

### aps-toolkit quick start

```bash
pip install aps-toolkit --upgrade
```

```python
from aps_toolkit import Auth, PropDbReaderRevit

auth = Auth()
token = auth.auth2leg()  # or pass user's 3-legged token from Supabase profiles

urn = "<base64-encoded derivative URN>"
reader = PropDbReaderRevit(urn, token)

rooms = reader.get_data_by_category("Rooms")
windows = reader.get_data_by_category("Windows")
doors = reader.get_data_by_category("Doors")
stairs = reader.get_data_by_category("Stairs")
walls = reader.get_data_by_category("Walls")
```

For offline / already-downloaded SVF:

```python
prop = PropDbReaderRevit.read_from_resource("<path_to_svf>")
categories = prop.get_all_categories()
```

### Node.js alternative (see appendix)

If you want to stay in Node.js without Python, see [appendix-offline-parsing.md](./appendix-offline-parsing.md) for `svf-utils` / `forge-convert-utils` — downloads the property SQLite DB directly from the manifest.

---

## lib/aps/auth.ts

Full 3-legged OAuth implementation:

- `getAuthUrl()` — builds the Autodesk OAuth URL with scope `data:read data:write data:create bucket:read`
- `exchangeCode(code: string)` — POST to `https://developer.api.autodesk.com/authentication/v2/token` with grant_type `authorization_code`
- `refreshToken(refreshToken: string)` — POST same endpoint with grant_type `refresh_token`
- `getValidToken(userId: string)` — checks Supabase profiles table for stored token, refreshes if expired (check `aps_token_expires_at`), returns valid access token
- Store tokens in `profiles.aps_access_token`, `profiles.aps_refresh_token`, `profiles.aps_token_expires_at`

APS OAuth endpoints:

- Auth URL: `https://developer.api.autodesk.com/authentication/v2/authorize`
- Token URL: `https://developer.api.autodesk.com/authentication/v2/token`
- Scopes: `data:read data:write data:create bucket:read`

## app/api/aps/auth/route.ts

Handle the OAuth callback:

1. Extract `code` from query params
2. Call `exchangeCode(code)`
3. Store tokens in Supabase `profiles` table for the authenticated user
4. Redirect to `/dashboard`

## app/api/aps/token/route.ts

GET endpoint — returns a valid APS token for the current user (used by Forge Viewer on the frontend). Calls `getValidToken(userId)`. Returns `{ access_token, expires_in }`.

## app/api/aps/models/route.ts

GET endpoint — lists the user's Autodesk hubs and projects:

1. Call `GET https://developer.api.autodesk.com/project/v1/hubs` with Bearer token
2. For each hub, call `GET /project/v1/hubs/:hub_id/projects`
3. Return flat list of `{ hub_id, project_id, project_name, hub_name }`

## app/api/aps/translate/route.ts

POST endpoint — triggers Model Derivative translation of a Revit/DWG file:

1. Accept `{ item_id, version_id, project_id }` in body
2. Base64url-encode the version URN
3. POST to `https://developer.api.autodesk.com/modelderivative/v2/designdata/job` with:

```json
{
  "input": { "urn": "<base64url-encoded-urn>" },
  "output": {
    "formats": [
      { "type": "svf2", "views": ["2d", "3d"] },
      { "type": "thumbnail", "advanced": { "width": 400, "height": 400 } }
    ]
  }
}
```

4. Store the URN in `projects.aps_urn`, set `translation_status = 'processing'`
5. Return `{ urn, status }`

## app/api/aps/properties/route.ts

GET endpoint — extracts the property database from a translated model.

**Primary implementation:** call the aps-toolkit Python service (see above).

**Fallback implementation (raw MD):**

1. Accept `urn` as query param
2. GET `https://developer.api.autodesk.com/modelderivative/v2/designdata/:urn/metadata` — get the `guid` of the 3D view
3. GET `https://developer.api.autodesk.com/modelderivative/v2/designdata/:urn/metadata/:guid/properties?forceget=true` — get ALL properties
4. Parse into structured object:

```typescript
{
  rooms: Array<{
    dbId: number,
    name: string,
    area: number,         // sq ft
    height: number,       // ft
    level: string,
    windows: Array<{ dbId, width, height, area }>,
    doors: Array<{ dbId, width, height }>
  }>,
  windows: Array<{ dbId, name, width, height, sillHeight, level }>,
  doors: Array<{ dbId, name, width, height, level }>,
  stairs: Array<{ dbId, name, riserHeight, treadDepth, width }>,
  walls: Array<{ dbId, name, fireRating, thickness }>,
  project: {
    name: string,
    address: string,
    city: string,
    state: string,
    buildingType: string,
    totalArea: number
  }
}
```

5. Use Revit category names: rooms = `"Rooms"`, windows = `"Windows"`, doors = `"Doors"`, stairs = `"Stairs"`, walls = `"Walls"`

## app/api/aps/thumbnail/route.ts

GET endpoint:

1. Accept `urn` as query param
2. GET `https://developer.api.autodesk.com/modelderivative/v2/designdata/:urn/thumbnail?width=400&height=400`
3. Upload the image to Supabase Storage bucket `analysis-thumbnails`
4. Return the public URL of the stored image

## lib/aps/modelDerivative.ts

Helper functions used by the API routes. All functions accept a `token: string` parameter. Export:

- `getMetadata(urn, token)` — returns model views
- `getProperties(urn, guid, token)` — returns raw property tree (**fallback path only**)
- `parseProperties(rawProps)` — transforms raw APS property tree into structured object
- `checkTranslationStatus(urn, token)` — polls translation status
- `getThumbnail(urn, token)` — returns image buffer

## lib/aps/extractProperties.py (new — aps-toolkit wrapper)

Optional FastAPI microservice or script:

```python
# services/aps-extract/main.py
from fastapi import FastAPI
from aps_toolkit import PropDbReaderRevit

app = FastAPI()

@app.get("/extract")
def extract(urn: str, token: str):
    reader = PropDbReaderRevit(urn, token)
    return {
        "rooms": reader.get_data_by_category("Rooms").to_dict(),
        "windows": reader.get_data_by_category("Windows").to_dict(),
        "doors": reader.get_data_by_category("Doors").to_dict(),
        "stairs": reader.get_data_by_category("Stairs").to_dict(),
        "walls": reader.get_data_by_category("Walls").to_dict(),
    }
```

Add `services/aps-extract/requirements.txt`:

```
aps-toolkit>=1.0.7
fastapi
uvicorn
```
