# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build + type check
npm run lint     # ESLint (Next.js core-web-vitals + TypeScript rules)
npm run start    # serve production build
```

No test suite configured yet.

## Stack

- **Next.js 16.2.9** (App Router, Turbopack) — read `node_modules/next/dist/docs/` before writing any Next.js code; this version has breaking changes from training data
- **React 19** — use `'use client'` directive for any component using state, effects, or browser APIs
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` in `app/globals.css`, no `tailwind.config.js`; custom tokens defined in `@theme inline {}` block
- **Framer Motion 12** — `ease` prop must be cast `as Transition` from `framer-motion`; plain `string` or `number[]` fails TypeScript
- **OpenAI SDK 6** (`openai` package) — used for GPT-4o vision in the analyze route; `@anthropic-ai/sdk` is installed but not yet wired up
- **Env** — `OPENAI_API_KEY` must be in `.env.local` (not `.env.local.example`); Next.js only loads `.env.local`

## Architecture

```
app/
  layout.tsx              # Root layout: Cormorant_Garamond + DM_Sans via next/font/google
  globals.css             # Tailwind v4 @theme inline — defines color + font tokens
  lib/
    types.ts              # Shared TypeScript interfaces: ColorAnalysis, NamedSwatch
  page.tsx                # Landing page (client): drag-and-drop upload, canvas compression → localStorage → /results
  api/
    analyze/
      route.ts            # POST handler: receives image data URL, calls GPT-4o vision, returns ColorAnalysis JSON
    generate-visuals/
      route.ts            # POST handler: takes photo + prompts[], calls gpt-image-1 images.edit, returns generated images
  results/
    page.tsx              # Colour Analysis page: season, undertone, best colors, palette, style guide
    makeup/
      page.tsx            # Makeup Analysis page: eyeshadow, lipstick, blush, highlight/contour, skin tips, complete look
    hair/
      page.tsx            # Hair Styles page: face shape, most flattering cuts with AI images, bangs/updos, tips, hair goal
    style/
      page.tsx            # Style Guide page: body type, occasion tabs with AI outfit images, necklines, prints, outfit formula
    face/
      page.tsx            # PLANNED Sprint 3: face shape card, glasses/specs recs, jewellery by face shape
    grooming/
      page.tsx            # PLANNED Sprint 4: men only — beard styles, skincare, fragrance (replaces makeup for men)
```

### Full data flow

```
User selects photo (page.tsx)
  → FileReader.readAsDataURL
  → canvas compression: resize to max 1024px, export JPEG at 0.82 quality (~150–300KB)
  → localStorage.setItem("mellow_image", compressedDataUrl)
  → localStorage.removeItem("mellow_analysis")   � clears any cached result from previous photo
  → sessionStorage.removeItem("mellow_hair_images")  � clears AI-generated hair visuals
  → sessionStorage.removeItem("mellow_style_images") � clears AI-generated outfit visuals
  → router.push("/results")

/results mounts
  → reads mellow_image from localStorage
  → checks mellow_analysis in localStorage (cache hit → skip API call)
  → on cache miss: POST /api/analyze { imageDataUrl }
  → stores result: localStorage.setItem("mellow_analysis", JSON.stringify(data))
  → renders colour analysis UI
  → "Your Makeup Analysis →" CTA navigates to /results/makeup

/results/makeup mounts
  → reads mellow_image + mellow_analysis from localStorage (always cache hit)
  → renders makeup analysis UI
  → "� Colour Analysis" nav back to /results
  → "Your Hair Styles →" CTA navigates to /results/hair

/results/hair mounts
  → reads mellow_image + mellow_analysis from localStorage (always cache hit)
  → checks sessionStorage "mellow_hair_images" (cache hit → skip generation)
  → on cache miss: POST /api/generate-visuals with 3 hairstyle prompts
  → stores: sessionStorage.setItem("mellow_hair_images", JSON.stringify(map))
  → renders hair analysis UI with AI-generated style images
  → "� Makeup" nav back to /results/makeup
  → "Your Style Guide →" CTA navigates to /results/style

/results/style mounts
  → reads mellow_image + mellow_analysis from localStorage (always cache hit)
  → checks sessionStorage "mellow_style_images" (cache hit → skip generation)
  → on cache miss: POST /api/generate-visuals with 3 outfit prompts (everyday/office/occasions)
  → stores: sessionStorage.setItem("mellow_style_images", JSON.stringify(map))
  → renders style guide UI with AI-generated outfit images per tab
  → "� Hair Styles" nav back to /results/hair

Route handler (app/api/analyze/route.ts)
  → GPT-4o vision (gpt-4o, response_format: json_object, max_tokens: 5000)
  → returns full ColorAnalysis JSON (colour + makeup + hair + style in one call)

Route handler (app/api/generate-visuals/route.ts)
  → gpt-image-1 images.edit (parallel Promise.allSettled for all prompts)
  → each prompt applies new hairstyle/outfit to the user's actual photo
  → returns { images: { key, imageData }[] } — base64 PNG data URLs
  → individual failures are non-fatal (null imageData, text content still shown)
```

