# Help Center Page Design Spec

## 1) Context and objectives

Design a public-facing Help Center page that combines:
- Existing MediaJira visual language (Tailwind utility style, rounded cards, gradient accents, neutral surfaces).
- Asana-inspired information discovery flow (hero search -> topic exploration -> learning cards -> support escalation).

Primary user goals:
- Find answers quickly without needing support.
- Understand where to start (new users) and where to go next (existing users).
- Escalate to support channels when self-serve does not solve the issue.

Success criteria:
- Users can scan and identify relevant topic clusters in under 10 seconds.
- Search and category links are keyboard-accessible and visually clear.
- Page remains legible and stable across mobile/tablet/desktop breakpoints.

---

## 2) Information architecture

Top-level section order:
1. Global header (existing public header pattern).
2. Hero + search.
3. New-user onboarding spotlight.
4. Topic category grid ("Get your questions answered").
5. Learning/academy cards.
6. Community access spotlight ("Connect with other users").
7. Support escalation band ("Still have questions?").
8. Footer links.

Content hierarchy:
- H1: Page-level intent ("How can we help?").
- H2 per section for scanability.
- Card titles (H3-level semantics where appropriate).
- Short descriptions (1-2 lines, plain language, action-oriented).

---

## 3) End-to-end page anatomy

### 3.1 Hero + Search
- Visual intent: immediate support discovery.
- Background: project-aligned teal/white surface (no red-family tones).
- Left content:
  - H1 (`text-4xl` mobile, `text-5xl` tablet, desktop fixed at `72px`).
  - Large search input with icon.
  - Optional helper text below search.
- Right content:
  - A single hero image (illustration), no text overlays and no extra cards.
  - Image should be right-aligned on desktop and stacked below content on mobile.

### 3.2 New-user spotlight
- Two-column block:
  - Left: image card with rounded corners.
  - Right: heading, short onboarding paragraph, primary CTA.
- Purpose: reduce first-time user friction.
- Background:
  - Section background: `bg-white`.
