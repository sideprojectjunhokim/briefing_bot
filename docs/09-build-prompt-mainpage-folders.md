# 09. 빌드 프롬프트 — 메인 페이지 (mosbyfiles 스타일 "파일 폴더 스택")

> 레퍼런스: mosbyfiles.com (Nuxt+Storyblok). 스큐어모픽 서류철 스택 UI.
> 폴더 = 온보딩에서 고른 관심사 태그. 클릭 → 폴더 펼쳐짐(unfold) → 그 분야 오늘 브리핑 노출.
> mosbyfiles CSS에서 직접 뽑은 디자인 DNA를 프롬프트에 박아둠.

## mosbyfiles 디자인 DNA
- 메타포: 물리적 서류 캐비닛. 종이 폴더가 -3deg 기울고 perspective 3000px, 3.75rem 오프셋으로 스택. 사다리꼴 탭(중앙+양쪽 각진 조각, aspect 1.409)에 카테고리명. 클릭 시 폴더 65vh 위로 슬라이드하며 전체 내용 페이지 오픈.
- 팔레트: 종이 #fdfaf7 / 잉크 #191919 / 그레이 #787a7f + 일렉트릭 블루 #00b2ff(보조 #1e4bd7) + 레드 #bd2c2c.
- 타입: Signifier(light serif, 디스플레이/본문), Founders Grotesk X-Condensed Bold(큰 라벨), IBM Plex Mono/JetBrains Mono(태그·메타).
- 레이아웃: 좌측 ~14rem 사이드바 + 메인 스택. radius 4px, 은은한 그림자, 넉넉한 여백, 큐레이토리얼 무드.

---

## 붙여넣을 프롬프트 (영어 — 복붙 안전, UI는 한국어)

You are a product design engineer. Redesign the **main page** of my personal "Today's Briefing" web app in the style of a **physical filing cabinet / paper-folder stack**, inspired by mosbyfiles.com. Build it as one focused screen; stop for my approval before wiring data or extending to other pages.

### The metaphor (this is the whole idea)
Each of my selected interest categories (from onboarding, in localStorage — e.g. AI, Tech, Cars, Games, Gold) is a **paper file folder** in a stack. The stack is the day's briefing. Each folder has a **trapezoidal tab** sticking up with the category name. **Clicking a folder "unfolds" it** — it slides up and opens to reveal that category's briefing content (today's headlines) as a full file page. Closing it restacks.

### Visual language (recreate this exact DNA, apply app-wide for consistency)
- **Palette:** warm paper `#fdfaf7` ground, ink `#191919` text, gray `#787a7f` for secondary. One electric accent: blue `#00b2ff` (secondary royal `#1e4bd7`), alert red `#bd2c2c`. Keep it near-monochrome paper+ink with the blue as the only pop. Define as design tokens; support light/dark (dark = ink ground, paper text) equally.
- **Type (three roles):** a light editorial **serif** for display and prose (Signifier if licensed, else a close free serif like Newsreader/Lora); a **condensed grotesque, bold** for large labels/tab names (Founders Grotesk X-Condensed if licensed, else Archivo Expanded/Anton-adjacent — avoid overused defaults); a **monospace** for tags, timestamps, source counts (IBM Plex Mono / JetBrains Mono, both free). Self-host fonts — no webfont CDN links. Note licensing: Signifier & Founders Grotesk are commercial (Klim); use substitutes if unlicensed.
- **The folder stack (the hero mechanic):**
  - Render folders in 3D: `perspective: ~3000px`, each folder rotated ~`-3deg`, stacked with a vertical offset (~3.75rem), soft layered shadows (`0 -1px 8px rgba(0,0,0,.15)`), corner radius `4px`.
  - Tab shape is a real trapezoid (a middle segment + two angled side segments), aspect ratio ~1.409, tab name in the condensed grotesque or mono.
  - Hover: the folder lifts/peeks slightly. Click: it **unfolds** — slides up (~65vh) and its content page reveals beneath/within. The unfold is the signature motion — make it smooth and physical (spring-ish), everything else restrained. Respect `prefers-reduced-motion` (fall back to a simple fade/expand).
- **Layout:** a slim left sidebar (~14rem) as the index/nav (date, category list, settings), and the folder stack occupying the main area. Generous whitespace, archival/curatorial mood — tactile, editorial, sophisticated, not cute.

### Content mapping
- The stack shows only the categories chosen in onboarding, in the chosen order. Tab label = category name.
- A folder's **cover** may show a one-line caption (e.g. "오늘 새 소식 3건") in mono.
- An **unfolded folder** shows that category's today's briefing: 3–6 headlines with source + timestamp, a prominent "원문 보기" link per item. For number-centric categories (금 시세 등) the opened file leads with a number block + sparkline, then headlines.
- Empty category → a quiet "오늘 새 소식 없음" note on the cover. Failed source → a small mono flag.

### Tech & data
- Next.js App Router (my scaffold's `web/`). Reads interests/time from localStorage (set during onboarding). Data from Supabase `briefings` (anon read); if backend is empty, use mock data isolated behind one `lib/` data module so real data drops in later. Zero-server constraint.

### Rules
- First, agree on the **unfold interaction model** (does the whole stack reshuffle, or does one folder rise while others stay? one open at a time?) and how the opened file scrolls. Propose your recommendation, then confirm with me before coding.
- Extract the palette/type/folder primitives into a shared design-system module so the rest of the app (including the existing onboarding) can adopt this look.
- Keep mock vs. real data swappable in one `lib/`.
- End with a one-line report; don't extend to other pages before approval.

**Start with the main page (the folder stack + one folder's unfold reveal), using mock briefing data. Ask me one question first about the unfold interaction model if it could change the architecture.**
