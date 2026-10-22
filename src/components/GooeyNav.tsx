import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './GooeyNav.css';

export interface GooeyNavItem { label: string }
interface Props {
  items: GooeyNavItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  frame?: boolean;
  particleCount?: number;
  spread?: number;
  animationTime?: number;
  timeVariance?: number;
  gooeyness?: number;
  wobble?: number;
  hoverEffect?: boolean;
  className?: string;
}

type Pill = { x: number; y: number; width: number; height: number };

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function GooeyNav({
  items, activeIndex, onChange, color = 'var(--accent)', size = 'md',
  frame = true, particleCount = 16, spread = 56, animationTime = 700,
  timeVariance = 220, gooeyness = 0.8, wobble = 0.75, hoverEffect = true,
  className = ''
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<Pill>({ x: 0, y: 0, width: 0, height: 0 });
  const [hovered, setHovered] = useState<number | null>(null);
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, items.length - 1));
  const style = {
    '--nav-accent': color,
    '--gn-duration': `${Math.max(150, animationTime)}ms`,
    '--gn-spread': `${Math.max(0, Math.min(100, spread))}px`,
    '--gn-gooeyness': String(Math.max(0, Math.min(1, gooeyness))),
    '--gn-wobble': String(Math.max(0, Math.min(1, wobble))),
    '--gn-particle-count': String(Math.max(0, Math.min(32, particleCount))),
    '--gn-time-variance': `${Math.max(0, timeVariance)}ms`,
    '--gn-pill-x': `${pill.x}px`,
    '--gn-pill-y': `${pill.y}px`,
    '--gn-pill-w': `${pill.width}px`,
    '--gn-pill-h': `${pill.height}px`,
    '--gn-hover-x': `${hovered === null ? -1000 : itemRefs.current[hovered]?.offsetLeft ?? -1000}px`
  } as CSSProperties;

  const measure = () => {
    const root = rootRef.current;
    const active = itemRefs.current[safeIndex];
    if (!root || !active) return;
    const rootRect = root.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    setPill(current => {
      const next = { x: rect.left - rootRect.left, y: rect.top - rootRect.top, width: rect.width, height: rect.height };
      return Math.abs(current.x - next.x) < 0.5 && Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5 ? current : next;
    });
  };

  useIsoLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    itemRefs.current.forEach(item => { if (item) observer.observe(item); });
    window.addEventListener('resize', measure, { passive: true });
    document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [safeIndex, items.length, size]);

  useEffect(() => { measure(); }, [color]);

  return (
    <nav ref={rootRef} className={`gooey-nav gooey-nav--${size}${frame ? ' gooey-nav--framed' : ''}${className ? ` ${className}` : ''}`} style={style} aria-label="Main navigation">
      <span className="gooey-nav__pill" aria-hidden="true" />
      {hoverEffect && <span className="gooey-nav__hover" aria-hidden="true" />}
      <span className="gooey-nav__spark gooey-nav__spark--one" aria-hidden="true" />
      <span className="gooey-nav__spark gooey-nav__spark--two" aria-hidden="true" />
      {items.map((item, index) => (
        <button
          type="button"
          key={item.label}
          ref={element => { itemRefs.current[index] = element; }}
          className={index === safeIndex ? 'is-active' : ''}
          aria-current={index === safeIndex ? 'page' : undefined}
          onClick={() => onChange(index)}
          onPointerEnter={() => setHovered(index)}
          onPointerLeave={() => setHovered(null)}
          onFocus={() => setHovered(index)}
          onBlur={() => setHovered(null)}
        >{item.label}</button>
      ))}
      <svg className="gooey-nav__filter" aria-hidden="true" focusable="false">
        <filter id="gooey-nav-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation={1 + gooeyness * 3} result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>
    </nav>
  );
}