- Container/layout:
  - Constrained inner wrapper: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-6`.
  - Desktop grid: `lg:grid-cols-2`, `gap-10`, `lg:items-center`.
- Left image card:
  - Outer shell: `rounded-3xl bg-white shadow-sm`.
  - Media wrapper: `overflow-hidden rounded-3xl`.
  - Image behavior: `h-auto w-full object-cover`.
  - Keep stable desktop ratio: `lg:aspect-[4/3]`.
- Right content:
  - Heading style: `text-3xl lg:text-5xl font-bold text-slate-900`.
  - Description style: `mt-4 text-lg leading-8 text-gray-600 max-w-2xl`.
  - Primary CTA uses existing button primitive with rounded pill style.

### 3.3 Topic category grid
- Section title + 2-row card grid.
- Each card has:
  - Circular icon badge.
  - Category title.
  - Short supporting description.
  - Entire card clickable.

### 3.4 Academy / Learning cards
- Section eyebrow + H2 + right-aligned CTA button.
- Horizontal card set on soft tinted background.
- Each card includes level badge, title, duration, summary, inline text link CTA.
- Purpose:
  - Help users move from quick answers to structured learning paths.
- Section layout:
  - Background: `bg-[#eef7ff]` or `bg-brand-teal/5`.
  - Wrapper: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-6`.
  - Vertical spacing: `py-14 md:py-16`.
  - Academy/Learning card palette: card surface `#C3E5F8`, primary text `#222875`.
- Header block:
  - Eyebrow: `text-xs font-medium uppercase tracking-wide text-gray-500`.
  - Title: `text-4xl lg:text-5xl font-semibold tracking-[-0.02em] text-slate-900`.
  - Description: `mt-4 text-lg leading-8 text-gray-600 max-w-2xl`.
  - Section CTA: use shared button standard from `8.0`.
- Cards grid:
  - Mobile: `grid-cols-1`
  - Tablet: `sm:grid-cols-2`
  - Desktop: `lg:grid-cols-3`
  - Gap: `gap-4 md:gap-5`

### 3.5 Support escalation band
- High-contrast support section near footer.
- Three large CTA cards (Academy / Community / Contact).
- Final utility footer links below separator.

### 3.6 Community access spotlight
- Purpose: give users a direct path to peer support, best practices, and real-world advice.
- Visual structure (based on provided reference):
  - Two-column layout on desktop.
  - Left: large community illustration area on soft neutral background.
  - Right: heading, short description, rounded outline CTA ("Go to forum").
- Placement: after Academy cards and before the final support escalation band.

---

## 4) Layout system

Use existing public-page container pattern:
- Full-bleed sections (edge-to-edge, no side gap on section background):
  - Hero section
  - Support escalation band
- Constrained sections (with side gaps):
  - New-user spotlight
  - Topic category grid
  - Academy / Learning cards
  - Community access spotlight
- Constrained section outer horizontal padding:
  - Mobile: `px-4`
  - Tablet: `px-6`
  - Desktop: `px-6`
- Constrained content container: `mx-auto max-w-7xl`

Grid system by section:
- Hero: `lg:grid-cols-[1.05fr_0.95fr]`, `gap-10` desktop.
- Spotlight: `lg:grid-cols-2`, `gap-10` desktop.
- Topic grid:
  - Mobile: `grid-cols-1`
  - Tablet: `sm:grid-cols-2`
  - Desktop: `lg:grid-cols-4`
  - Gap: `gap-4` or `gap-5`.
- Academy cards:
  - Mobile: stacked (`grid-cols-1`)
  - Tablet+: 2-3 columns depending content volume.
- Community spotlight:
  - Mobile: stacked (`grid-cols-1`), text block below image.
  - Desktop: `lg:grid-cols-[1fr_1fr]`, `gap-10` to `gap-14`.
- Support CTA cards:
  - Mobile: stacked
  - Desktop: `lg:grid-cols-3`.

Vertical section rhythm:
- Hero: `py-16 md:py-20 lg:py-24`
- Standard content sections: `py-14 md:py-16`
- Support band: `py-16 md:py-20`

Section width behavior:
- Hero section:
  - Background spans full viewport width (`w-full`).
  - Inner content stays constrained but uses larger side margins than standard sections:
    - `mx-auto max-w-7xl px-6 md:px-10 lg:px-14 xl:px-16`
- Support escalation band:
  - Background spans full viewport width (`w-full`).
  - Inner content aligned using `mx-auto max-w-7xl px-4 md:px-6`.
- New-user spotlight, Topic grid, Academy, Community:
  - Section content remains constrained (`mx-auto max-w-7xl`) with side gaps.

---

## 5) Spacing and rhythm scale

Adopt consistent spacing tokens:
- Micro: `gap-2`, `p-2` (icon/text internals).
- Small: `gap-3`, `p-4`.
- Medium: `gap-4`, `p-5`.
- Large: `gap-6`, `p-6`.
- XL: `gap-8`, `p-8`.

Card internals:
- Card padding:
  - Standard info card: `p-5` (desktop), `p-4` (mobile).
  - Feature/academy card: `p-6`.
- Card border radius:
  - Standard: `rounded-2xl`
  - Highlight/section container: `rounded-3xl`
- Icon badge spacing:
  - Icon container margin bottom: `mb-4`.

Section title spacing:
- Eyebrow -> title: `mt-3` to `mt-4`
- Title -> description: `mt-3` to `mt-5`
- Header block -> content grid: `mt-8` to `mt-10`

---

## 6) Typography system

Typography scale (Tailwind target classes):
- H1 (hero): `text-4xl sm:text-5xl lg:text-[72px]`, `font-bold`, `tracking-normal`, `leading-[1.05]`.
- H2 (section): `text-3xl lg:text-5xl`, `font-bold`.
- H3 (card title): `text-lg` to `text-xl`, `font-semibold` or `font-bold`.
- Body large: `text-lg leading-8 text-gray-600`.
- Body standard: `text-sm leading-6 text-gray-600`.
- Meta/labels: `text-xs font-medium uppercase tracking-wide`.

Readable line length:
- Long paragraphs capped at `max-w-2xl` or `max-w-3xl`.
- Section intros should not exceed ~2 lines on desktop where possible.

---

## 7) Color and surface usage

Use existing brand + neutral style:
- Primary action/background accent: brand gradient (`bg-brand-gradient`).
- Brand support tint: `bg-brand-teal/5`, `bg-brand-teal/10`.
- Text:
  - Primary: `text-slate-900` / `text-gray-900`
  - Secondary: `text-gray-600`
  - Muted meta: `text-gray-400` / `text-gray-500`
- Surfaces:
  - Main cards: `bg-white shadow-sm`
  - Highlight sections: tinted brand background (no border).

Global component rule:
- Do not use visible borders on Help Center components.
- Use spacing, radius, contrast, and shadow for separation instead of border strokes.

Contrast requirements:
- Maintain minimum WCAG AA contrast for body and actionable text.
- Avoid low-contrast text on tinted backgrounds.

---

## 7.1) Background color design (section-by-section)

Use this background mapping to keep the page visually structured and consistent with the hybrid direction:

- **Page root background**
  - Use project-style light green to white gradient base:
    - `bg-gradient-to-b from-brand-teal/5 via-white to-white`
  - Purpose: keep consistency with existing project visual tone while preserving high readability.

- **Hero background**
  - Use a single solid custom background color (no gradient):
    - `bg-[#3c81d7]` (Hero only)
  - Text on hero should be white or near-white (`text-white` / `text-white/90`).

- **Search bar surface (inside hero)**
  - `bg-white`
  - No border; rely on contrast + shadow for visibility on hero background.

- **New-user spotlight section**
  - `bg-gray-50`
  - Image card itself: `bg-white`.

- **Topic category grid section**
  - Section background: `bg-white`.
  - Topic cards: `bg-white` (no border).

- **Academy / Learning section**
  - Section background: `bg-[#eef7ff]` (very light blue tint) or `bg-brand-teal/5`.
  - Individual cards: slightly darker tint for separation (`bg-[#dff0ff]`-style) or white cards with shadow (no border).

- **Community spotlight section**
  - Section background: `bg-gray-50`.
  - Text side stays on section background; image panel can remain transparent or use `bg-white` if needed for contrast.

- **Support escalation band**
  - Background: same teal family as hero for consistency:
    - `bg-[#3cd793]` (Support band only)
  - CTA cards on this band: `bg-white/95` or `bg-brand-teal/5` for contrast.
  - Divider above footer links: use spacing or tonal separation (no border line).

- **Footer link zone (inside support band)**
  - Keep on teal-accent background for continuity.
  - Link text: `text-white/85`, hover to `text-white`.

Background transition guidance:
- Only the page root uses gradient.
- All section backgrounds inside the page should be single solid colors.
- Alternate between teal, light neutral, and white sections to create clear scanning rhythm.

---

## 8) Component specifications

### 8.0 Shared button standard (Help Center)
- Apply this size system to all section CTAs in Help Center (spotlight, academy header CTA, community CTA, support band CTAs).
- Base CTA size:
  - Height: `h-14`
  - Horizontal padding: `px-8`
  - Shape: `rounded-full`
  - Label typography: `text-lg leading-8`
  - Minimum touch target: `44px`
- Primary CTA style:
  - `bg-brand-gradient text-white hover:saturate-150`
- Secondary/neutral CTA style:
  - Keep same size (`h-14 px-8 text-lg leading-8`) and use neutral surface/contrast styling.
- Accessibility:
  - Include visible focus ring: `focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2`.

### 8.1 Search input (Hero)
- **Container**
  - Width: `w-full max-w-2xl`.
  - Height: `h-14 md:h-16`.
  - Position: `relative`.
  - Shape: `rounded-full`.
  - Background: `bg-white`.
  - Border: none.
  - Shadow: `shadow-sm` default, `hover:shadow-md` on pointer hover.

- **Input field**
  - Class target: `h-full w-full rounded-full bg-transparent pl-12 pr-12 text-base text-slate-900 placeholder:text-gray-500 outline-none`.
  - Font size: `text-base` (16px) on all breakpoints to prevent iOS zoom.
  - Placeholder copy example: `"Search for forms, templates, rules, and more"`.
  - Max query length: 120 chars (soft limit, show friendly message if exceeded).

- **Leading search icon**
  - Place icon in absolute left container: `absolute left-4 top-1/2 -translate-y-1/2`.
  - Icon size/color: `h-5 w-5 text-gray-500`.
  - Icon is decorative (`aria-hidden="true"`).

- **Trailing action area**
  - Default: no visible trailing control.
  - When input has text: show clear button (`X`) in trailing slot.
  - Clear button target size: minimum `h-8 w-8`, centered within right padding area.

- **State styles**
  - Rest: `shadow-sm`.
  - Hover: `shadow-md`.
  - Focus-visible: `ring-2 ring-offset-0 ring-white` on hero background.
  - Error (optional): `ring-1 ring-red-300` + helper text below field.
  - Disabled (optional): `opacity-60 cursor-not-allowed`.

- **Submission behavior**
  - `Enter`: submit search query.
  - Click search icon area does not submit by default unless intentionally made a button.
  - If query is empty:
    - Do not hard-error.
    - Smooth-scroll to topic grid section and focus section heading.
  - If query has value:
    - Route to help results endpoint/path (for example `/help-center/search?q=<term>`).

- **Autosuggest behavior (if enabled later)**
  - Open suggestion panel after 2+ characters.
  - Panel style: `absolute mt-2 w-full rounded-2xl bg-white shadow-lg` (no border).
  - Max 6 suggestions, keyboard-navigable with arrow keys.
  - `Esc` closes panel and returns focus to input.

- **Accessibility requirements**
  - Provide visible label above input, or hidden label with `sr-only` + `htmlFor`.
  - Required attributes: `type="search"`, `name="q"`, `autocomplete="off"`.
  - Announce results count (if live search) via `aria-live="polite"`.
  - Ensure clear button has `aria-label="Clear search"`.

- **Responsive details**
  - Mobile: full-width input under H1 with `mt-6`.
  - Tablet/Desktop: keep aligned to hero text block, `mt-8`.
  - Keep minimum touch target size 44px for all clickable search controls.

### 8.1.1 Hero right-side image block
- Use `next/image` with explicit width/height and `sizes`.
- Wrapper: `flex justify-center lg:justify-end`.
- Image behavior:
  - `className="h-auto w-full max-w-[520px] object-contain"`
  - Prevent distortion; preserve aspect ratio at all breakpoints.
- Mobile: render below hero text with `mt-8`.
- Desktop: keep vertical alignment centered against left hero content.

### 8.2 Topic cards
- **Purpose**
  - Fast self-serve navigation to key help categories (first-click discovery pattern).
  - Entire card works as a link to reduce precision requirements.

- **Grid placement**
  - Desktop: 8 cards in `4 x 2`.
  - Tablet: `2 x 4`.
  - Mobile: single-column stack.
  - Gap: `gap-4` mobile/tablet, `gap-5` desktop.

- **Card container**
  - Base class target:
    - `group rounded-2xl bg-white p-5 shadow-sm transition-all duration-200`
  - Min height: `min-h-[180px]` (desktop), `min-h-[160px]` (mobile).
  - Layout: `flex flex-col`.
  - Alignment: icon/title/description left-aligned.
  - Default background must stay white: `bg-white`.

- **Internal spacing**
  - Icon badge -> title: `mt-4`.
  - Title -> description: `mt-2`.
  - Card inner rhythm target:
    - top visual block (icon + title)
    - supporting description
    - optional bottom affordance row (arrow text/icon) with `mt-auto pt-4`.

- **Icon badge**
  - Default (before hover):
    - Icon wrapper background: `bg-white`
    - Icon color: `text-[#3c82d7]`
  - Wrapper class target: `h-10 w-10 rounded-full bg-white text-[#3c82d7] flex items-center justify-center transition-colors duration-200`.
  - Icon size: `h-5 w-5`.
  - Keep one icon style family (Lucide) across all topic cards.

- **Title and text**
  - Title class: `text-xl font-semibold text-slate-900`.
  - Title length: target 2-4 words, max 32 chars.
  - Description class: `text-sm leading-6 text-gray-600`.
  - Description length: 1-2 lines on desktop, max ~90 chars.
  - Avoid line-clamp that hides critical meaning; prefer concise copy.

- **Interaction states**
  - Hover:
    - Card background changes to `#7bdfe4`:
      - `hover:bg-[#7bdfe4]`
    - Card keeps depth/affordance:
      - `hover:shadow-md hover:-translate-y-0.5`
    - Icon badge background changes to `#3c82d7` on card hover:
      - `group-hover:bg-[#3c82d7]`
    - On icon hover state, icon color should switch to white for contrast:
      - `group-hover:text-white`
  - Active:
    - `active:translate-y-0 active:scale-[0.99]`.
  - Focus-visible (keyboard):
    - `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2`.
  - Cursor:
    - `cursor-pointer` on the full card.

- **Link behavior**
  - Entire card wrapped in `<Link>` (preferred) for a large click target.
  - Do not nest multiple competing links inside one card.
  - If arrow icon/CTA text is shown, it should route to the same URL as the card.

- **Content model (recommended)**
  - `id`: stable key.
  - `title`: card heading.
  - `description`: support text.
  - `href`: destination path.
  - `icon`: Lucide icon component reference.
  - `analyticsKey` (optional): for click tracking.

- **Example topic set**
  - Organize your work
  - Use cases
  - AI and automation
  - Reporting
  - App integrations
  - Account admin
  - Plans and billing
  - Troubleshooting

- **Accessibility requirements**
  - Card link must have meaningful accessible name (title text is sufficient if card is a single link).
  - Ensure focus indicator is visible against white background.
  - Icon-only visuals must not be the only information channel.
  - Maintain minimum text contrast AA (`text-gray-600` on white is acceptable baseline).

- **Analytics (recommended)**
  - Track `topic_card_click` with payload:
    - `topic_id`
    - `topic_title`
    - `position_index`
    - `surface` = `"help_center_topic_grid"`

- **Implementation note**
  - Keep data in a dedicated file (for example `helpTopics.ts`) and render with `.map()`.
  - Avoid hardcoding cards directly in page route file to keep page composition thin.

### 8.3 Spotlight block
- Wrapper:
  - New-user spotlight uses white section background: `bg-white`.
  - Vertical spacing: `py-14 md:py-16`.
- Image frame:
  - Rounded: `rounded-3xl`
  - Overflow hidden
  - Keep image ratio stable (`aspect-[4/3]` desktop).
- CTA button:
  - Use existing primary button style.
  - Preferred classes: `h-14 px-8 rounded-full text-lg leading-8` with brand gradient styling.
  - Placement: below description with `mt-8`.
  - Size: follow shared button standard in `8.0`.
  - Label style: concise verb-first copy (for example "Get started").
  - States:
    - Default: `bg-brand-gradient text-white`.
    - Hover: `hover:saturate-150`.
    - Focus-visible: strong visible ring (`focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2`).
    - Disabled (optional): reduced emphasis (`opacity-60 cursor-not-allowed`).
  - Structure:
    - Prefer link-style button via existing primitive (`Button asChild` + `Link`) when destination is a route.
    - Keep one primary CTA only in this section.

### 8.4 Academy cards
- Section container:
  - `bg-[#eef7ff]` or `bg-brand-teal/5`.
  - `py-14 md:py-16`.
  - Inner wrapper: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-6`.
- Header row:
  - Eyebrow + title + short description on left.
  - Section CTA on right (desktop), below text on mobile.
  - CTA must follow shared button standard in `8.0`.
- Cards grid:
  - `mt-8 md:mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3`.
- Card shell:
  - `rounded-2xl bg-[#C3E5F8] p-8 shadow-sm transition-all duration-200`.
  - No border.
  - Layout: `flex h-full min-h-[21rem] flex-col`.
- Card content structure:
  1. Level pill (`inline-flex h-6 items-center rounded px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]`).
  2. Title (`mt-5 text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] text-[#222875]`, max 2 lines).
  3. Duration row (`mt-6 flex items-center gap-2 text-lg text-[#222875]`).
  4. Description (`mt-4 text-[18px] leading-[1.5] text-[#222875]`).
  5. Inline CTA (`mt-auto pt-8 inline-flex items-center gap-2.5 text-[24px] font-medium text-[#222875]`).
- Level color mapping:
  - Beginner: `bg-emerald-100 text-emerald-700`
  - Intermediate: `bg-sky-100 text-sky-700`
  - Advanced: `bg-violet-100 text-violet-700`
- Interaction states:
  - Hover: `hover:-translate-y-0.5 hover:shadow-md`
  - Active: `active:translate-y-0 active:scale-[0.99]`
  - Focus-visible: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2`
- Data model (recommended):
  - `id`, `level`, `title`, `durationMinutes`, `summary`, `href`, `analyticsKey` (optional)

### 8.5 Support escalation cards
- Story-aligned intent:
  - Support escalation cards for high-intent actions near the help center footer.
  - Cards are fully clickable with clear destination labels.
- Typical section wrapper (from story):
  - Outer section: `w-full bg-brand-teal/10 py-16 md:py-20`.
  - Content container: `mx-auto max-w-7xl px-4 md:px-6`.
  - Heading: "Still have questions?"
  - Supporting copy: "Choose the best support path and continue with the right team."
  - Cards block spacing: `mt-8 md:mt-10`.
- Grid layout:
  - `grid grid-cols-1 gap-4 lg:grid-cols-3`.
- Card shell:
  - Base classes: `group flex min-h-[14rem] w-full flex-col rounded-2xl p-6 shadow-sm transition-all duration-200`.
  - Interaction: `cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]`.
  - Focus-visible: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2`.
- Tone variants:
  - `academy`: `bg-white hover:bg-slate-50`
  - `community`: `bg-brand-teal/5 hover:bg-brand-teal/10`
  - `contact`: `bg-sky-50 hover:bg-sky-100`
- Card content structure:
  1. Title: `text-2xl font-semibold leading-[1.2] text-slate-900`.
  2. Description: `mt-3 max-w-[32ch] text-base leading-7 text-slate-700`.
  3. CTA row: `mt-auto inline-flex items-center gap-2.5 pt-8 text-lg font-medium text-slate-900`.
  4. Arrow icon container: `inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white`.
- Story default content examples:
  - Go to Academy -> `Start learning` -> `/help-center/academy`
  - Visit community -> `Go to forum` -> `/help-center/community`
  - Contact support -> `Open support` -> `/help-center/contact-support`
- Story coverage:
  - `Default`: desktop baseline rendering.
  - `Mobile`: `mobile1` viewport snapshot.
  - `LinkInteraction`: verifies "Contact support" link target with hover interaction.

### 8.6 Community spotlight block
- Section container:
  - Background: `bg-gray-50` (or equivalent light neutral).
  - Vertical padding: `py-16 md:py-20`.
- Content wrapper: `mx-auto max-w-7xl grid gap-8 lg:grid-cols-2 lg:items-center`.
- Illustration panel:
  - `rounded-3xl`
  - `overflow-hidden`
  - Keep visual centered with `object-contain`.
  - Stable height target: `min-h-[220px]` mobile, `min-h-[320px]` desktop.
- Text panel:
  - H2 style: `text-3xl lg:text-5xl font-bold text-slate-900`.
  - Description: `mt-4 text-lg leading-8 text-gray-600 max-w-xl`.
- CTA: rounded button following shared button standard (`h-14 px-8 rounded-full text-lg leading-8 bg-white/90 hover:bg-white`).
- CTA label guidance:
  - Primary: "Go to forum"
  - Alternate: "Visit community"

---

## 9) Interaction and UX behavior

Search behavior:
- Typing should allow instant intent refinement.
- If no live search backend yet, define graceful fallback:
  - Enter key routes to help results page with query param.
  - Empty input + submit highlights topic section anchor.

Card interactions:
- Entire card clickable, not just text.
- Cursor pointer on hover.
- Maintain clear affordance across all cards.

Keyboard and focus behavior:
- Logical tab order:
  1) Header nav
  2) Search
  3) Spotlight CTA
  4) Topic cards
  5) Academy CTA/cards
  6) Community CTA
  7) Support CTAs
  8) Footer links
