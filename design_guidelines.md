# AI Macro Tracker - Design Guidelines

## Design Approach

**Reference-Based Design System Hybrid**
Drawing inspiration from modern health/fitness apps (MyFitnessPal, Strong, Lose It) combined with Material Design principles for information-dense mobile applications. The design emphasizes clarity, data hierarchy, and touch-friendly interactions while maintaining a motivational, achievement-focused aesthetic.

## Typography System

**Font Family:** Inter (via Google Fonts CDN)
- Primary: Inter (400, 500, 600, 700 weights)
- Numeric displays: Inter with tabular-nums for consistent number alignment

**Type Scale:**
- Hero Numbers (Calories, Macros): text-4xl to text-6xl, font-bold
- Section Headers: text-xl, font-semibold
- Card Titles: text-lg, font-medium
- Body Text: text-base, font-normal
- Labels/Captions: text-sm, font-medium
- Micro Text (units): text-xs, font-normal

## Layout & Spacing System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, and 16 consistently
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4
- Touch target minimum: h-12 (48px for buttons/inputs)

**Container System:**
- Mobile: px-4, max-w-full
- Desktop: max-w-2xl mx-auto (app stays mobile-width centered)

## Core Components

### Navigation
**Bottom Tab Bar** (fixed to bottom)
- Height: h-16
- Icons: 24px from Heroicons (solid variants)
- Layout: 4 tabs (Dashboard, Log Food, Weigh-In, Settings)
- Active state: Icon with label, inactive shows icon only
- Safe area padding: pb-safe for iOS devices

### Dashboard Components

**Progress Ring/Bar**
- Circular progress ring showing calories eaten vs target
- Center: Large calorie number (text-5xl) with "/ target" below (text-xl)
- Macro breakdown: Horizontal bar segments for P/C/F below ring
- Size: 200px diameter on mobile

**Quick Action Buttons**
- 2-column grid (grid-cols-2 gap-4)
- Large cards: min-h-32, rounded-2xl
- Icon size: 40px
- Labels: text-lg below icon
- Camera and Text input options

**Today's Food Log List**
- Card-based list (space-y-3)
- Each entry: rounded-xl, p-4
- Layout: Time | Food Name | Calorie number (right-aligned)
- Macros: Small text below name (P: Xg | C: Xg | F: Xg)
- Swipe-to-delete pattern (visual indicator only)

### Review Modal (Critical Component)

**Layout Structure:**
- Full-screen overlay with backdrop blur
- Rounded top corners (rounded-t-3xl)
- Slides up from bottom (mobile-native feel)

**Image Preview Section:**
- Aspect ratio: aspect-video or aspect-square
- Width: Full width minus p-4 margins
- Rounded: rounded-xl

**Edit Form:**
- Food name: Large input (text-xl, h-14)
- Quantity & Unit: 2-column grid
  - Quantity: Large number input (text-3xl, text-center, h-20)
  - Unit: Dropdown (h-20 to match)

**Live Macro Display:**
- 4-card grid (grid-cols-2 gap-3)
- Each macro card: p-4, rounded-xl, text-center
- Number: text-3xl, font-bold
- Label: text-sm below number
- Order: Calories, Protein, Carbs, Fat

**Action Buttons:**
- Fixed to bottom of modal
- Primary: "Save to Log" (w-full, h-14, text-lg, rounded-xl)
- Secondary: "Cancel" link above button

### Analytics & Charts

**Weight Trend Chart**
- Chart.js line chart
- Height: h-64 on mobile
- Grid: Subtle horizontal lines only
- Points: 6px circles with values on hover
- Date range selector: Last 7/30/90 days tabs

**Calorie Adherence Chart**
- Chart.js bar chart
- 7-day view: Each bar shows eaten vs target
- Target line overlay (dashed horizontal)
- Height: h-56

**Stats Cards Grid**
- grid-cols-2 gap-4
- Each card: p-4, rounded-xl, aspect-square
- Number: text-4xl, font-bold, centered
- Label: text-sm below

### Forms & Inputs

**Input Fields:**
- Height: h-12 (touch-friendly)
- Border: border-2, rounded-lg
- Focus: ring-2 ring-offset-2
- Labels: text-sm, font-medium, mb-2

**Number Inputs (Weight/Macros):**
- Extra large: h-16, text-2xl, text-center
- Numeric keyboard trigger on mobile

**Buttons:**
- Primary: h-12, px-6, rounded-lg, font-semibold
- Icon buttons: w-12, h-12, rounded-full
- Floating action button (FAB): w-14, h-14, rounded-full, fixed bottom-20 right-4

## Animations & Transitions

**Minimal, Purposeful Motion:**
- Modal slide-up: transition-transform duration-300
- Progress ring: Smooth fill animation on load (1.5s ease-out)
- List items: Subtle fade-in when new log added
- NO continuous/looping animations
- NO scroll-triggered effects beyond initial page load

## Page-Specific Layouts

### Dashboard
- Progress ring: Top third
- Quick actions: Middle section
- Food log list: Remaining space (scrollable)
- Bottom nav: Fixed

### Settings Page
- Profile photo placeholder: Centered, w-24, h-24, rounded-full
- Form sections with dividers (divide-y)
- Each setting row: py-4, space between label and value
- BMR/TDEE display: Prominent card at top (calculated values, read-only)

### Weigh-In Page
- Large weight input: Centered, dominates viewport
- Quick increment buttons: +0.1, +0.5, +1.0 kg (grid-cols-3)
- History list: Below input, scrollable
- Each weigh-in entry: Date, weight, trend indicator (↑↓→)

## Accessibility

- All interactive elements: min-h-12 (48px touch target)
- Form labels: Explicit for attributes
- Focus indicators: Visible ring on all focusable elements
- Alt text: Required for all images
- Semantic HTML: nav, main, section, article tags
- Contrast: Ensure text meets WCAG AA standards in dark mode

## Icon System

**Heroicons (via CDN)** - Solid variant
- Navigation: home, camera, scale, cog-6-tooth (24px)
- Actions: plus-circle, pencil, trash, check (20px)
- Data: chart-bar, arrow-trending-up, fire (20px)

## Images

**No hero images** - This is a utility app focused on data and functionality. Images only appear as:
1. User-uploaded food photos (in review modal and log history)
2. Profile photo placeholder (settings page)

All uploaded food images should display in rounded-xl containers with aspect-ratio maintained.

## Responsive Behavior

**Mobile-First (320px - 768px):**
- Single column layouts
- Bottom navigation
- Full-width components

**Tablet/Desktop (769px+):**
- Max-width container: max-w-2xl, centered
- Side navigation option (replaces bottom tabs)
- 2-column grids expand to show more data side-by-side
- Modals: max-w-lg, centered overlay (not full-screen)