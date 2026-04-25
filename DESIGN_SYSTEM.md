# ReceiptMind — Complete UI/UX Design System & Build Instructions

Reference this file for every component you build.

---

## Product Identity

Name: ReceiptMind  
Category: Enterprise finance SaaS  
Tagline: "Stop typing. Start uploading."  
Tone: Precise, calm, trustworthy, like a senior accountant who also happens to have taste.  
Inspiration: Linear.app, Stripe.com, Clerk.dev  
Anti-inspiration: Canva templates, Framer AI, anything with purple gradients or glassmorphism

---

## Typography — Non-Negotiable

Install these two fonts via Google Fonts. No substitutions.

```css
@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;400;500&display=swap");
```

Usage rules:

- Instrument Serif: all display text, hero headings, section titles, large pricing numbers, pull quotes.
- DM Sans: all UI text, nav, labels, body copy, buttons, table cells, badges, captions.
- Never use Inter, Roboto, Arial, system-ui, or any other font.
- Italic Instrument Serif is for emphasis or accent only, used in the hero only.

Type scale:

- Hero heading: 40px, weight 400, letter-spacing -0.5px.
- Page title: 28px, weight 400, letter-spacing -0.3px.
- Section heading: 22px, weight 400, letter-spacing -0.2px.
- Card title: 15px, weight 500, letter-spacing -0.1px.
- Body: 14px, weight 400, line-height 1.6.
- Label uppercase: 11px, weight 500, letter-spacing 0.07em, uppercase.
- Caption: 12px, weight 400.
- Monospace dates and IDs: monospace, 12px.

---

## Color System

All colors as CSS custom properties in `globals.css`:

```css
:root {
  --bg-page: #f7f7f5;
  --bg-surface: #ffffff;
  --bg-subtle: #f0f0ec;
  --bg-invert: #0d0d0b;

  --text-primary: #0a0a0a;
  --text-secondary: #3d3d3d;
  --text-muted: #888884;
  --text-ghost: #c0bfbb;
  --text-invert: #f5f5f0;

  --border-default: #e5e5e1;
  --border-subtle: #eeeeea;
  --border-strong: #c8c8c4;
  --border-invert: #2a2a28;

  --amber: #b8711f;
  --amber-hover: #a3631a;
  --amber-surface: #fdf5e8;
  --amber-border: #e8c88a;

  --success: #1a5c3a;
  --success-surface: #edf7f2;
  --warning: #8a5c0a;
  --warning-surface: #fdf6e3;
  --error: #b5281e;
  --error-surface: #fdf0ee;
  --info: #1e4db5;
  --info-surface: #eef3fd;

  --cat-software-text: #1e3a8a;
  --cat-software-bg: #eff4ff;
  --cat-travel-text: #92400e;
  --cat-travel-bg: #fffbeb;
  --cat-office-text: #14532d;
  --cat-office-bg: #f0fdf4;
  --cat-food-text: #581c87;
  --cat-food-bg: #faf5ff;
  --cat-marketing-text: #7c2d12;
  --cat-marketing-bg: #fff7ed;
  --cat-equipment-text: #0c4a6e;
  --cat-equipment-bg: #f0f9ff;
}
```

Color rules:

- Amber is the only accent color. Use it for one CTA button, active states, progress bars, and upgrade prompts.
- Black `#0a0a0a` is the primary action color everywhere else.
- No purple. No teal. No gradient backgrounds. Ever.
- Page background is `--bg-page`, not white.
- Cards and panels sit on the page at `--bg-surface`.
- Depth comes from background separation and borders, not shadows.

---

## Spacing — 4px Base Grid

All spacing must be multiples of 4px.

- 4px: icon-label gap, inline badge padding.
- 8px: button padding-inline, input internal gap.
- 12px: card gap in grids.
- 16px: card padding, section internal spacing.
- 20px: larger card padding.
- 24px: small section padding-block.
- 32px: page horizontal padding, section gap.
- 48px: large section padding-block.
- 64px: major section separation.

Never use: 5px, 7px, 9px, 11px, 13px, 15px, 17px, 18px, 19px.

---

## Border Radius

- 4px: badges, tags, small chips, status dots context.
- 6px: logo marks, avatar squares.
- 8px: buttons, inputs, small cards, table header backgrounds.
- 12px: cards, panels, dropdowns.
- 16px: modals and large overlays only.
- 50%: circular avatars only.

