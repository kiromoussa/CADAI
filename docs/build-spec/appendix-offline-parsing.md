# Appendix — Offline Property DB Parsing (Node.js)

Not in the original build prompt. Use when you want property extraction **entirely in Node.js** without a Python sidecar, or for **offline/batch processing** of already-translated models.

---

## svf-utils (recommended Node.js option)

**Repo:** [petrbroz/svf-utils](https://github.com/petrbroz/svf-utils)  
**npm:** `svf-utils` (v8.x)

Downloads SVF assets from a Model Derivative URN and automatically fetches the **property SQLite database** (`properties.sqlite`) from the manifest asset with role `Autodesk.CloudPlatform.PropertyDatabase`.

### Install

```bash
npm install svf-utils
```

### CLI — download properties from URN

```bash
export APS_CLIENT_ID=...
export APS_CLIENT_SECRET=...
# or: export APS_ACCESS_TOKEN=...

npx svf-to-gltf <urn> --output ./output
# properties.sqlite lands in ./output/
```

### Programmatic — query SQLite directly

```javascript
import { ModelDerivativeClient, ManifestHelper } from 'svf-utils';
import fs from 'fs';

const client = new ModelDerivativeClient({ token });
const manifest = await client.getManifest(urn);
const helper = new ManifestHelper(manifest);

const pdbAssets = helper.search({
  type: 'resource',
  role: 'Autodesk.CloudPlatform.PropertyDatabase',
});

if (pdbAssets.length > 0) {
  const stream = client.getDerivativeChunked(urn, pdbAssets[0].urn, 1 << 20);
  stream.pipe(fs.createWriteStream('./properties.sqlite'));
}
```

### Example SQL query (EAV schema)

The property DB uses Entity-Attribute-Value tables documented in [propertyServer/pipeline.md](https://github.com/wallabyway/propertyServer/blob/master/pipeline.md):

```sql
SELECT
  _objects_id.id AS dbId,
  _objects_id.external_id AS externalId,
  _objects_attr.name AS propName,
  _objects_val.value AS propValue
FROM _objects_eav
  INNER JOIN _objects_id ON _objects_eav.entity_id = _objects_id.id
  INNER JOIN _objects_attr ON _objects_eav.attribute_id = _objects_attr.id
  INNER JOIN _objects_val ON _objects_eav.value_id = _objects_val.id
WHERE propName = 'Area'
  AND _objects_id.id IN (SELECT id FROM _objects_id WHERE /* room dbIds */);
```

Use `better-sqlite3` or `sql.js` in Node to run queries and map results to the same `ExtractedProperties` schema used by aps-toolkit.

---

## forge-convert-utils (legacy alternative)

**Repo:** [sensat/forge-convert-utils](https://github.com/sensat/forge-convert-utils)  
**npm:** `forge-convert-utils` (v4.x)

Same property DB download pattern as `svf-utils` but older API surface. Prefer `svf-utils` for new code; use `forge-convert-utils` only if already integrated.

```javascript
const pdbDerivatives = manifestHelper.search({
  type: 'resource',
  role: 'Autodesk.CloudPlatform.PropertyDatabase',
});
const databaseStream = modelDerivativeClient.getDerivativeChunked(
  urn, pdbDerivatives[0].urn, 1 << 20
);
databaseStream.pipe(fs.createWriteStream('./properties.sdb'));
```

---

## forge-props-service (fallback when SQLite generation fails)

**Repo:** [petrbroz/forge-props-service](https://github.com/petrbroz/forge-props-service)

Model Derivative sometimes fails to generate the SQLite property DB on very large/complex models. This microservice downloads the raw `_objects_*.json.gz` property files instead and converts them to SQLite locally.

```bash
# Convert from Forge URN
export APS_CLIENT_ID=... APS_CLIENT_SECRET=...
node bin/convert-forge.js <urn> ./properties.sqlite

# Convert from local json.gz folder
node bin/convert-local.js ./json-gz-folder ./properties.sqlite
```

Exposes `GET /:urn/properties?q=<sql>` for custom queries.

---

## SVF vs SVF2 caveat

These tools target **SVF** (v1) property databases. If translation uses **SVF2** (`"type": "svf2"` in translate job), property DB caching behavior differs — SVF2 does not permit the same client-side property DB download pattern. Options:

1. Request **both** SVF and SVF2 in translate job (SVF for properties, SVF2 for viewer)
2. Use aps-toolkit Python path which handles both via cloud API
3. Use raw MD `/properties?forceget=true` REST endpoint as fallback

---

## When to use which tool

| Tool | Language | Best for |
|---|---|---|
| **aps-toolkit** | Python | Primary — fastest category extraction, pandas export |
| **svf-utils** | Node.js | Stay in JS stack, SQLite SQL queries |
| **forge-convert-utils** | Node.js | Legacy Node projects only |
| **forge-props-service** | Node.js | Large models where MD SQLite gen fails |
| **Raw MD REST** | Any | Last-resort fallback, small models |
