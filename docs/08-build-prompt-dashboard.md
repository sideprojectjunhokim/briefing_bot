# 08. 빌드 프롬프트 — 대시보드 + 세부 페이지 (온보딩 이후)

> 온보딩 완성 후 이어서 쓰는 지시문. 07의 디자인 언어를 그대로 계승한다.
> 핵심: **온보딩에서 만든 디자인 시스템을 재사용** — 색·타입·라운드·모션·공용 컴포넌트를 새로 만들지 말고 공유한다.
> 새 Claude 세션에 붙일 거면 온보딩의 토큰/컴포넌트 코드를 함께 붙여넣어 룩을 맞춘다.

---

## 붙여넣을 프롬프트 (영어 — 복붙 안전, UI는 한국어)

You are continuing the same personal web app, "Today's Briefing." **Onboarding is already built.** Now build the dashboard and its detail pages, one screen at a time, stopping after each step for my approval.

**Carry over the exact design system from onboarding — do not reinvent it.** Reuse the same color tokens, type scale, radii, spacing, motion timings, and shared primitives (Card, Chip, Button). First, extract these into a small shared design-system module (`lib/` or `components/ui/`) so every page pulls from one source. If you don't have the onboarding code, ask me to paste its tokens/components before writing anything. Keep it clean, friendly, modern; light/dark via tokens; `prefers-reduced-motion` respected.

**State to read from onboarding** — selected interest categories and briefing time live in localStorage. The dashboard reads them: show only chosen categories, in the chosen order.

**Data** — Supabase `briefings` table (anon read); if backend is empty, use mock data and isolate the swap behind one `lib/` data module so real data drops in later. Zero-server constraint (Supabase + Vercel only).

### Screens to build (each = one working screen; stop and confirm)

**1. Dashboard (`/`)**
- Header: date + live clock (KST) + settings entry. A slim "briefing generated 08:0x" marker.
- Interest filter chips (from onboarding selections) — toggle show/hide a category, persisted.
- Category cards grid, **all categories equal, no privileged hero.** Each card: category label + hue chip, 3–4 top headlines, timestamp, source count. Staggered entrance.
- Data-card variant: number-centric categories (prices, indices) reuse the same card frame with a number block + sparkline.
- States: skeleton while loading, "오늘 새 소식 없음" for empty categories (dim or hidden per setting), a one-line banner for a failed source.
- Interactions: tapping a card's header opens its **Category page**; tapping a headline opens the **Reader** (below).

**2. Category page (`/c/[key]`)**
- Full list of today's items for that one category (not just the 3–4 on the card), grouped or labeled by source, with sort (newest first) and an optional source filter.
- Access to **past briefings** for this category (previous days, simple pagination / "더 보기").
- Back to dashboard with a smooth transition. Header shows the category's hue accent.

**3. Reader (headline detail)**
- Lightweight read view for one item: title, one-paragraph summary, source name + timestamp, and a prominent "원문 보기" external link (opens the source). Prefer a bottom sheet / modal over the dashboard for quick reads; a dedicated route is fine if cleaner. Handle the external-link and back behavior clearly.

**4. Settings (`/settings`)**
- Edit interests (reuse the onboarding category chips), change briefing time, reorder categories, theme toggle (light/dark/system). Persist to localStorage (later: account). Changing interests updates the dashboard on return.

**5. Polish**
- Responsive (mobile-first — I read this on my phone in the morning), keyboard focus states, reduced-motion, contrast in both themes. Consistent page transitions. Confirm all routes reuse the shared design-system module (no drifted styles).

### Rules
- Agree on the information architecture and the `briefings` data contract before coding page logic. Small choices you make yourself and note.
- Keep mock vs. real data swappable in one `lib/` module.
- End each step with a one-line report ("this screen looks like X, next is Y"); do not advance before my approval.

**Start with step 1 (Dashboard). Before coding, ask me one question if anything about the IA (how category → category page → reader nest, or how filters behave) could change direction.**
