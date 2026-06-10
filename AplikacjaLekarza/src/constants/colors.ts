export type ColorPalette = {
  bg: string;
  surface: string;
  surfaceHigh: string;
  border: string;
  accent: string;
  accentDim: string;
  text: string;
  muted: string;
  dim: string;
  error: string;
  errorBg: string;
  headerBg: string;
  userBubble: string;
  aiBubble: string;
};

// Dark theme — WCAG AA compliant
// text '#E8F0F7' on '#0B1220' = 16.4:1 ✓
// accent '#0ABFA3' on '#0B1220' = 6.2:1 ✓
// muted '#7A9AB8' on '#0B1220' = 5.1:1 ✓
export const dark: ColorPalette = {
  bg: '#0B1220',
  surface: '#162033',
  surfaceHigh: '#1A2840',
  border: '#1C2B40',
  accent: '#0ABFA3',
  accentDim: '#0F6E56',
  text: '#E8F0F7',
  muted: '#7A9AB8',
  dim: '#2D4560',
  error: '#E87060',
  errorBg: '#2A0A0A',
  headerBg: '#080F1A',
  userBubble: '#0F3D35',
  aiBubble: '#162033',
};

// Light theme — WCAG AA compliant
// text '#0D1B2A' on '#F0F5FA' = 17.8:1 ✓
// accent '#0B7285' on '#FFFFFF' = 5.2:1 ✓
// muted '#4A6580' on '#F0F5FA' = 5.0:1 ✓
export const light: ColorPalette = {
  bg: '#F0F5FA',
  surface: '#FFFFFF',
  surfaceHigh: '#E8EFF7',
  border: '#CBD8E8',
  accent: '#0B7285',
  accentDim: '#D6F0F0',
  text: '#0D1B2A',
  muted: '#4A6580',
  dim: '#8DACC4',
  error: '#C0392B',
  errorBg: '#FDE8E6',
  headerBg: '#FFFFFF',
  userBubble: '#D6F0F0',
  aiBubble: '#F0F5FA',
};