Never use border-radius above 16px on non-circular elements.  
Never use pill shapes on buttons or cards.

---

## Shadows

Only one shadow level is allowed anywhere in the product:

```css
box-shadow:
  0 1px 3px rgba(0, 0, 0, 0.06),
  0 1px 2px rgba(0, 0, 0, 0.04);
```

Use it only on dropdown menus, modals, and tooltips.

Cards use borders, not shadows. Hover states use border-color changes, not shadow additions. No drop-shadows, colored glows, or layered shadows.

---

## Component Specifications

### Navigation Bar

- Height: 56px.
- Background: `var(--bg-surface)`.
- Border-bottom: 1px solid `var(--border-default)`.
- Horizontal padding: 32px.
- Position: sticky top 0, z-index 50.
- Logo mark: 28px by 28px, 6px radius, black background, white `RM`, 11px, weight 500, letter-spacing 1px.
- Gap between logo mark and name: 8px.
- Logo name: DM Sans, 15px, weight 500, `var(--text-primary)`, letter-spacing -0.3px.
- Nav links: DM Sans, 13px, weight 400, `var(--text-secondary)`, padding 6px 12px, radius 8px.
- Nav link hover: `var(--bg-subtle)`.
- Active nav link: weight 500, `var(--text-primary)`.
- Link gap: 4px.
- Right ghost button: 1px border, 8px radius, 13px, hover border darkens.
- Primary button: black background, white text, 8px radius, 7px 16px padding.
- Avatar: 30px circle, amber surface background, amber text, 1.5px border.

### Sidebar

- Width: 220px.
- Background: `var(--bg-surface)`.
- Border-right: 1px solid `var(--border-default)`.
- Padding: 20px 12px.
- Overflow-y: auto.
- Section label: DM Sans 11px, weight 500, uppercase, `var(--text-ghost)`, letter-spacing 0.08em, margin-top 16px, margin-bottom 6px.
- First section label margin-top: 0.
- Sidebar item: flex, align-center, gap 10px, padding 7px 10px, radius 8px, 13px, `var(--text-secondary)`.
- Sidebar item hover: `var(--bg-subtle)`.
- Sidebar active: `var(--text-primary)` background, white text.
- Active icon opacity: 0.65.
- Count badge: `var(--amber-surface)` background, `var(--amber)` text, 10px, weight 500, padding 1px 6px, radius 10px, margin-left auto.
- Category dots: 8px by 8px circles using category variables.
- Bottom section includes usage bar and user card separated by auto spacer.
- Usage label: 12px, flex space-between, `var(--text-muted)`.
- Usage track: 3px height, 2px radius, `var(--border-default)`.
- Usage fill: amber.
- User card: padding 10px, border 1px solid `var(--border-default)`, radius 8px, hover `var(--bg-subtle)`.
- User name: 12px, weight 500.
- User plan: 11px, `var(--text-ghost)`.

### Page Header

- Padding: 28px 32px 0.
- Layout: flex, space-between, align flex-start.
- Title: Instrument Serif, 26px, weight 400, `var(--text-primary)`, letter-spacing -0.3px, line-height 1.2.
- Subtitle: DM Sans, 13px, `var(--text-muted)`, margin-top 4px.
- Action area: flex, gap 8px, padding-top 4px.

### Stat Cards

- Background: `var(--bg-surface)`.
- Border: 1px solid `var(--border-default)`.
- Radius: 12px.
- Padding: 16px 18px.
- Grid: repeat(4, 1fr), gap 12px.
- Label: DM Sans, 11px, weight 500, uppercase, letter-spacing 0.05em, `var(--text-ghost)`, margin-bottom 8px.
- Value: Instrument Serif, 24px, weight 400, `var(--text-primary)`, letter-spacing -1px, line-height 1.
- Delta badge: inline-flex, align-center, gap 3px, 11px DM Sans, padding 2px 6px, radius 4px, margin-top 6px.
- Delta up: success surface background, success text.
- Delta down: error surface background, error text.
- Delta neutral: subtle background, muted text.

### Upload Zone

