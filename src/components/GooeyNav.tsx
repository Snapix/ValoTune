import type { CSSProperties } from 'react';
import './GooeyNav.css';

export interface GooeyNavItem { label: string }
interface Props {
  items: GooeyNavItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}
export default function GooeyNav({ items, activeIndex, onChange, color = 'var(--accent)', size = 'md' }: Props) {
  const style = { '--nav-accent': color } as CSSProperties;
  return <nav className={`gooey-nav gooey-nav--${size}`} style={style} aria-label="Main navigation">
    {items.map((item, index) => <button type="button" key={item.label} className={index === activeIndex ? 'is-active' : ''} aria-current={index === activeIndex ? 'page' : undefined} onClick={() => onChange(index)}>{item.label}</button>)}
  </nav>;
}