- Use `focus-visible` styles consistently.

State handling:
- Hover/active/focus states required for interactive components.
- Loading skeletons only if content becomes dynamic.
- Empty state for topic lists: short message + "Contact support" fallback CTA.

---

## 10) Responsive behavior

### Mobile (<640px)
- Stack all complex sections.
- Keep touch targets at least 44px high.
- Hero illustration can move below text and search.
- Reduce density: fewer cards per row (single column).

### Tablet (640px-1023px)
- 2-column for spotlight and some card groups.
- Preserve comfortable line lengths and spacing (`px-6`).

### Desktop (>=1024px)
- Full dual-column hero and spotlight.
- 4-column category grid.
- Community section rendered as balanced 2-column media+content block.
- 3-column support CTA cards.
- Keep section rhythm broad with larger vertical whitespace.

---

## 11) Accessibility checklist

Semantic structure:
- One H1 only.
- Use section landmarks and descriptive headings.
- Use `nav` for grouped help links where appropriate.

Inputs/actions:
- Search input has visible label (or `aria-label` if visually hidden label used).
- Buttons and links have clear action verbs.
- Icon-only actions include accessible labels.

Focus and keyboard:
- All interactive cards keyboard reachable.
- Visible focus indicator for links/buttons/inputs.
- No keyboard trap.