- Border: 1.5px dashed `var(--border-default)`.
- Radius: 12px.
- Background: `var(--bg-surface)`.
- Padding: 36px.
- Layout: flex column, align-center, gap 10px.
- Cursor: pointer.
- Transition: border-color 200ms, background 200ms.
- Hover border: 1.5px dashed `var(--border-strong)`.
- Hover background: `var(--amber-surface)`.
- Icon container: 40px by 40px, `var(--bg-page)`, border 1px solid `var(--border-default)`, radius 10px.
- Icon: 18px SVG, stroke currentColor, stroke-width 1.5.
- Title: DM Sans, 14px, weight 500, `var(--text-primary)`.
- Subtitle: DM Sans, 12px, `var(--text-muted)`.
- File type tags: monospace 11px, `var(--bg-subtle)` background, `var(--text-muted)`, padding 2px 8px, radius 4px.

### Data Table

- Wrapper: white background, 1px border, 12px radius, overflow hidden.
- Table head background: `var(--bg-page)`.
- Table head border-bottom: 1px solid `var(--border-default)`.
- Header cells: DM Sans, 11px, weight 500, uppercase, `var(--text-ghost)`, letter-spacing 0.06em, padding 10px 16px, text-align left.
- Data cells: DM Sans, 13px, `var(--text-secondary)`, padding 11px 16px, border-bottom 1px solid `var(--border-subtle)`.
- Last row cells: no border-bottom.
- Row hover: all cells background `var(--amber-surface)`, transition 120ms.
- Vendor cell: weight 500, `var(--text-primary)`.
- Amount cell: weight 500, `var(--text-primary)`, tabular nums.
- Date and ID cells: monospace, 12px, `var(--text-muted)`.
- Category badge: DM Sans, 11px, weight 500, padding 2px 8px, radius 4px, category variables.
- Status indicator dot: 6px circle, inline-block, margin-right 5px.
- Status text: 12px, matching semantic color.

### Buttons

Primary:

- Background: `var(--text-primary)`.
- Color: white.
- Padding: 7px 16px.
- Radius: 8px.
- Font: DM Sans, 13px, weight 500.
- Hover: opacity 0.82.
- Active: scale(0.98).
- Transition: opacity 150ms.

Ghost:

- Background: transparent.
- Border: 1px solid `var(--border-default)`.
- Color: `var(--text-secondary)`.
- Padding: 6px 14px.
- Radius: 8px.
- Font: DM Sans, 13px.
- Hover: border-color `var(--border-strong)`, color `var(--text-primary)`.

Amber:

- Upgrade CTA only.
- Background: `var(--amber)`.
- Color: white.
- Same sizing as primary.
- Hover: `var(--amber-hover)`.

Destructive:

- Background: `var(--error)`.
- Color: white.

Icon button:

- Size: 32px by 32px.
- Radius: 8px.
- Hover: `var(--bg-subtle)`.
- Icon: 16px.

All buttons:

- Font-family: inherit, DM Sans.
- Cursor: pointer.
- No gradient backgrounds.
- No box shadows.
- No uppercase text.
- No radius above 8px.

### Form Inputs

- Height: 36px.
- Background: `var(--bg-surface)`.
- Border: 1px solid `var(--border-default)`.
- Radius: 8px.
- Padding: 0 12px.
- Font: DM Sans, 13px, `var(--text-primary)`.
- Placeholder: `var(--text-ghost)`.
- Focus: border 1px solid `var(--text-primary)`, no outline or blue glow.
- Hover: `var(--border-strong)`.
- Transition: border-color 150ms.
- Error state: `var(--error)`.
- Label: DM Sans, 12px, weight 500, `var(--text-secondary)`, margin-bottom 6px.
- Helper text: 12px, `var(--text-muted)`.

---

## Landing Page Structure

### Section 1: Nav

Use the navigation bar specification. Right side CTA: "Try free" primary black button and "Sign in" ghost button.

### Section 2: Hero

