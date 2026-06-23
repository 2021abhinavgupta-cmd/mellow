# Mellow — Product Plan

---

## Indian Market — Core Design Principle

**Primary audience: Indian users.** Every recommendation must reflect Indian skin tones, tastes, culture, and lifestyle. Western colour analysis frameworks are biased toward light/fair skin — the AI prompt and all guidance must be tuned for South Asian reality.

### Indian Skin Tones

Most Indians: Fitzpatrick Type III–V (medium to deep).

| Skin depth | Common undertone | Most likely season |
|---|---|---|
| Fair (Type II–III) | Warm golden, neutral | True Spring, Soft Summer |
| Wheatish (Type III–IV) | Warm golden, olive | Soft Autumn, True Autumn |
| Medium (Type IV) | Warm/neutral, olive | Deep Autumn, Warm Autumn |
| Dusky (Type IV–V) | Warm deep, neutral | Deep Winter, True Winter |
| Deep (Type V–VI) | Cool deep, warm deep | Deep Winter, Dark Autumn |

**GPT-4o prompt must explicitly:**
- Recognise olive/golden undertones as warm (not neutral)
- Avoid labelling medium-deep Indian skin as "Summer" (cool) unless truly so
- Never recommend pastels/light neutrals as "best colours" for deep skin — jewel tones and earth tones win
- Acknowledge that Indian skin rarely matches European Spring/Light Summer archetypes

### Colours Indians Look Best In

**Warm/Olive skin (most common):**
- Jewel tones: emerald, ruby red, royal blue, deep teal, mustard
- Earth tones: terracotta, burnt orange, warm brown, camel
- Rich metallics: gold, bronze, copper
- Avoid: dusty pastels, cool greys, icy pinks

**Deep/Cool-toned skin:**
- Bold saturated: electric blue, fuchsia, deep plum, wine red
- Stark contrasts: ivory + black, white + deep jewel
- Rich metallics: silver works here (unlike warm skin)
- Avoid: beige, camel, muted earth tones

### Indian Fashion Context

Outfit recommendations must include **Indian clothing categories** alongside Western:

| Occasion | Indian | Western |
|---|---|---|
| Everyday | Kurta + leggings/jeans, salwar kameez, co-ords | T-shirt, jeans, casual dresses |
| Office | Formal kurta, saree (silk/cotton), salwar suit, indo-western | Blazer, trousers, shirt dresses |
| Occasions/Festive | Saree, lehenga, anarkali, sharara, indo-western gown | Evening gown, cocktail dress |

Style page **must show Indian occasion wear** — not just Western office/casual/occasions framing.

### Indian Jewellery

Gold dominates Indian jewellery culture — silver is secondary. AI must recommend gold first for warm/olive skin.

| Face shape | Indian earring | Indian necklace | Western equivalent |
|---|---|---|---|
| Round | Jhumkas (long drop), chandbali | Long Rani haar | Drop earrings, long chain |
| Square | Hoops, round jhumka | Short choker (Kundan) | Round/hoop |
| Oval | Any — temple jewellery, layered | Any | Any |
| Heart | Chandbali, drop | Mid-length chain, pendant | Drop, pendant |
| Long | Stud, cluster, wide hoops | Statement Hasli, collar | Cluster stud, collar necklace |
| Diamond | Curved jhumka | Mid-length pendant | Curved drop |

**Indian jewellery types to know:**
- Jhumka — bell-shaped drop earring
- Chandbali — crescent moon shaped
- Maang tikka — forehead piece
- Rani haar — long gold necklace
- Hasli — rigid collar necklace
- Kundan — gemstone-set gold
- Meenakari — enamel-painted gold
- Oxidised silver — popular for casual/boho

### Indian Makeup Specifics

| Category | Indian consideration |
|---|---|
| Foundation | Warm undertone shades: NC30–NC50 range. Never recommend light/fair shades. |
| Kajal/Kohl | Staple for all Indian women — always include in eye makeup section |
| Bindi | Mention for traditional looks |
| Lips | Bold reds, burgundy, plum, deep coral are culturally loved. Nudes must be warm-toned (peach/caramel) not cool pink |
| Blush | Warm peach/terracotta/berry — not cool-toned pinks for most skin tones |
| Highlight | Gold highlight > champagne > silver (for warm skin) |

### Indian Hair

- Predominantly dark: black or dark brown (natural)
- Texture: straight to wavy most common, thick-medium density
- Oiling culture: coconut, almond, castor — mention as scalp health tip
- Braid styles culturally significant: French braid, fishtail, traditional plait with gajra (flower string) for occasions
- Hair colour: highlights, balayage increasingly popular — recommend warm tones (copper, caramel, chocolate) for Indian skin

