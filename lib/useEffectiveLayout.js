import { useEffect, useMemo, useState } from 'react';
import { parseAppPath } from './routes.js';

export const DESKTOP_BREAKPOINT = 900;

const MQ_DESKTOP = `(min-width: ${DESKTOP_BREAKPOINT}px)`;
const MQ_COARSE = '(pointer: coarse)';

function readMatches() {
  if (typeof window === 'undefined') {
    return { isWide: false, isCoarse: false };
  }
  return {
    isWide: window.matchMedia(MQ_DESKTOP).matches,
    isCoarse: window.matchMedia(MQ_COARSE).matches,
  };
}

/**
 * Gộp URL (/desktop/...) với kích thước màn hình:
 * - Màn hẹp (<900px): luôn mobile full màn — kể cả khi URL là /desktop (tránh vỡ UI điện thoại)
 * - Màn rộng + /desktop: sidebar + lưới rộng
 * - Màn rộng + URL mobile (/san-pham): khung iOS preview trên PC
 */
export function useEffectiveLayout(pathname) {
  const urlLayout = useMemo(() => parseAppPath(pathname).layout, [pathname]);
  const [{ isWide, isCoarse }, setMatches] = useState(readMatches);

  useEffect(() => {
    const wide = window.matchMedia(MQ_DESKTOP);
    const coarse = window.matchMedia(MQ_COARSE);
    const update = () => setMatches({ isWide: wide.matches, isCoarse: coarse.matches });
    update();
    wide.addEventListener('change', update);
    coarse.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      coarse.removeEventListener('change', update);
    };
  }, []);

  const effectiveLayout = !isWide
    ? 'mobile'
    : (urlLayout === 'desktop' ? 'desktop' : 'mobile');
  const isNativeMobile = effectiveLayout === 'mobile' && (isCoarse || !isWide);
  const showIOSFrame = effectiveLayout === 'mobile' && isWide && !isCoarse;
  const useSplitProducts = effectiveLayout === 'desktop';

  return {
    urlLayout,
    effectiveLayout,
    isNativeMobile,
    showIOSFrame,
    useSplitProducts,
    isWide,
  };
}
