/**
 * The Lucide icons this app uses, imported one file at a time.
 *
 * Importing from the `lucide-react-native` barrel pulls the entire 1600-icon
 * set into the bundle — Metro does not tree-shake it — which measured at about
 * 2MB of Hermes bytecode for the five icons below. The `lucide-react-native/icons/*`
 * subpath is Lucide's own documented per-icon entry point and costs only what
 * is actually imported.
 *
 * Add new icons here rather than importing from the barrel anywhere else.
 *
 * All are drawn on a 24x24 grid with round caps, so `strokeWidth={1.5}` puts
 * them in the same weight class as the hand-built glyphs in `glyph.tsx`.
 */

export { default as GripVertical } from 'lucide-react-native/icons/grip-vertical';
export { default as Info } from 'lucide-react-native/icons/info';
export { default as List } from 'lucide-react-native/icons/list';
export { default as Settings } from 'lucide-react-native/icons/settings';

/** The stroke weight that matches `glyph.tsx`'s ant, pickaxe and sledge. */
export const IconStroke = 1.5;