- Background: `var(--bg-page)`.
- Padding: 96px 32px 80px.
- Text-align: center.
- Max-width: 680px centered.
- Eyebrow pill: inline-flex, align-center, padding 4px 14px, border 1px solid `var(--border-default)`, radius 20px, DM Sans 11px uppercase, letter-spacing 0.08em, `var(--text-muted)`, margin-bottom 24px.
- Heading: Instrument Serif, 52px, weight 400, line-height 1.08, letter-spacing -1px, `var(--text-primary)`, max-width 580px, margin 0 auto 16px.
- Italic hero accent: `em`, italic Instrument Serif, `var(--amber)`.
- Example: `Stop <em>typing</em>.<br>Start uploading.`
- Subheadline: DM Sans, 16px, weight 400, `var(--text-muted)`, max-width 440px, margin 0 auto 32px, line-height 1.65.
- CTA group: flex center, gap 10px.
- Primary CTA: amber button, "Try free — no card needed".
- Secondary CTA: ghost button, "See a demo →".
- Trust line: DM Sans, 12px, `var(--text-ghost)`, margin-top 16px.
- Trust text: "10 receipts free. No credit card. Cancel anytime."

### Section 3: Demo Strip

- Background: `var(--bg-invert)`.
- Padding: 56px 32px.
- Border-top and bottom: 1px solid `var(--border-invert)`.
- Eyebrow: same pill, border `#2a2a28`, color `#666662`.
- Heading: Instrument Serif, 28px, `var(--text-invert)`.
- Subtext: 14px, `#666662`.
- Demo frame: `#141412`, border 1px solid `#2a2a28`, radius 12px, aspect ratio 16/9, max-width 680px centered.
- Demo frame inner text: "See ReceiptMind classify, enrich, and export a full batch in under a minute.", DM Sans 13px, `#555552`, centered.

### Section 4: Capabilities

- Background: `var(--bg-page)`.
- Padding: 80px 32px.
- Heading: Instrument Serif, 36px, centered.
- Subtext: 15px, `var(--text-muted)`, max-width 520px, centered.
- Grid: 3 columns, gap 12px, max-width 860px, centered.
- Feature card: `var(--bg-surface)`, border 1px solid `var(--border-default)`, radius 12px, padding 24px.
- Icon area: 36px by 36px, border 1px solid `var(--border-default)`, radius 8px, background `var(--bg-page)`, icon 18px, stroke-width 1.5.
- Title: DM Sans, 14px, weight 500, `var(--text-primary)`, margin-bottom 6px.
- Body: DM Sans, 13px, `var(--text-muted)`, line-height 1.55.
- Hover: border-color `var(--border-strong)`, transition 200ms.

Features:

- AI-powered OCR: 99.2% accuracy on receipts, invoices, and bills. Extract vendor, amount, date, category, and tax automatically.
- 30-second processing: Upload a photo. Get structured data. Export instantly. No manual entry. No spreadsheet cleanup.
- Gmail auto-fetch: Connect inboxes and let ReceiptMind discover receipt emails, attachments, and forwarding aliases.
- Bank-grade security: Encryption at rest and in transit, role-based access, and audit visibility built for finance ops.
- QuickBooks integration: Map categories, vendors, and reimbursement fields to QuickBooks, Xero, and AP sync workflows.
- Analytics dashboard: Track spend by vendor, policy drift, reimbursement velocity, and month-over-month category changes.

### Section 5: Workflow

- Background: `var(--bg-surface)`.
- Padding: 80px 32px.
- Border-top and bottom: 1px solid `var(--border-default)`.
- Heading: "Three simple steps".
- Subtext: "Designed for speed on mobile, clarity for finance, and exports your accountant can trust."
- Steps container: 3 columns, gap 0, max-width 700px, centered.
- Step card: padding 32px 28px, border-right 1px solid `var(--border-subtle)` except last, text-align center.
- Step number: DM Sans, 11px, weight 500, `var(--text-ghost)`, values 01, 02, 03.
- Icon circle: 48px circle, border 1px solid `var(--border-default)`, background `var(--bg-page)`, margin 0 auto 16px.
- Step title: DM Sans, 14px, weight 500.
- Step body: DM Sans, 13px, `var(--text-muted)`, line-height 1.55.

Steps:

- 01 Upload: Drag and drop any receipt photo or PDF. Bulk upload up to 20 files at once.
- 02 AI processing: Our AI extracts vendor, amount, date, category, and policy hints with 99.2% accuracy.
- 03 Download: Export clean CSV or Excel files, or send the structured data straight to your accounting stack.

### Section 6: Pricing