Media:
- Non-decorative images require meaningful alt text.
- Decorative graphics should use empty alt (`alt=""`) when appropriate.

Color/contrast:
- Ensure text contrast on brand backgrounds meets AA.

---

## 12) Content and microcopy guidelines

Voice:
- Clear, helpful, concise, action-focused.

Headings:
- Use direct outcome language ("Get your questions answered", "Still have questions?").

Descriptions:
- Keep 1-2 short sentences.
- Avoid internal jargon.

CTA labels:
- Verb-first and specific: "Get started", "Go to Academy", "Contact support".

---

## 13) Performance and implementation notes

- Use `next/image` for section visuals.
- Keep hero/spotlight imagery optimized and constrained with `sizes`.
- Lazy-load below-the-fold imagery.
- Prefer SVG icons from existing icon set for consistency.
- Minimize layout shift by setting known image dimensions/aspect ratios.

---

## 14) Suggested implementation mapping (repo-specific)

Route composition:
- Add route page at:
  - `frontend/src/app/(public)/help-center/page.tsx`

Component breakdown (feature-scoped):
- `frontend/src/components/help-center/HelpCenterPage.tsx` (top-level composer).
- `frontend/src/components/help-center/HelpHero.tsx`
- `frontend/src/components/help-center/HelpSpotlight.tsx`
- `frontend/src/components/help-center/HelpTopicGrid.tsx`
- `frontend/src/components/help-center/HelpAcademyCards.tsx`
- `frontend/src/components/help-center/HelpCommunitySpotlight.tsx`
- `frontend/src/components/help-center/HelpSupportBand.tsx`

Optional content/config files:
- `frontend/src/components/help-center/helpTopics.ts`
- `frontend/src/components/help-center/helpAcademyContent.ts`
- `frontend/src/components/help-center/helpCommunityLinks.ts`
- `frontend/src/components/help-center/helpSupportLinks.ts`

Reuse existing patterns:
- Header from `HeaderSection` usage pattern.
- Button variants from `@/components/ui/button`.
- Container and section spacing conventions from `PublicSeoPages` and public route pages.

---

## 15) QA acceptance checklist

Visual/layout:
- Section order and hierarchy match spec.
- Margins/paddings match defined rhythm.
- Cards and CTAs align consistently across breakpoints.

UX:
- Search is obvious and easy to use.
- Topic discovery path is clear for first-time and returning users.
- Escalation options are visible without confusion.

Responsive:
- No horizontal overflow on mobile.
- Typography remains legible and balanced.
- Image and card proportions remain stable.

Accessibility:
- Keyboard navigation works end-to-end.
- Focus states are visible.
- Color contrast passes AA for text and controls.

Implementation quality:
- Follows repo architecture (thin page, componentized sections).
- Uses existing UI primitives and Tailwind patterns.
- No duplicated large monolithic component.
