import {
  BellRing,
  CircleCheck,
  CircleHelp,
  Cloud,
  CloudSun,
  Flame,
  Globe,
  MapPin,
  Plug,
  TrendingUp,
  ZapOff,
} from 'lucide-react';

/*
 * content.js names icons as strings so it stays a pure data module. This is
 * the one place those names resolve to components — a named map rather than a
 * dynamic lookup, so the bundler can still drop what the page never renders.
 */
export const MARKETING_ICONS = {
  BellRing,
  CircleCheck,
  CircleHelp,
  Cloud,
  CloudSun,
  Flame,
  Globe,
  MapPin,
  Plug,
  TrendingUp,
  ZapOff,
};
