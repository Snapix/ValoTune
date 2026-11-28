import { motion, MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

type BlurTextProps = {
  text: string;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  stepDuration?: number;
  blur?: number;
  distance?: number;
  effect?: 'blur' | 'zoom' | 'tilt' | 'focus' | 'drift';
  staggerFrom?: 'start' | 'center' | 'end' | 'random';
  trigger?: 'view' | 'load' | 'hover' | 'click';
  onAnimationComplete?: () => void;
  focusOnHover?: boolean;
};

const ease: [number, number, number, number] = [0.33, 1, 0.68, 1];

export default function BlurText({
  text,
  className = '',
  animateBy = 'words',
  direction = 'left',
  delay = 110,
  stepDuration = 0.5,
  blur = 12,
  distance = 70,
  effect = 'drift',
  staggerFrom = 'random',
  trigger = 'view',
  onAnimationComplete,
  focusOnHover = false
}: BlurTextProps) {
  const root = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(trigger === 'load');
  const [focused, setFocused] = useState(-1);
  const [replay, setReplay] = useState(0);
  const pieces = useMemo(() => {
    const raw = animateBy === 'words' ? text.split(/(\s+)/) : Array.from(text);
    return raw.map((content, index) => ({ content, index })).filter(piece => piece.content.length > 0);
  }, [text, animateBy]);
  const ranks = useMemo(() => {
    const result = pieces.map((_, i) => i);
    if (staggerFrom === 'end') return result.map((_, i) => result.length - 1 - i);
    if (staggerFrom === 'center') return result.map((_, i) => Math.abs(i - (result.length - 1) / 2));
    if (staggerFrom === 'random') {
      let seed = 2166136261;
      for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
      const order = result.slice();
      for (let i = order.length - 1; i > 0; i--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const j = Math.floor((seed / 4294967296) * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const rank = Array(result.length);
      order.forEach((index, position) => { rank[index] = position; });
      return rank;
    }
    return result;
  }, [pieces, staggerFrom, text]);
  useEffect(() => {
    if (trigger !== 'view' || !root.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [trigger, text]);
  useEffect(() => {
    if (!visible || !onAnimationComplete) return;
    const maxRank = Math.max(0, ...ranks);
    const timer = window.setTimeout(onAnimationComplete, (stepDuration * 1000) + maxRank * delay);
    return () => window.clearTimeout(timer);
  }, [visible, replay, ranks, stepDuration, delay, onAnimationComplete]);
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const sign = direction === 'left' || direction === 'top' ? -1 : 1;
  const initial = effect === 'zoom'
    ? { opacity: 0, filter: `blur(${blur}px)`, scale: 1.18, x: axis === 'x' ? sign * distance * 0.4 : 0, y: axis === 'y' ? sign * distance * 0.4 : 0 }
    : effect === 'tilt'
      ? { opacity: 0, filter: `blur(${blur}px)`, rotateY: axis === 'x' ? sign * 35 : 0, rotateX: axis === 'y' ? sign * 25 : 0, x: axis === 'x' ? sign * distance * 0.4 : 0, y: axis === 'y' ? sign * distance * 0.4 : 0 }
      : effect === 'focus'
        ? { opacity: 0.25, filter: `blur(${blur}px)`, scale: 1.08 }
        : { opacity: 0, filter: `blur(${blur}px)`, x: axis === 'x' ? sign * distance : 0, y: axis === 'y' ? sign * distance : 0, skewX: effect === 'drift' ? sign * 12 : 0 };
  const hidden = !visible;
  return (
    <MotionConfig reducedMotion="user">
      <p ref={root} className={className} aria-label={text} onClick={trigger === 'click' ? () => { setVisible(true); setReplay(v => v + 1); } : undefined} onPointerEnter={trigger === 'hover' ? () => { setVisible(true); setReplay(v => v + 1); } : undefined}>
        <span className="sr-only">{text}</span>
        <span className="blur-text-pieces" aria-hidden="true">
          {pieces.map((piece, index) => (
            <motion.span
              key={`${piece.index}-${replay}`}
              className="blur-text-piece"
              initial={hidden ? initial : false}
              animate={hidden ? initial : { opacity: 1, filter: 'blur(0px)', x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0, skewX: 0 }}
              transition={{ duration: stepDuration, delay: ranks[index] * delay / 1000, ease }}
              style={{ display: 'inline-block', whiteSpace: 'pre', transformPerspective: 600 }}
              onPointerEnter={focusOnHover ? () => setFocused(index) : undefined}
              onPointerLeave={focusOnHover ? () => setFocused(-1) : undefined}
              whileHover={focusOnHover ? { filter: focused === -1 || focused === index ? 'blur(0px)' : 'blur(3px)', opacity: focused === -1 || focused === index ? 1 : 0.35 } : undefined}
            >
              {piece.content}
            </motion.span>
          ))}
        </span>
      </p>
    </MotionConfig>
  );
}
