/**
 * Visual language: Ge'ez manuscript, inverted. Traditional Ethiopic
 * manuscripts are black ink on vellum with rubricated (red) emphasis —
 * we keep the ink/rubric relationship but set it on a deep umber ground
 * so the glyphs themselves carry the light. Fidel is always the largest,
 * brightest thing on screen; UI chrome stays quiet.
 */
export const colors = {
  ground: '#211A14',      // deep umber — the "board"
  groundRaised: '#2E251C',
  groundSunken: '#191310',
  bone: '#F2E8D5',        // primary text — aged vellum
  boneDim: '#B5A78F',
  rubric: '#C6432D',      // rubrication red — primary action / emphasis
  rubricPressed: '#A83421',
  brass: '#D9A441',       // XP, streak flame
  leaf: '#5E8C4A',        // success
  error: '#B3402E',
  hairline: '#453727',
  overlay: 'rgba(24,18,13,0.85)',
};

export const type = {
  // System stacks: iOS renders Ethiopic via bundled fonts (Kefa et al).
  // Post-MVP: bundle Noto Serif Ethiopic for consistent Android rendering.
  fidelHero: { fontSize: 96, color: colors.bone } as const,
  fidelLarge: { fontSize: 56, color: colors.bone } as const,
  fidelBody: { fontSize: 28, color: colors.bone } as const,
  latinHero: { fontSize: 44, fontWeight: '700' as const, color: colors.bone },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.bone },
  body: { fontSize: 17, color: colors.bone },
  caption: { fontSize: 13, color: colors.boneDim, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

export const space = (n: number) => n * 4;

export const radii = { card: 16, pill: 999, key: 10 };