### localStorage keys

| Key | Value | Cleared when |
|---|---|---|
| `mellow_image` | Compressed base64 JPEG data URL | User uploads new photo |
| `mellow_analysis` | Stringified `ColorAnalysis` JSON | User uploads new photo |
| `mellow_gender` | `"male"` or `"female"` | User uploads new photo |
| `mellow_face_shape` | e.g. `"Oval"` — from MediaPipe landmark scan | User uploads new photo |
| `mellow_skin_tone` | `SkinToneResult` JSON — ITA, Fitzpatrick, Monk, hex, LAB | User uploads new photo |

Planned additions (not yet built):

| Key | Value | Sprint |
|---|---|---|
| `mellow_measurements` | `{ bust, waist, hips, unit }` JSON | Sprint 1 |
| `mellow_body_type` | e.g. `"Hourglass"` — calculated client-side from measurements | Sprint 1 |

### sessionStorage keys

| Key | Value | Cleared when |
|---|---|---|
| `mellow_hair_images` | `Record<string, string\|null>` — key→base64 PNG map for 3 hair style images | User uploads new photo |
| `mellow_style_images` | `Record<string, string\|null>` — key→base64 PNG map for 3 outfit images | User uploads new photo |

sessionStorage survives client-side navigation but resets on tab close. Used for visual image cache to avoid expensive regeneration on back-navigation within a session.

### Image compression (why it exists)

localStorage quota is ~5MB per origin. Raw camera JPEGs passed through `FileReader` are 5–15MB as base64. The canvas compression step (max 1024px, JPEG 0.82) is mandatory — skipping it causes a `QuotaExceededError` on `localStorage.setItem`.

### OpenAI client

Lazy-initialised inside `getClient()` in `route.ts` — not at module level — to avoid build-time crashes when `OPENAI_API_KEY` is undefined during static page generation.

### Visual generation (generate-visuals route)

Uses `gpt-image-1` `images.edit` to apply new hairstyles/outfits to the user's actual photo. Key details:

- `toFile` from `"openai"` converts the base64 JPEG buffer to an Uploadable accepted by the SDK
- Runs prompts in parallel via `Promise.allSettled` — individual failures return `{ key, imageData: null }` and are non-fatal
- Hair page generates 3 images (first 3 of `mostFlattering` styles); style page generates 3 (one per occasion tab)
- Response `b64_json` → stored as `data:image/png;base64,...` data URLs
- Text content (descriptions, swatches, tips) always visible; images are enhancement layer only
- Prompts instruct the model to preserve face/skin/features and change only hair/outfit
- Falls back to Gemini (`gemini-2.5-flash-image` via v1beta) if OpenAI fails or `OPENAI_API_KEY` absent; requires `GEMINI_API_KEY` in `.env.local`

## Target Audience

Primary users are **Indian women**. All AI prompts and recommendations must reflect:
- Indian skin tones (Fitzpatrick III–V; warm/olive undertones dominant)
- 12-season framework biased toward Deep Winter, Soft/True/Deep Autumn — not Spring/Light Summer
- Indian clothing: kurta, salwar, saree, lehenga alongside Western wear
- Gold jewellery first (warm skin dominant); Indian types: jhumka, chandbali, Rani haar, Kundan
- Kajal as staple makeup item; bold lip colours (red, plum, burgundy) culturally preferred
- Warm-toned nude lips (peach/caramel), not cool pink
- Average height 5'0"–5'4" — petite proportions affect outfit cut recommendations