- Background: `var(--bg-page)`.
- Padding: 80px 32px.
- Heading: "Simple, transparent pricing".
- Subtext: "Start free, scale when you need automation, and move to enterprise controls when your team grows."
- Billing toggle: flex align-center, gap 10px, justify-center, margin-bottom 40px, 13px DM Sans.
- Toggle pill: width 40px, height 22px, black background, 18px white thumb, radius 11px.
- Save badge: `var(--success-surface)`, `var(--success)`, 11px, weight 500, padding 2px 8px, radius 4px.
- Pricing grid: 3 columns, gap 12px, max-width 820px, centered.
- Pricing card: `var(--bg-surface)`, border 1px solid `var(--border-default)`, radius 12px, padding 24px.
- Plan name: DM Sans, 12px, weight 500, uppercase, `var(--text-ghost)`, letter-spacing 0.06em.
- Price amount: Instrument Serif, 36px, weight 400, letter-spacing -1.5px.
- Divider: 1px solid `var(--border-subtle)`, margin 16px 0.
- Feature item: flex align-center, gap 8px, DM Sans 13px, `var(--text-secondary)`.
- Check icon: 15px circle, success surface, success text.
- Featured Pro plan: border 1px solid `var(--text-primary)`, plan name amber, black CTA.
- Most popular tag: `var(--bg-subtle)`, `var(--text-muted)`, 11px uppercase, padding 3px 10px, radius 4px.

Plans:

- Free, $0, Perfect for trying us out. Features: 10 receipts/month, manual upload only, CSV export, email support. CTA: Get Started.
- Pro, $29/month, For serious freelancers. Features: unlimited receipts, Gmail auto-fetch, QuickBooks integration, priority support, analytics dashboard. CTA: Start free trial.
- Enterprise, $99/month, For teams and businesses. Features: everything in Pro, multi-user access, API access, SLA guarantee, custom onboarding, SSO/SAML. CTA: Contact Sales.

### Section 7: Testimonials

- Background: `var(--bg-surface)`.
- Padding: 80px 32px.
- Border-top: 1px solid `var(--border-default)`.
- Heading: "Loved by finance teams".
- Subtext: "From solo founders to accounting advisors, customers use ReceiptMind to reclaim time."
- Grid: 3 columns, gap 12px, max-width 860px, centered.
- Testimonial card: `var(--bg-surface)`, border 1px solid `var(--border-default)`, radius 12px, padding 24px.
- Stars: five small amber circles, 5px, gap 3px.
- Quote: DM Sans, 13px, `var(--text-secondary)`, line-height 1.6, italic, no quote marks.
- Divider: 1px solid `var(--border-subtle)`.
- Author row: margin-top 16px, flex align-center, gap 10px.
- Avatar: 34px circle, subdued background, initials only, 11px weight 500, border 1px solid `var(--border-default)`.
- Name: DM Sans, 13px, weight 500, `var(--text-primary)`.
- Role: DM Sans, 12px, `var(--text-muted)`.

Testimonials:

- SC, Sarah Chen, Freelance Designer: "I used to spend four hours every month on expense reports. ReceiptMind does it in under a minute and the exports are accountant-ready."
- MR, Michael Rodriguez, Small Business Owner: "Tax season stopped being chaos. We just export everything to CSV and QuickBooks, and our bookkeeper actually trusts the data."
- DK, David Kim, Accounting Advisor: "I recommend ReceiptMind to every client who hates manual entry. It saves us hours every week and reduces category cleanup dramatically."

### Section 8: Final CTA

- Background: `var(--bg-page)`.
- Padding: 96px 32px.
- Text-align: center.
- Border-top: 1px solid `var(--border-default)`.
- Heading: Instrument Serif, 40px, weight 400, letter-spacing -0.8px.
- Heading text: "Ready to save 8 to 12 hours every month?"
- Subtext: DM Sans, 15px, `var(--text-muted)`, max-width 400px, centered.
- CTA group: same as hero.
- Trust line: "No credit card required. Free tier available."

### Footer

