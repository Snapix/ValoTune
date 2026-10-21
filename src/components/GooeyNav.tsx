import './GooeyNav.css';

type Item = { label: string };
type Props = { items: Item[]; activeIndex: number; onChange: (index: number) => void; color?: string; size?: 'sm' | 'md' | 'lg' };
export default function GooeyNav({ items, activeIndex, onChange, color }: Props) {
  return <nav className="gooey-nav" style={{ '--nav-accent': color || 'var(--accent)' } as React.CSSProperties} aria-label="Main navigation">
    {items.map((item, index) => <button type="button" key={item.label} className={index === activeIndex ? 'active' : ''} aria-current={index === activeIndex ? 'page' : undefined} onClick={() => onChange(index)}>{item.label}</button>)}
  </nav>;
}
