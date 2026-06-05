# Agent 3 — Code Database + Claude Analysis Engine

**Dependency:** None. Can run fully in parallel.

## Task

Build the code data layer and the Claude-powered analysis engine.

---

## Research update: ICC Code Connect API (license, don't scrape)

**Do not scrape ICC code text from the web or PDFs.** The [ICC Code Connect API](https://solutions.iccsafe.org/codeconnect) provides programmatic access to official I-Codes (2021, 2018, state adoptions, eCode360 municipal codes).

### Action required before manual curation

Apply for API access **before** manually curating code JSON files:

1. Contact ICC for licensing: **panthony@iccsafe.org**
2. Complete both agreements:
   - **Software integration agreement** (~$3k/state or $10k unlimited states annual)
   - **Content licensing agreement** (priced by employee count + titles)
3. Available content includes 2021/2018 I-Codes, NY/NJ/OH state codes, and eCode360 municipal codes

### Integration strategy

| Phase | Source | Notes |
|---|---|---|
| **Now (MVP)** | Manually curated JSON in `data/codes/` | Architect (mom's firm) validates sections; treat as seed data |
| **Post-license** | ICC Code Connect API | Replace `full_text` fields with live API lookups by section ref |
| **Hybrid** | API for text + local JSON for `requirements` + `check_type` | Keep machine-readable rule metadata local; fetch official text at runtime |

Add env vars when licensed:

```env
ICC_CODE_CONNECT_API_KEY=
ICC_CODE_CONNECT_BASE_URL=
```

Add `lib/codes/iccClient.ts`:

```typescript
// getSectionText(jurisdiction: string, section: string): Promise<string>
// — calls ICC Code Connect API once licensed
// — falls back to local JSON full_text if API unavailable
```

---

## Research update: structure codes as IDS-compatible for IfcTester

Code JSON files should be authored so they can **export to buildingSMART IDS (Information Delivery Specification) XML** and run through **[IfcTester](https://docs.ifcopenshell.org/ifctester.html)** against IFC exports from Revit.

### Why IDS + IfcTester

- **IDS** (buildingSMART standard, v1.0 approved June 2024) is the machine-readable format for BIM compliance rules
- **IfcTester** validates IFC models against IDS specs from CLI, library, or web app
- Enables a **deterministic check path** alongside Claude's probabilistic analysis
- Future path: export Revit → IFC → run IfcTester with CodeComply-generated IDS → merge results with Claude violations

### Dual output architecture

```
data/codes/*.json  ──►  lib/codes/index.ts  ──►  Claude violation analysis (existing)
        │
        └──►  lib/codes/toIds.ts  ──►  data/codes/ids/*.ids.xml
                                              │
                                              ▼
                                    IfcTester (on IFC export)
                                              │
                                              ▼
                                    Merge with Claude results
```

### Updated JSON structure (IDS-compatible)

Each section's `requirements` array maps directly to IDS `Property` / `Attribute` requirements:

```typescript
{
  jurisdiction: string,
  code_year: number,
  adopted_codes: string[],
  sections: Array<{
    section: string,          // "R310.1"
    title: string,
    applies_to: string[],     // ["residential", "adu"]

    // Official code text — seed from manual curation, later from ICC API
    full_text: string,
    summary: string,

    // Machine-readable requirements (IDS-exportable)
    requirements: Array<{
      parameter: string,      // "net_clear_opening_area"
      min_value?: number,
      max_value?: number,
      unit: string,           // "sq_ft"
      condition?: string,     // "sleeping rooms below 4th story"

      // IDS mapping fields (NEW)
      ids: {
        entity: string,       // "IFCWINDOW" | "IFCDOOR" | "IFCSPACE" | "IFCSTAIR"
        propertySet?: string, // "Pset_WindowCommon" | "Pset_DoorCommon"
        propertyName?: string,// "NetArea" | "OverallHeight"
        attributeName?: string, // alternative to propertySet/propertyName
        dataType: string,     // "IFCREAL" | "IFCLABEL" | "IFCBOOLEAN"
        cardinality: "required" | "optional",
        instructions: string  // plain English shown in IfcTester report
      }
    }>,
    check_type: "dimensional" | "presence" | "rating" | "calculated"
  }>
}
```

### Example: R310.1 EERO as IDS requirement

```json
{
  "section": "R310.1",
  "title": "Emergency Escape and Rescue Openings",
  "requirements": [
    {
      "parameter": "net_clear_opening_area",
      "min_value": 5.7,
      "unit": "sq_ft",
      "condition": "sleeping rooms below 4th story",
      "ids": {
        "entity": "IFCWINDOW",
        "propertySet": "Pset_WindowCommon",
        "propertyName": "NetArea",
        "dataType": "IFCREAL",
        "cardinality": "required",
        "instructions": "EERO net clear opening must be at least 5.7 sq ft"
      }
    },
    {
      "parameter": "sill_height",
      "max_value": 44,
      "unit": "in",
      "ids": {
        "entity": "IFCWINDOW",
        "propertyName": "SillHeight",
        "dataType": "IFCREAL",
        "cardinality": "required",
        "instructions": "EERO sill height must not exceed 44 inches"
      }
    }
  ],
  "check_type": "dimensional"
}
```

### lib/codes/toIds.ts (new)

```typescript
// exportToIds(sections: CodeSection[], jurisdiction: string): string
// — generates IDS XML from code JSON requirements
// — uses ifctester Python library or manual XML generation per buildingSMART XSD

// runIfcTester(idsPath: string, ifcPath: string): Promise<IfcTestReport>
// — spawns: python -m ifctester <ids> <ifc> -o report.json
// — parses IfcTester output into Violation[] format for merge
```

Add `services/ifc-test/requirements.txt`:

```
ifcopenshell
ifctester
```

### IfcTester CLI usage

```bash
# Validate IFC against generated IDS
python -m ifctester data/codes/ids/california_irc_2022.ids model.ifc -o report.json

# Generate IDS programmatically
python -c "
import ifctester.ids as ids
spec = ids.Specification(name='R310.1 EERO')
spec.applicability.append(ids.Entity(name='IFCWINDOW'))
spec.requirements.append(ids.Property(
    baseName='NetArea',
    propertySet='Pset_WindowCommon',
    dataType='IfcReal',
    minInclusive=5.7,
    cardinality='required',
    instructions='Min 5.7 sq ft net clear opening'
))
"
```

---

## data/codes/california_irc_2022.json

Create a curated JSON file with these exact IRC sections. Include `full_text`, `requirements` (with `ids` mapping), for each:

1. **R301.2** — Climatic and Geographic Design Criteria
2. **R302.6** — Dwelling/Garage Fire Separation
3. **R303.1** — Habitable Rooms Light (min 8% floor area)
4. **R303.3** — Habitable Rooms Ventilation (min 4% openable)
5. **R305.1** — Ceiling Height (min 7ft habitable, 6ft 8in bath/hall)
6. **R308.4** — Hazardous Locations Glazing
7. **R310.1** — Emergency Escape and Rescue Openings
8. **R311.3** — Floors and Landings at Doors
9. **R311.7.4.1** — Stair Riser Heights
10. **R311.7.4.2** — Stair Tread Depths
11. **R311.7.8** — Handrails
12. **R312.1** — Guards
13. **R313.1** — Automatic Fire Sprinkler Systems
14. **R314.3** — Smoke Alarm Location
15. **R315.1** — Carbon Monoxide Alarms

## Local amendment files

- `data/codes/los_angeles.json` — seismic D2, Title 24, ADU rules, SB 379 solar
- `data/codes/san_diego.json` — WUI zones, Climate Zone 7, ADU setbacks
- `data/codes/irvine.json` — planned community overlays, remodel sprinkler rules

## lib/codes/index.ts

```typescript
// getCodesForJurisdiction(city, state, projectType): CodeSection[]
// jurisdictionToSlug(city, state): string  — 'Los Angeles', 'CA' → 'los_angeles_ca'
// getSupportedJurisdictions(): Array<{city, state, display}>
// searchCodes(query, jurisdiction): CodeSection[]
// exportIdsForJurisdiction(city, state, projectType): string  — NEW: generate IDS XML path
```

## lib/anthropic/ (unchanged from original spec)

- `prompts.ts` — system/user prompts for PDF and violation analysis
- `analyzePDF.ts` — PDF vision extraction + violation checking via Claude
- `client.ts` — Anthropic client wrapper

## app/api/analyze/route.ts

Main analysis endpoint — POST with streaming progress.

**Updated flow for APS source:**

1. Create analysis record (`status: 'running'`)
2. Get codes for jurisdiction
3. Extract properties via aps-toolkit service (Agent 2)
4. **Optional:** if IFC export available, run IfcTester with generated IDS → deterministic violations
5. Run Claude `analyzeViolations()` with extracted properties + codes
6. **Merge** IfcTester deterministic results with Claude probabilistic results (dedupe by code_section + element)
7. Insert violations, update analysis record, stream progress

Progress stages: `'extracting'` → `'ifc-testing'` → `'analyzing'` → `'complete'`