See `PRODUCT_PLAN.md` for full Indian market spec and complete product roadmap.

## Colour Analysis Logic

### What the AI receives

Compressed image data URL sent to GPT-4o as `image_url` content block with `detail: "high"`. No CV library, no pixel sampling — GPT-4o performs all visual analysis.

### What GPT-4o looks at

- **Skin tone** — depth (light/medium/deep) and surface warmth
- **Undertone** — warm (golden/peachy), cool (pink/blue), or neutral
- **Eye colour** — hue and clarity
- **Hair colour** — natural depth and warmth
- **Face shape** — geometry inferred from photo for hair analysis
- **Body proportions** — silhouette inferred for style guide

### Framework: seasonal colour theory

Results use **4-season / 12-season colour theory** (Soft Autumn, Deep Winter, True Spring, etc.). Each season maps to a palette harmonising with the person's contrast level, saturation tolerance, and warm/cool balance.

### Colour fields returned

| Field | Type | Purpose |
|---|---|---|
| `season` | string | e.g. "Soft Autumn" |
| `seasonDescription` | string | 2–3 sentences on what makes this season unique |
| `undertone` | string | e.g. "Warm Neutral" |
| `undertoneDescription` | string | Explains their specific undertone |
| `descriptors` | string[5] | One-word palette qualities |
| `bestColors` | string[15] | Hex codes — 3 rows of 5, most flattering |
| `bestColorsNote` | string | Why these colours work for them |
| `avoidColors` | string[8] | Hex codes to avoid |
| `bestNeutrals` | string[5] | Wardrobe base tones |
| `seasonalPalette` | string[24] | Full seasonal palette, 3 rows of 8 |
| `whatWorksWell` | string[4] | Specific reasons why their season's qualities work |
| `traits` | string[3] | **Perception descriptors** — how their colouring reads to others (e.g. "High contrast", "Striking features"). Not style advice. Displayed under "How Your Colouring Reads" heading |
| `enhances` / `avoid` / `styleTips` | string[3] each | Actionable style guidance |

### Makeup fields returned

All under `makeup` object, displayed on `/results/makeup`:

| Field | Content |
|---|---|
| `makeup.eyeshadow.matte` | 3 `NamedSwatch` — named matte eyeshadow shades |
| `makeup.eyeshadow.shimmer` | 3 `NamedSwatch` — named shimmer shades |
| `makeup.eyeshadow.tip` | Eye-specific guidance |
| `makeup.lipstick.nudes` | 4 `NamedSwatch` — nude lip colours |
| `makeup.lipstick.pinksAndRoses` | 4 `NamedSwatch` |
| `makeup.lipstick.coralsAndBrowns` | 4 `NamedSwatch` |
| `makeup.lipstick.tip` | Which family flatters most |
| `makeup.blush.shades` | 3 `NamedSwatch` |
| `makeup.blush.tip` | Placement/shade guidance |
| `makeup.highlightAndContour.highlight` | 3 hex codes |
| `makeup.highlightAndContour.contour` | 2 hex codes |
| `skinTips` | 4 `{ title, desc }` — skin-type specific makeup tips |
| `completeLook` | `{ eyes, lips, blush, highlight }` — plain-English look recipe |

`NamedSwatch = { name: string; hex: string }` — defined in `app/lib/types.ts`.

### Hair fields returned

All under `hair` object, displayed on `/results/hair`:

| Field | Content |
|---|---|
| `hair.faceShape` | e.g. "Oval" — inferred from photo geometry |
| `hair.faceShapeDescription` | 1–2 sentences on what defines this shape |
| `hair.faceShapeTraits` | string[3] — short trait labels e.g. "Softens Face" |
| `hair.mostFlattering` | `{ name, description }[4]` — top hairstyle picks |
| `hair.otherOptions` | string[4] — additional suitable styles |
| `hair.bangs` | string[2] — bang styles that work |
| `hair.updos` | string[3] — flattering updo options |
| `hair.bestParting` | e.g. "Deep Side Part" |
| `hair.tips` | string[4] — practical hair tips |
| `hair.goal` | e.g. "Soft, Voluminous & Framed" |
| `hair.observedHairType` | e.g. "Wavy, Medium Density" — AI observation |

