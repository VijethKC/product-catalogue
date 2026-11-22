# UI Design — Product Catalogue

> Design specification for Step 4. Layout, visual tokens, components, states, and
> interaction rules. No mockup tooling required; the wireframes below are the source
> of truth.
> Last updated: 2026-11-22

---

## 1. Principles

1. **Catalogue first.** Products are the content; chrome stays quiet.
2. **One clear action per page.** Home browses, detail enquires.
3. **Every state designed.** Loading, empty, and error are part of the UI, not an afterthought.
4. **Mobile first.** Works from 360px up; desktop is an enhancement.
5. **Accessible by default.** Semantic HTML, labelled controls, visible focus, keyboard paths.
6. **Tailwind only.** No component library, no external fonts, no icon package.

---

## 2. Visual language

### Colour tokens (Tailwind default palette)

| Token | Value | Usage |
|---|---|---|
| Page background | `bg-slate-50` | App background |
| Surface | `bg-white` | Header, cards, forms |
| Text primary | `text-slate-900` | Headings, product titles |
| Text secondary | `text-slate-600` | Descriptions, metadata |
| Border | `border-slate-200` | Cards, dividers, inputs |
| Accent | `bg-indigo-600` / `text-indigo-600` | Primary buttons, links, active nav |
| Accent hover | `bg-indigo-700` | Button hover |
| Rating | `text-amber-500` | Stars |
| Error | `text-red-600` / `bg-red-50` | Validation, error state |
| Success | `text-emerald-700` / `bg-emerald-50` | Thank-you confirmation |
| Focus ring | `ring-2 ring-indigo-500 ring-offset-2` | All interactive elements |

Contrast: primary text on white and white text on `indigo-600` both meet WCAG AA.

### Typography

- System sans stack (Tailwind default). No web fonts.
- Page title: `text-2xl sm:text-3xl font-semibold tracking-tight`
- Section title: `text-lg font-semibold`
- Card title: `text-base font-medium line-clamp-2`
- Body: `text-sm sm:text-base text-slate-600`
- Price: `text-lg font-semibold text-slate-900`
- Meta/labels: `text-xs uppercase tracking-wide text-slate-500`

### Spacing and shape

- Container: `mx-auto max-w-6xl px-4 sm:px-6`
- Page vertical rhythm: `py-8 sm:py-12`
- Section gap: `space-y-8`
- Grid gap: `gap-4 sm:gap-6`
- Cards: `rounded-xl border border-slate-200 bg-white shadow-sm`
- Inputs: `rounded-lg border border-slate-300 px-3 py-2`
- Buttons: `rounded-lg px-4 py-2 font-medium`
- Radius: `rounded-lg` controls, `rounded-xl` cards.

### Imagery

- Product images use the upstream URL, `object-contain`, fixed aspect ratio
  (`aspect-square`), white padding.
- `alt` = product title.
- If an image fails to load, show a neutral placeholder block with the product title.

---

## 3. Layout shell

```
┌──────────────────────────────────────────────────────────────┐
│  skip link (visible on focus)                                │
├──────────────────────────────────────────────────────────────┤
│  Header (sticky, white, border-b)                            │
│  Product Catalogue        [ search… ] [ Search ]             │
│  Categories: All · Electronics · Jewelery · Men · Women      │
├──────────────────────────────────────────────────────────────┤
│  main (max-w-6xl, px-4, py-8)                                │
│                                                              │
│  page content                                                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Footer: "Product catalogue demo · data from Fake Store"     │
└──────────────────────────────────────────────────────────────┘
```

- Header is sticky on scroll, `z-10`.
- Search sits in the header on `sm+`; stacks below the logo on mobile.
- Category nav is a horizontal, scrollable row of links (not a dropdown).
- Active category link: `text-indigo-600 font-medium` + underline offset.
- Footer is minimal; no links required.

---

## 4. Pages

### 4.1 Home — `/`

```
Top rated products
Five favourites chosen by our team

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ image  │ │ image  │ │ image  │ │ image  │ │ image  │
│ title  │ │ title  │ │ title  │ │ title  │ │ title  │
│ ★ 4.6  │ │ ★ 4.1  │ │ ★ 3.9  │ │ ★ 4.2  │ │ ★ 4.7  │
│ $695   │ │ $22.30 │ │ $109.95│ │ $64    │ │ $55.99 │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`.
- Each card links to `/products/:id`.
- Empty state if the featured list is empty (should not happen in practice).
- Error state with retry if the API fails.

### 4.2 Category — `/categories/:category`

```
← All categories
Electronics
6 products

Top rated
┌────────┐ ┌────────┐ ┌────────┐
│ card   │ │ card   │ │ card   │
└────────┘ └────────┘ └────────┘

More in Electronics
┌────────┐ ┌────────┐ ┌────────┐
│ card   │ │ card   │ │ card   │
└────────┘ └────────┘ └────────┘
```

- Heading uses the canonical category name returned by the API.
- Show `topRated` only if non-empty; show `additional` only if non-empty.
- Product count = `topRated.length + additional.length`.
- Unknown category → `Category not found` state with a link back home.
- Breadcrumb/back link: `← All categories` to `/`.

### 4.3 Search — `/search?q=`

```
Search results for "drive"
1 product

┌────────┐
│ card   │
└────────┘
```

- Header search input keeps the current query.
- Submitting with fewer than 2 characters shows inline hint: `Enter at least 2 characters`.
- Empty result: `No products match "drive"` + suggestion to try another term + link home.
- Missing/empty `q`: prompt state — `Search the catalogue` with the input focused.
- Results use the same `ProductGrid`.