### Indian Body Type Reality

- Average Indian woman height: 5'0"–5'4" — petite proportions matter
- Pear shape most common (wider hips, narrow shoulders)
- Apple shape common post-30 (midsection weight)
- Petite tips must be included: avoid ankle-breaking wide hems, prefer cropped styles, high-waist always flatters

### Language & Tone in UI

- Use familiar Indian English: "dusky" is understood positively, "wheatish" is common self-descriptor
- Mention specific fabric names Indians know: georgette, chiffon, silk, cotton, crepe, lycra, chanderi
- Occasion framing: Casual / Office / Festive (not "occasional" — that sounds foreign)
- Avoid: "Scandinavian minimalism", "French girl aesthetic" — use "understated elegance" or just describe the look

---

## Vision

Personal styling app built on two pillars:

```
STRUCTURE (what you are)     →     GROOMING (what suits you)
─────────────────────────          ──────────────────────────
Face shape                         Haircut
Body type                          Beard (men)
Colour season                      Glasses / specs
Undertone                          Jewellery
                                   Outfit cuts (jeans, trousers, tops)
                                   Necklines
                                   Makeup (women) / Skincare (men)
```

Gender-aware throughout: male and female get different recommendation sets.

---

## Current State (built)

```
app/page.tsx              Photo upload → colour analysis
app/results/page.tsx      Colour season, undertone, palette, style traits
app/results/makeup/       Eyeshadow, lipstick, blush, highlight/contour
app/results/hair/         Face shape, flattering cuts, AI-generated style images
app/results/style/        Body type, occasion tabs, outfit images, necklines
app/results/print/        Full print-friendly summary
app/api/analyze/          GPT-4o vision → full ColorAnalysis JSON
app/api/generate-visuals/ gpt-image-1 images.edit → hairstyle + outfit images
```

---

## Phase 1 — Foundation (onboarding upgrades)

### 1a. Gender toggle on landing page

- Male / Female selector before photo upload
- Stored: `localStorage.setItem("mellow_gender", "female")`
- All downstream pages read gender → show/hide sections accordingly
- Female: makeup page, jewellery, necklines, women's body types
- Male: grooming page, beard, men's glasses chart, men's body types

### 1b. Measurements input (optional)

Women: Bust / Waist / Hips (cm or inches)
Men: Chest / Waist / Hips (cm or inches)

- Unit toggle: cm / inches
- Stored: `localStorage.setItem("mellow_measurements", JSON.stringify({ bust, waist, hips, unit }))`
- Client-side body type calculator runs immediately on input
- Calculated body type overrides AI visual inference in prompt

**Body type calculation logic (women):**

```
bust, waist, hips in same unit

hipToWaist  = hips / waist
bustToWaist = bust / waist
bustToHip   = bust / hips

Hourglass:      bustToHip 0.95–1.05  AND  hipToWaist > 1.25
Pear:           hips > bust + 2  AND  defined waist
Inverted Tri:   bust > hips + 2  AND  waist less defined
Rectangle:      all within 5% of each other
Apple:          waist >= bust AND waist >= hips (or close)
Oval:           waist widest, bust and hips smaller
```

**Body type calculation logic (men):**

```
Rectangle:          chest ≈ hips, waist ≈ chest (within 5%)
Inverted Triangle:  chest > hips by 10%+, broad shoulders
Triangle:           hips > chest, narrower shoulders
Oval:               waist widest point, gut-forward
Trapezoid:          chest > waist > hips, athletic taper
```

### 1c. Face scanning via MediaPipe (optional step)

**Technology:** `@mediapipe/tasks-vision` — Google MediaPipe Face Mesh
- Free, runs entirely in browser (WebAssembly), no API cost
- 468 face landmarks from regular camera
- Used by Snapchat, Instagram filters, Google Meet — production proven

**Flow:**
```
Landing page → "Scan Face" button (optional, skippable)
  → getUserMedia opens front camera
  → MediaPipe FaceLandmarker runs live at 30fps
  → 3-second countdown → capture measurement frame
  → Extract key measurements from landmarks:
      Forehead width:   landmark 54  ↔ 284
      Cheekbone width:  landmark 234 ↔ 454
      Jaw width:        landmark 172 ↔ 397
      Face length:      landmark 10  → 152
  → Apply ratio rules → determine face shape
  → Store: localStorage.setItem("mellow_face_shape", "Oval")
  → Camera frame saved as photo for colour analysis (replaces file upload)
```

