# LOBA Design System: Clean & Minimal

**Style Direction:** Option A - Clean & Minimal  
**Inspiration:** Apple, Notion, Linear, Stripe  
**Core Philosophy:** Clarity through restraint. Every element earns its place.

---

## Design Principles

1. **Whitespace is a feature** - Generous spacing creates breathing room and focus
2. **Typography does the heavy lifting** - Hierarchy through size and weight, not decoration
3. **Subtle depth** - Shadows and borders are whispers, not shouts
4. **Consistent rhythm** - Predictable spacing creates calm
5. **Content first** - UI disappears, content shines

---

## Color Palette

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#FFFFFF` | Page background |
| `--background-subtle` | `#FAFAFA` | Card backgrounds, sections |
| `--background-muted` | `#F5F5F5` | Hover states, disabled areas |
| `--foreground` | `#171717` | Primary text |
| `--foreground-muted` | `#737373` | Secondary text |
| `--foreground-subtle` | `#A3A3A3` | Tertiary text, placeholders |
| `--border` | `#E5E5E5` | Borders, dividers |
| `--border-subtle` | `#F0F0F0` | Subtle separators |
| `--primary` | `#171717` | Primary buttons, links |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--accent` | `#0066FF` | Interactive highlights, links |
| `--accent-muted` | `#E6F0FF` | Accent backgrounds |
| `--success` | `#22C55E` | Success states |
| `--warning` | `#F59E0B` | Warning states |
| `--destructive` | `#EF4444` | Error states, destructive actions |

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0A0A0A` | Page background |
| `--background-subtle` | `#141414` | Card backgrounds, sections |
| `--background-muted` | `#1F1F1F` | Hover states, disabled areas |
| `--foreground` | `#FAFAFA` | Primary text |
| `--foreground-muted` | `#A3A3A3` | Secondary text |
| `--foreground-subtle` | `#737373` | Tertiary text, placeholders |
| `--border` | `#262626` | Borders, dividers |
| `--border-subtle` | `#1F1F1F` | Subtle separators |
| `--primary` | `#FAFAFA` | Primary buttons, links |
| `--primary-foreground` | `#0A0A0A` | Text on primary |
| `--accent` | `#3B82F6` | Interactive highlights, links |
| `--accent-muted` | `#1E3A5F` | Accent backgrounds |
| `--success` | `#22C55E` | Success states |
| `--warning` | `#F59E0B` | Warning states |
| `--destructive` | `#EF4444` | Error states, destructive actions |

---

## Typography

### Font Family

