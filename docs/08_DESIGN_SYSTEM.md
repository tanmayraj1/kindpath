# KindPath — Design System & UI Guidelines

The visual language is **token-driven**: every color, radius, shadow, and type size is defined
once and consumed everywhere, so all three portals stay uniform. Edit tokens, not components.

## 1. Sources of truth
| Concern | File |
|---------|------|
| Color tokens (CSS variables, light + dark) | `src/app/globals.css` |
| Token → Tailwind mapping, type scale, shadows, radii | `tailwind.config.ts` |
| Reusable primitives | `src/components/ui/*` |
| Brand wordmark/glyph | `src/components/brand/logo.tsx` |

## 2. Color
- **Brand** = trust indigo (`brand-50…950`). Primary actions, links, active states.
- **Accent** = warm violet — used only in the `brand-gradient` for hero/CTA emphasis.
- **Semantic:** `success` (green), `warning` (amber), `destructive` (red), each with a
  `-foreground` pair. Status badges and alerts use these — never raw hex.
- **Neutrals:** `background`, `foreground`, `muted`, `secondary`, `border`, `card`.
- **Dark mode** ships via the `.dark` class with a full token override.

> Rule: never hard-code colors in components. Use token classes (`bg-brand-50`,
> `text-muted-foreground`, `border-border`, etc.) so theming stays consistent.

## 3. Typography
- **Display font:** Sora (headings, stat numbers) → `font-display`.
- **Body font:** Inter → `font-sans` (default on `body`).
- **Type scale** (in `tailwind.config.ts`) is a 1.25 ratio with tuned line-heights and negative
  letter-spacing on large sizes. Use scale steps (`text-sm`…`text-6xl`), not arbitrary sizes.

## 4. Spacing & layout
- **4px base grid** (Tailwind default) — all spacing is multiples of 4.
- **Container:** centered, max-width 1280px, responsive padding (`.container`).
- **Section rhythm:** use the `<Section>` component (`py-20 sm:py-28`) for uniform vertical spacing.
- **Card padding:** 24px (`p-6`) standard; 20px (`p-5`) for dense dashboard stat cards.

## 5. Radii & elevation
- **Radius token:** `--radius: 0.75rem`. Derived: `sm/md/lg/xl/2xl`. Cards use `rounded-2xl`,
  buttons/inputs `rounded-lg`, pills/badges `rounded-full`.
- **Shadows:** soft, layered scale `shadow-xs…xl` plus `shadow-brand` (colored glow for primary
  CTAs). Hover elevation on interactive cards only.

## 6. Components (the kit)
| Component | Variants / notes |
|-----------|------------------|
| `Button` | `primary`, `accent` (gradient), `secondary`, `outline`, `ghost`, `link`, `destructive`; sizes `sm/md/lg/icon`. For links, apply `buttonVariants()` to `<Link>`. |
| `Card` | + `CardHeader/Title/Description/Content/Footer`; `interactive` adds hover lift. |
| `Badge` | `brand`, `neutral`, `success`, `warning`, `destructive`, `outline`. |
| `Input`, `Label` | Uniform 44px height, consistent focus ring. |
| `Section`, `SectionHeading` | Page rhythm + eyebrow/title/description blocks. |
| `Logo` | Wordmark + gradient glyph. |

## 7. Interaction & motion
- **Focus:** one global focus-visible ring (`ring-ring` + offset) on all interactive elements.
- **Transitions:** 200ms on buttons; 300ms card hover lift. Entrance: `animate-fade-in-up`.
- **Active:** buttons scale to `0.98` for tactile feedback.

## 8. Accessibility
- Color pairs meet contrast via `-foreground` tokens.
- Every icon-only control has `aria-label`; decorative SVGs use `aria-hidden`.
- Keyboard focus is always visible; toggles use `role="switch"` + `aria-checked`.

## 9. Adding a new screen — checklist
1. Wrap content in `.container` (marketing) or the dashboard layout.
2. Use `Section`/`SectionHeading` for marketing rhythm.
3. Compose from `ui/*` primitives; don't introduce one-off styles.
4. Use token classes only (no hex, no arbitrary spacing unless unavoidable).
5. Verify light + dark, mobile + desktop, and keyboard focus.