- Background: `var(--bg-invert)`.
- Padding: 48px 32px 32px.
- Color: `#666662`.
- Layout: flex, space-between, flex-wrap.
- Logo + tagline left column.
- Logo uses same treatment, white on dark.
- Tagline: 13px, `#555552`.
- Link columns: Product, Company, Legal.
- Column title: 11px, uppercase, letter-spacing 0.08em, `#444440`.
- Links: 13px, `#666662`, hover `#aaa`, no underline.
- Bottom bar: border-top 1px solid `var(--border-invert)`, margin-top 40px, padding-top 24px, flex space-between.
- Copyright: 12px, `#444440`.
- Theme toggle: small ghost button.

---

## Interaction Rules

Transitions:

- All transitions: 150ms ease.
- Only transition background-color, border-color, color, opacity, transform.
- No transitions on height, width, padding, or margin.

Hover effects:

- Buttons: opacity change only.
- Cards: border-color change only.
- Links: color change only.
- Table rows: background change only.
- Nav items: background fill.

Focus states:

- Inputs: border becomes `var(--text-primary)`, no colored outline.
- Buttons: 2px solid `var(--text-primary)` outline, 2px offset.

Animations:

- Page sections: staggered fade-up on scroll using IntersectionObserver.
- Motion: translateY(12px) to 0, opacity 0 to 1.
- Duration: 400ms, delays 0ms, 80ms, 160ms per item.
- Upload hover: background and border transition 200ms.
- No spinning loaders on page load.
- No parallax scrolling.
- No scroll-triggered scaling.
- No glitter, confetti, or particles.

---

## What To Never Build

Visual:

- Purple, violet, or indigo anything.
- Gradient backgrounds.
- Glassmorphism or backdrop-filter blur.
- Neumorphism.
- Colored section backgrounds outside white, off-white, near-black.
- Box shadows for card depth.
- Images or stock photos.
- Rounded corners above 16px.
- Pill-shaped buttons.
- Emoji in UI.
- Animated SVG blobs.
- Confetti or celebration animations.

Typography:

- Inter, Roboto, Arial, system fonts.
- Bold weight 700. Max weight is 500.
- All-caps body text.
- More than two font families.
- Font size below 11px.

Behavior:

- Scroll hijacking.
- Horizontal scrolling sections.
- Auto-playing video or audio.
- Popups on page load.
- Cookie banners blocking content.
- Sticky headers other than nav.

---

## Accessibility Rules

- All text must pass WCAG AA contrast.
- Hover states must not be the only affordance.
- Focus rings on all interactive elements.
- Alt text on all images.
- Aria-label on icon-only buttons.
- Semantic HTML: nav, main, section, article, footer.
- Heading hierarchy: one h1 per page, logical h2/h3 nesting.
- Form inputs have associated labels, not placeholder-only labels.

---

## Responsive Breakpoints

Mobile first.

- sm: 640px.
- md: 768px.
- lg: 1024px.
- xl: 1280px.

Mobile changes:

- Nav: hide links, show hamburger.
- Sidebar: hidden by default, drawer on mobile.
- Stat cards: 1 column on xs, 2 columns on sm.
- Feature grid: 1 column on sm, 2 columns on md.
- Pricing grid: 1 column on sm, 3 columns on lg.
- Page padding: 16px mobile, 32px desktop.

---

## File Structure

```text
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── dashboard/
│       ├── page.tsx
│       ├── receipts/
│       ├── reports/
│       └── settings/
├── components/
│   ├── landing/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Workflow.tsx
│   │   ├── Pricing.tsx
│   │   ├── Testimonials.tsx
│   │   └── CTA.tsx
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── StatsRow.tsx
│   │   ├── UploadZone.tsx
│   │   ├── ReceiptsTable.tsx
│   │   └── ActivityFeed.tsx
│   └── ui/
├── lib/
│   └── utils.ts
└── DESIGN_SYSTEM.md
```

Note: This repository currently uses `frontend/app` instead of `src/app`. Apply the design rules to the existing Next.js App Router structure unless the project is explicitly migrated.

---

## Final Instruction

Every component you build:

1. Use only the fonts, colors, spacing, and radius values above.
2. Check: "Does this look like Stripe.com or Linear.app?"
3. If the answer is no, simplify, remove decoration, and add whitespace.
4. The product communicates trust through restraint.
5. One amber accent. Black actions. White surfaces. That is the entire palette.
6. When in doubt: more whitespace, less color, smaller font.

This is a financial product. People are trusting it with business data. The design must feel like the safest, most reliable tool they have ever used.