```
Primary: "Inter", -apple-system, BlinkMacSystemFont, sans-serif
Monospace: "JetBrains Mono", "Fira Code", monospace (for code/numbers)
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `display` | 48px / 3rem | 600 | 1.1 | Hero headlines |
| `h1` | 36px / 2.25rem | 600 | 1.2 | Page titles |
| `h2` | 28px / 1.75rem | 600 | 1.25 | Section headers |
| `h3` | 22px / 1.375rem | 600 | 1.3 | Card titles |
| `h4` | 18px / 1.125rem | 600 | 1.4 | Subsection headers |
| `body` | 16px / 1rem | 400 | 1.5 | Body text |
| `body-sm` | 14px / 0.875rem | 400 | 1.5 | Secondary text, captions |
| `caption` | 12px / 0.75rem | 500 | 1.4 | Labels, metadata |
| `overline` | 11px / 0.6875rem | 600 | 1.4 | Category labels (uppercase, tracking +0.05em) |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Emphasized body, labels |
| Semibold | 600 | Headings, buttons |

---

## Spacing System

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps (icon to text) |
| `space-2` | 8px | Compact spacing |
| `space-3` | 12px | Default element gap |
| `space-4` | 16px | Standard padding |
| `space-5` | 20px | Medium sections |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Section gaps |
| `space-10` | 40px | Large section gaps |
| `space-12` | 48px | Page section separators |
| `space-16` | 64px | Major page divisions |

### Content Width

| Token | Value | Usage |
|-------|-------|-------|
| `max-w-sm` | 384px | Narrow forms, modals |
| `max-w-md` | 448px | Standard forms |
| `max-w-lg` | 512px | Wide forms |
| `max-w-xl` | 576px | Content cards |
| `max-w-2xl` | 672px | Article content |
| `max-w-4xl` | 896px | Page content |
| `max-w-6xl` | 1152px | Wide layouts |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small elements (badges, chips) |
| `radius-md` | 8px | Buttons, inputs, small cards |
| `radius-lg` | 12px | Cards, modals |
| `radius-xl` | 16px | Large cards, images |
| `radius-full` | 9999px | Pills, avatars |

**Rule:** Prefer smaller radii. Large, bubbly corners feel childish.

---

## Shadows

Shadows are minimal and soft. They suggest depth without demanding attention.

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Subtle lift (inputs) |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Cards at rest |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)` | Cards on hover |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.03)` | Modals, dropdowns |
| `shadow-xl` | `0 20px 25px rgba(0,0,0,0.06), 0 10px 10px rgba(0,0,0,0.03)` | Floating elements |

**Rule:** Most elements have no shadow. Reserve shadows for elevation hierarchy.

---

## Borders

| Style | Usage |
|-------|-------|
| `1px solid var(--border)` | Standard borders (cards, inputs) |
| `1px solid var(--border-subtle)` | Subtle dividers |
| No border | Elements with sufficient background contrast |

**Rule:** If background contrast is enough, skip the border. Less is more.

---

## Components

### Buttons

**Primary Button**
- Background: `--primary`
- Text: `--primary-foreground`
- Border: none
- Padding: 10px 20px
- Border radius: `radius-md` (8px)
- Font: 14px, semibold
- Hover: Slight darken (2%)
- Active: Slight darken (4%)

**Secondary Button**
- Background: `--background-subtle`
- Text: `--foreground`
- Border: `1px solid var(--border)`
- Hover: Background shifts to `--background-muted`

**Ghost Button**
- Background: transparent
- Text: `--foreground-muted`
- Border: none
- Hover: Background `--background-muted`

**Destructive Button**
- Background: `--destructive`
- Text: white
- Use sparingly

### Cards

**Default Card**
- Background: `--background` (light) or `--background-subtle` (dark)
- Border: `1px solid var(--border)`
- Border radius: `radius-lg` (12px)
- Padding: `space-6` (24px)
- Shadow: `shadow-sm` or none
- Hover: `shadow-md` (optional, for interactive cards)

**Product Card**
- Image: Top, full-width, `radius-lg` top corners
- Image aspect ratio: 4:3 or 16:9
- Content padding: `space-4` (16px)
- Title: `h4` (18px semibold)
- Description: `body-sm` (14px), `--foreground-muted`
- Price: `body` (16px), `--foreground`, semibold
- Trainer: Small avatar (24px) + name in `caption`

**Profile Card**
- Avatar: Centered or left-aligned
- Name: `h3`
- Title/tagline: `body-sm`, `--foreground-muted`
- Stats: Horizontal row, `caption` labels

### Inputs

**Text Input**
- Height: 40px
- Padding: 0 12px
- Border: `1px solid var(--border)`
- Border radius: `radius-md` (8px)
- Background: `--background`
- Focus: Border `--accent`, subtle shadow
- Placeholder: `--foreground-subtle`

**Textarea**
- Same as input, variable height
- Min-height: 100px

### Badges/Pills

- Padding: 4px 10px
- Border radius: `radius-full`
- Font: `caption` (12px, medium)
- Background: `--background-muted`
- Text: `--foreground-muted`
- Variants: accent, success, warning, destructive

### Avatars

| Size | Dimensions | Usage |
|------|------------|-------|
| `xs` | 24px | Inline mentions |
| `sm` | 32px | Compact lists |
| `md` | 40px | Standard |
| `lg` | 56px | Profile headers |
| `xl` | 80px | Profile pages |
| `2xl` | 120px | Hero profiles |

- Border radius: `radius-full`
- Border: `2px solid var(--background)` (for overlapping)
- Fallback: Initials on `--background-muted`

---

## Layout Patterns

### Page Structure

```
┌─────────────────────────────────────────┐
│  Header (sticky, 56-64px height)        │
├─────────────────────────────────────────┤
│                                         │
│   ┌───────────────────────────────┐     │
│   │                               │     │
│   │   Content (max-w-4xl, centered)│    │
│   │                               │     │
│   └───────────────────────────────┘     │
│                                         │
├─────────────────────────────────────────┤
│  Bottom Nav (mobile, 64px height)       │
└─────────────────────────────────────────┘
```

### Content Centering

All page content should be:
- Max-width constrained (`max-w-4xl` typical)
- Horizontally centered (`mx-auto`)
- Horizontal padding: `space-4` on mobile, `space-6` on desktop

### Grid Systems

**Product Grid**
- Mobile: 1 column
- Tablet (640px+): 2 columns
- Desktop (1024px+): 3 columns
- Gap: `space-4` or `space-6`

**Form Layout**
- Max-width: `max-w-md` (448px)
- Centered
- Field gap: `space-4`

---

## Images

### Aspect Ratios

| Ratio | Usage |
|-------|-------|
| 1:1 | Avatars, thumbnails |
| 4:3 | Product cards, content images |
| 16:9 | Banners, hero images |
| 3:4 | Portrait photos |

### Image Treatment

- Border radius: Match container (`radius-lg` for cards)
- Object-fit: `cover` for fixed containers
- Lazy loading: Always
- Placeholder: `--background-muted` with subtle shimmer

### Banner Images

- Full-width within container
- Height: 200px mobile, 280px tablet, 360px desktop
- Overlay: Optional dark gradient for text legibility
- Border radius: `radius-xl` or none (edge-to-edge)

---

## Animations & Transitions

### Timing

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `fast` | 100ms | ease-out | Micro-interactions (hovers) |
| `normal` | 200ms | ease-out | Standard transitions |
| `slow` | 300ms | ease-in-out | Page transitions, modals |

### Principles

- **Subtle is better** - Animations should be felt, not seen
- **Purposeful** - Only animate what needs attention
- **Consistent** - Same interaction = same animation

### Common Transitions

```css
/* Hover state */
transition: all 150ms ease-out;

