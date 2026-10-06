import { useEffect, useRef, useState } from 'react';

/** Smooth incoming batches only. History, corrections and completed answers render immediately. */
export default function useSmoothAnswer(content: string, streaming: boolean) {
  const [visible, setVisible] = useState(content);
  const shown = useRef(content);
  const target = useRef(content);
  target.current = content;
  useEffect(() => {
    if (!streaming || !content.startsWith(shown.current)) {
      shown.current = content;
      setVisible(content);
    }
  }, [content, streaming]);
  useEffect(() => {
    if (!streaming) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= 32) {
        last = now;
        const full = target.current;
        if (shown.current !== full) {
          let end = motion.matches ? full.length : Math.min(full.length, shown.current.length + Math.max(2, Math.ceil((full.length - shown.current.length) / 3)));
          // Never split a UTF-16 surrogate pair.
          if (end < full.length && /[\uD800-\uDBFF]/.test(full[end - 1])) end++;
          shown.current = full.slice(0, end);
          setVisible(shown.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [streaming]);
  return !streaming || !content.startsWith(visible) ? content : visible;
}