### 4.4 Product detail — `/products/:id`

```
← Back

┌──────────────────┐   John Hardy Women's Naga Bracelet
│                  │   Jewelery · ★ 4.6 (400 reviews)
│      image       │   $695.00
│                  │
└──────────────────┘   From our Legends Collection…

                       ── Enquire about this product ──
                       Name        [____________]
                       Email       [____________]
                       Message     [____________]
                                   [ Send enquiry ]
```

- Two columns on `lg` (`grid-cols-2`), stacked on mobile.
- Title, category badge, rating (stars + count), price, description.
- Enquiry form sits in the right column under the product info.
- Back link to the previous category/home (use browser history fallback to `/`).
- Invalid id or unknown product → `Product not found` state.

### 4.5 Not found — `*`

```
404
We couldn't find that page.
[ Back to catalogue ]
```

---

## 5. Components

| Component | Responsibility |
|---|---|
| `Layout` | Skip link, header, main landmark, footer |
| `Header` | Logo link, `SearchForm`, `CategoryNav` |
| `SearchForm` | Controlled input, submit on Enter/button, min-2 validation hint |
| `CategoryNav` | Category links, active state, horizontal scroll on mobile |
| `ProductCard` | Image, title, rating, price; whole card is a link |
| `ProductGrid` | Responsive grid + optional empty slot |
| `RatingStars` | Visual stars from `rating.rate` + accessible text `4.6 out of 5, 400 reviews` |
| `Price` | Currency formatting (`Intl.NumberFormat`, USD) |
| `EnquiryForm` | Name, email, optional message, validation, pending state, success/error |
| `LoadingState` | Skeleton cards (grid) or skeleton detail |
| `ErrorState` | Message + `Try again` button |
| `EmptyState` | Title, guidance, optional action link |
| `Button` | Variants: primary, secondary, ghost; disabled state |

All components are function components with explicit props types. No default exports
except page components used by the router.

---

## 6. States and feedback

### Loading
- Grid pages: 5–6 skeleton cards with `animate-pulse` (`motion-reduce:animate-none`).
- Detail: skeleton image + text lines.
- Never show a blank page.

### Error
- `ErrorState`: `Something went wrong` + short reason + `Try again`.
- Retry calls React Query `refetch`.
- API error messages from the envelope are shown when safe; otherwise the generic copy.

### Empty
- Home: `No featured products yet`.
- Category: `No products in this category yet`.
- Search: `No products match "<q>"`.

### Enquiry form

| State | Behaviour |
|---|---|
| Idle | Button enabled, no messages |
| Invalid | Field-level messages, `aria-invalid`, focus first invalid field |
| Pending | Button `Sending…` + disabled, inputs disabled |
| Success | Form replaced by `Thank you — we'll be in touch shortly.` in an `aria-live` region |
| Failure | `We couldn't send your enquiry. Please try again.` + retry, form values preserved |

Validation rules mirror `enquirySchema`:
- `name`: 2–100 chars, required
- `email`: valid address, required
- `message`: optional, ≤ 2000 chars, character counter after 1800

---

## 7. Responsive rules

| Breakpoint | Behaviour |
|---|---|
| `< 640px` | Single-column cards; header stacks logo/search/nav; detail stacks; form full width |
| `640–1023px` | 2-column grid; detail still stacked |
| `1024px+` | 3-column grid; detail two columns |
| `1280px+` | Home featured shows 5 in one row |

No horizontal scrolling except the category nav on small screens. Tap targets ≥ 44px.

---

## 8. Accessibility checklist

- [ ] Skip link to `#main`.
- [ ] One `<h1>` per page; headings in order.
- [ ] `<header>`, `<nav>`, `<main>`, `<footer>` landmarks.
- [ ] Every input has a visible `<label>` (no placeholder-only labels).
- [ ] Errors linked with `aria-describedby`; `aria-invalid` on failure.
- [ ] Success/failure announcements in an `aria-live="polite"` region.
- [ ] Product images have meaningful `alt`; decorative elements `aria-hidden`.
- [ ] Focus visible on every interactive element.
- [ ] Keyboard: search submits with Enter, cards reachable with Tab, form fully operable.
- [ ] `prefers-reduced-motion` respected for skeletons/transitions.
- [ ] Colour is never the only signal (errors also have text/icons).

---

## 9. Copy

| Context | Copy |
|---|---|
| Home heading | `Top rated products` |
| Home subheading | `Five favourites chosen by our team` |
| Category back link | `← All categories` |
| Category empty | `No products in this category yet` |
| Search hint | `Enter at least 2 characters` |
| Search empty | `No products match "<query>"` |
| Detail CTA | `Send enquiry` |
| Form success | `Thank you — we'll be in touch shortly.` |
| Form failure | `We couldn't send your enquiry. Please try again.` |
| Generic error | `Something went wrong` |
| 404 | `We couldn't find that page.` |

Tone: plain, short, no exclamation marks.

---

## 10. Out of scope

Dark mode, animations beyond skeleton pulse, carousels, wishlists, cart, filters beyond
category/search, pagination controls, sorting UI, and a component library.

---

## 11. Acceptance for Step 4

- All five pages render the layouts above at 360px, 768px, and 1280px.
- Loading, empty, and error states exist on every data-driven page.
- Enquiry form validates, shows pending, and renders success/error states.
- Keyboard-only navigation completes browse → detail → enquiry.
- No direct Fake Store calls from the browser.
- Web tests target roles and labels defined here.