/* Card hover */
transition: box-shadow 200ms ease-out, transform 200ms ease-out;
transform: translateY(-2px); /* subtle lift */

/* Modal entrance */
transition: opacity 200ms ease-out, transform 200ms ease-out;
transform: scale(0.98) → scale(1);
```

---

## Iconography

### Style

- **Library:** Lucide React (primary)
- **Stroke width:** 1.5px (default)
- **Style:** Outline icons, not filled
- **Size:** Match text size or use fixed sizes (16, 20, 24px)

### Sizes

| Size | Dimensions | Usage |
|------|------------|-------|
| `sm` | 16px | Inline with small text |
| `md` | 20px | Buttons, list items |
| `lg` | 24px | Standalone, headers |
| `xl` | 32px | Feature highlights |

### Colors

- Default: `--foreground-muted`
- Interactive: `--foreground` on hover
- Accent: `--accent` for highlights

---

## Responsive Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Mobile-First Approach

- Design for mobile first
- Add complexity at larger breakpoints
- Touch targets: Minimum 44px

---

## Do's and Don'ts

### Do

- Use whitespace generously
- Let typography create hierarchy
- Keep shadows subtle
- Center page content
- Use consistent spacing rhythm
- Make interactive elements obviously clickable

### Don't

- Add decorative elements without purpose
- Use heavy drop shadows
- Mix border radii sizes arbitrarily
- Left-align full-width content
- Use more than 2-3 font weights
- Over-animate

---

## Application to LOBA

### Pro Portal - "Create & Manage Products"

- Page title: `h1`, centered
- Subtitle: `body`, `--foreground-muted`, centered
- Product grid: 2-3 columns, centered
- Each card: Product image (4:3), title, price, status badge
- Add button: Primary, top-right or floating

### Pro Portal - "My Storefront"

- Banner image: Full-width, 16:9, `radius-xl`
- Profile section: Avatar (xl/2xl), name (`h1`), tagline, credentials
- Stats row: Centered, subtle dividers
- Products section: Grid layout
- Preview banner: Accent background, centered

### Trainer Storefront (Public)

- Hero: Banner + overlapping avatar
- Bio section: Max-width prose, centered
- Reviews: Card-based, 1-2 columns
- Products: Grid, clear pricing
- CTA: Sticky or prominent "Message" button

---

## Version

**v1.0** - December 2024  
**Style:** Clean & Minimal (Option A)