**Face shape ratio rules:**
```
length/width > 1.5                           → Long (Rectangle)
jaw ≈ forehead, clear waist, balanced        → Oval
face width ≈ length, full cheeks             → Round
face width ≈ length, strong jawline          → Square
forehead wider than jaw                      → Heart
jaw wider than forehead, narrow cheeks       → Triangle (Pear)
cheekbones widest, narrow forehead + jaw     → Diamond
```

**Install:** `npm install @mediapipe/tasks-vision`

---

## Phase 2 — New Pages

### `/results/face` (NEW)

Face shape analysis + recommendations:

**Sections:**
1. Face shape card (name + description + 3 traits)
2. Glasses / specs (frame styles that flatter)
3. Jewellery (earring, necklace, ring shapes)
4. Contouring guide (which areas to highlight/shadow)

**Glasses by face shape:**

| Face | Best frames | Avoid |
|---|---|---|
| Oval | Aviators, Wayfarer, almost all | None |
| Round | Wayfarer, Browline, Geometric, Rectangle | Round frames |
| Square | Round, Oval, Wrap | Square/geometric |
| Heart | Aviators, Wrap, light rimless | Heavy top frames |
| Long | Aviators, Wayfarer, Round, Browline | Very narrow frames |
| Diamond | Browline, Oval, Rimless | Narrow/rectangular |
| Inverted Triangle | Aviators, Wrap, wider bottom frames | Wide top frames |

**Jewellery by face shape:**

| Face | Earrings | Necklaces | Rings |
|---|---|---|---|
| Round | Long drops, angular | Long chains, pendants | Oval, marquise |
| Square | Hoops, round studs | Rounded pendants | Round, oval |
| Oval | Any — lucky | Any length | Any |
| Heart | Drop earrings, chandelier | Short chokers or long | Wider bands |
| Long | Wide/cluster studs, hoops | Chunky/statement | Bold, wide |
| Diamond | Curved/studs | Collarbone-length | Delicate |
| Inverted Tri | Drop, teardrop | Mid-length chains | Slender |

### `/results/grooming` (NEW — men only, replaces `/results/makeup` for men)

**Sections:**
1. Beard recommendations (by face shape)
2. Skincare routine (by skin type)
3. Fragrance profile (by colour season — warm/cool/fresh/woody)
4. Grooming products guide

**Beard by face shape:**

| Face | Best beard | Why |
|---|---|---|
| Round | Goatee, square beard, angular styles | Adds length, reduces width |
| Square | Circle beard, short stubble, rounded | Softens hard jaw |
| Oval | Anything — full, stubble, goatee | Natural balance |
| Heart | Full beard, chin-heavy (goatee, Balbo) | Adds width at jaw |
| Long | Full sides, mutton chops, wide styles | Reduces length appearance |
| Diamond | Goatee, Balbo — chin volume | Balances narrow chin |
| Inverted Tri | Full beard, adds jaw width | Balances wide forehead |

### `/results/style` (EXPAND existing)

Add specific garment cut recommendations beyond just "style category":

**Outfit cuts by body type (women):**

| Body | Jeans | Trousers | Tops | Dresses |
|---|---|---|---|---|
| Hourglass | Skinny, straight, high-waist | Tailored, wide-leg | Fitted, wrap, tucked | Wrap, bodycon, fit-and-flare |
| Pear | Wide leg, bootcut, flare | Palazzo, A-line | Structured shoulders, off-shoulder | A-line, fit-and-flare |
| Inverted Tri | Straight, wide leg, boyfriend | Pleated, wide leg | V-neck, soft fabrics, drape | Column, wrap |
| Rectangle | Boyfriend, flare, mom jeans | Barrel, cropped, wide | Ruffles, peplum, belted | Ruffled, tiered, belted |
| Apple | Straight, mid-rise, bootcut | Elastic waist, tapered | Empire waist, tunic, longline | Empire, A-line, wrap |
| Oval | Same as Apple | Lebar tapered, ponte | Longline, flowy | Wrap, empire, midi |

**Outfit cuts by body type (men):**

| Body | Jeans | Trousers | Shirts | Suits |
|---|---|---|---|---|
| Rectangle | Slim, straight | Ankle, slim | Fitted, layers | Single-button, slim |
| Inverted Tri | Straight, wide leg | Pleated, barrel | Loose fit, open collar | Double-breasted |
| Triangle | Bootcut, straight | Pleated, regular | Shoulder structure, boxy | Padded shoulders |
| Oval | Straight, mid-rise | Elastic waist, tapered | Longline, vertical stripes | Structured, elongating |
| Trapezoid | Slim, straight | Tailored | Fitted — anything | Classic single-button |

