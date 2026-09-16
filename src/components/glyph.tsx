import { Circle, Ellipse, G, Path, Rect, Svg } from 'react-native-svg';

/**
 * The mark that sits beside every task on Today.
 *
 * Paths are transcribed from the design's glyph sheet — ant `A3` (top-down),
 * pickaxe `P3` (crossed) and sledge `S1` (diamond). `square` is a plain bullet
 * for anyone who wants the list without an illustration.
 *
 * All four are drawn on the same 24×24 grid at a 1.5px stroke so they carry
 * equal optical weight at the 26px size the task rows use.
 */
export const GLYPH_KINDS = ['ant', 'pickaxe', 'sledge', 'square'] as const;

export type GlyphKind = (typeof GLYPH_KINDS)[number];

export const GLYPH_LABELS: Record<GlyphKind, string> = {
  ant: 'Ant',
  pickaxe: 'Pickaxe',
  sledge: 'Sledge',
  square: 'Square',
};

export function isGlyphKind(value: unknown): value is GlyphKind {
  return typeof value === 'string' && (GLYPH_KINDS as readonly string[]).includes(value);
}

export type GlyphProps = {
  kind: GlyphKind;
  size?: number;
  color?: string;
};

export function Glyph({ kind, size = 26, color = '#ffffff' }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'ant' ? <Ant color={color} /> : null}
      {kind === 'pickaxe' ? <Pickaxe color={color} /> : null}
      {kind === 'sledge' ? <Sledge color={color} /> : null}
      {kind === 'square' ? <Square color={color} /> : null}
    </Svg>
  );
}

function Ant({ color }: { color: string }) {
  return (
    <G stroke={color} strokeWidth={1.5} strokeLinecap="round">
      <Circle cx={12} cy={4.8} r={2.6} fill={color} stroke="none" />
      <Circle cx={12} cy={10.4} r={2.3} fill={color} stroke="none" />
      <Ellipse cx={12} cy={17.2} rx={3.5} ry={4.5} fill={color} stroke="none" />
      <Path d="M9.4 8.8 L5 6.6" fill="none" />
      <Path d="M14.6 8.8 L19 6.6" fill="none" />
      <Path d="M9.4 11.8 L5 13.6" fill="none" />
      <Path d="M14.6 11.8 L19 13.6" fill="none" />
      <Path d="M10.5 2.6 L8.6 0.7" fill="none" />
      <Path d="M13.5 2.6 L15.4 0.7" fill="none" />
    </G>
  );
}

function Pickaxe({ color }: { color: string }) {
  return (
    <G fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20 L18.5 5.5" />
      <Path d="M20 20 L5.5 5.5" />
      <Path d="M14 3.4 C17.6 3.4 20.6 6.4 20.6 10" />
      <Path d="M10 3.4 C6.4 3.4 3.4 6.4 3.4 10" />
    </G>
  );
}

function Sledge({ color }: { color: string }) {
  return (
    <G stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 20 L13.4 10.6" fill="none" />
      <Path d="M12.2 7.6 L16.4 3.4 L21.6 8.6 L17.4 12.8 Z" fill={color} stroke="none" />
    </G>
  );
}

function Square({ color }: { color: string }) {
  return <Rect x={7} y={7} width={10} height={10} rx={1} fill={color} />;
}