### Style Guide fields returned

All under `style` object, displayed on `/results/style`:

| Field | Content |
|---|---|
| `style.bodyType` | e.g. "Pear (Triangle)" |
| `style.bodyTypeDescription` | 1–2 sentences on key characteristics |
| `style.keyFeatures` | string[4] — key body proportions |
| `style.whatFlattens` | string[4] — silhouettes/fits that flatter |
| `style.everyday` | `{ bestStyles: string[4], bestColors: string[5] }` |
| `style.office` | `{ bestStyles: string[4], bestColors: string[5] }` |
| `style.occasional` | `{ bestStyles: string[4], bestColors: string[5] }` |
| `style.necklines` | string[4] — flattering neckline types |
| `style.prints` | `{ name, tip }[3]` — print recommendations |
| `style.fabrics` | string[3] — flattering fabric types |
| `style.avoid` | string[4] — what to avoid and why |
| `style.outfitFormula` | Single string: the go-to outfit template |
| `style.quickTips` | string[3] — practical style tips |

The style page renders outfit categories (`everyday`/`office`/`occasional`) in a tab switcher with per-category styles + color swatches.

### Known AI output quirk — duplicate hex codes

GPT-4o occasionally returns the same hex value twice in colour arrays (e.g. `#A52A2A` appearing twice in `bestColors`). Using `hex` as the React `key` prop on those elements triggers React's duplicate-key warning and can cause rendering bugs.

**Rule:** never use a bare hex string as a React `key`. Always use a positional key that includes the array index, e.g. `key={\`bc-${ri}-${ci}\`}` for nested maps or `key={\`bn-${i}\`}` for flat maps.

### Extending the analysis

Adding new sub-pages:
1. Add new fields to the system prompt JSON schema in `route.ts`
2. Add them to `ColorAnalysis` in `app/lib/types.ts`
3. Increase `max_tokens` if needed (currently 5000)
4. Create `app/results/<name>/page.tsx` — reads `mellow_analysis` from localStorage (cache hit, no extra API call)
5. Add CTA button on the preceding page and back-nav on the new page

## FaceScanner (`app/components/FaceScanner.tsx`)

MediaPipe FaceLandmarker-based scanner. Timing constants control scan duration — tune these to require full rotation like Face ID:

| Constant | Value | Effect |
|---|---|---|
| `N_SEGS` | `8` | Coverage ring divided into 8 arc segments |
| `SEG_REQUIRED_MS` | `1400` | Milliseconds of dwell required per segment (device-framerate independent) |
| `INIT_REQUIRED_MS` | `3000` | Milliseconds of frontal hold before rotation phase |
| `MIN_COVERED` | `7` | Segments required to complete (7/8 = ~315°) |

Timing is **time-based** (ms), not frame-based — works correctly at 30fps, 60fps, or 120fps.

Measurements accumulate **only when face is frontal** (`|yaw| < 0.10 && |pitch| < 0.12`) — side-view frames are excluded to prevent perspective distortion corrupting face shape ratios.

Face shape classifier: Oval is a **last resort** — only scores when no other shape reaches ≥ 4 points. Other shapes use strong discriminators (jaw/cheek ratio, forehead-jaw differential, length ratio).

`onCapture(imageDataUrl, faceShape)` — skin tone NOT passed via arg. FaceScanner writes `mellow_skin_tone` to localStorage before firing callback; callers read it from there.

`skinLabBuf` cap is 90 so samples accumulate across full scan duration.

## Design system

Warm editorial palette — do not deviate:

| Token | Hex | Tailwind class |
|---|---|---|
| Cream (bg) | `#FAF6F0` | `bg-cream` |
| Brown dark | `#4A3728` | `text-brown-dark` |
| Brown mid | `#8B6347` | `text-brown-mid` |
| Brown light | `#C9A882` | `border-brown-light` |

Typography: `font-display` (Cormorant Garamond, editorial headings) + `font-sans` (DM Sans, body). Headings use `style={{ fontStyle: "italic", fontWeight: 300 }}` inline — Tailwind's `italic` utility alone is insufficient since the font variable must be active.

## Path alias

`@/*` maps to the repo root (e.g. `import Foo from '@/app/lib/types'`).