**Jeans + shoes pairing (from reference image):**

Sneakers:
- ✅ Slim/straight at ankle length
- ✅ Cuffed straight leg
- ❌ Pooling/dragging excess fabric

Loafers:
- ✅ Slim, straight — clean hem
- ✅ Slightly cropped
- ❌ Baggy/wide leg (too much fabric over shoe)

Sandals:
- ✅ Slim, straight, cropped
- ✅ Straight with slight break
- ❌ Wide leg, excess pooling

---

## Phase 3 — Polish

- Unit toggle (cm / inches) persisted in localStorage
- Print page updated with all new sections
- Gender-aware print page (shows beard/grooming for men, makeup for women)
- Face scan result shown as animated landmark overlay before confirming
- Body type visual diagram shown alongside calculated type

---

## Page flow (final)

```
Landing
  → Gender selection
  → [Optional] Face scan (MediaPipe)
  → [Optional] Measurements input
  → Photo upload (or captured from face scan)
  → /results (colour analysis)
  → /results/face (face shape + glasses + jewellery)
  → /results/hair (haircut + beard for men)
  → /results/makeup OR /results/grooming (gender-dependent)
  → /results/style (body type + outfit cuts)
  → /results/print (full summary)
```

---

## localStorage keys (updated)

| Key | Value |
|---|---|
| `mellow_image` | Compressed base64 JPEG |
| `mellow_analysis` | Stringified ColorAnalysis JSON |
| `mellow_gender` | `"male"` or `"female"` |
| `mellow_face_shape` | e.g. `"Oval"` — from MediaPipe scan (overrides AI guess) |
| `mellow_measurements` | `{ bust, waist, hips, unit }` JSON |
| `mellow_body_type` | e.g. `"Hourglass"` — calculated client-side from measurements |

## sessionStorage keys (updated)

| Key | Value |
|---|---|
| `mellow_hair_images` | Record<string, string\|null> — 3 hairstyle images |
| `mellow_style_images` | Record<string, string\|null> — 3 outfit images |

---

## API changes needed

### `/api/analyze` — system prompt additions

Pass gender, confirmed face shape (if scanned), confirmed body type (if measured) into the prompt so GPT-4o uses confirmed data instead of guessing.

```
Additional context for analysis:
- Gender: ${gender}
- Face shape (measured): ${faceShape ?? "infer from photo"}
- Body type (measured): ${bodyType ?? "infer from photo"}
- Measurements: ${measurements ?? "not provided"}
```

### New `ColorAnalysis` fields needed

```typescript
// In app/lib/types.ts — add:
face: {
  shape: string;                          // e.g. "Oval"
  shapeDescription: string;
  shapeTraits: string[3];
  glasses: { style: string; reason: string }[4];
  jewellery: {
    earrings: string[3];
    necklaces: string[3];
    rings: string[2];
  };
  contouring: { highlight: string[2]; contour: string[2] };
}

// Extend style for men:
style: {
  // existing fields...
  jeansCut: string[3];
  trouserCut: string[3];
  topSilhouette: string[3];
}

// New grooming for men:
grooming?: {
  beard: { style: string; description: string }[3];
  beardTip: string;
  skincare: { title: string; desc: string }[4];
  fragranceProfile: string;
}
```

---

## Build order

```
Sprint 1:  Gender toggle + measurements input on landing page
           Client-side body type calculator
           Pass gender + body type to AI prompt

Sprint 2:  MediaPipe face scan (optional camera step)
           Face shape landmark measurement
           Pass confirmed face shape to AI

Sprint 3:  /results/face page — face shape + glasses + jewellery
           Expand /results/hair — beard section for men

Sprint 4:  Expand /results/style — garment cut recommendations
           /results/grooming page (men) replacing /results/makeup

Sprint 5:  Print page update (all sections, gender-aware)
           Unit toggle, polish, edge cases
```

---

## Tech stack additions

| Addition | Package | Cost |
|---|---|---|
| Face landmark detection | `@mediapipe/tasks-vision` | Free |
| Camera access | `navigator.mediaDevices.getUserMedia` (native) | Free |
| Body type calculator | Client-side JS logic | Free |

No new API costs for face scan or body type — both run in browser.
AI cost per session unchanged (still one GPT-4o call for analysis).
