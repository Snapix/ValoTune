import { useRef } from 'react';
import type { CSSProperties } from 'react';
import './ElasticSlider.css';

interface Props {
  value?: number; defaultValue?: number; startingValue?: number; maxValue?: number;
  onChange?: (value: number) => void; onChangeEnd?: (value: number) => void;
  ariaLabel?: string; valuePosition?: 'top' | 'none'; disabled?: boolean;
  style?: CSSProperties; className?: string;
}
export default function ElasticSlider({ value, defaultValue = 50, startingValue = 0, maxValue = 100, onChange, onChangeEnd, ariaLabel = 'Slider', valuePosition = 'none', disabled = false, style, className = '' }: Props) {
  const internal = useRef(defaultValue);
  const current = Math.max(startingValue, Math.min(maxValue, value ?? internal.current));
  const update = (raw: number) => {
    const next = Math.max(startingValue, Math.min(maxValue, raw));
    internal.current = next;
    onChange?.(next);
  };
  return <label className={`elastic-slider ${className}`} style={style}>
    {valuePosition === 'top' && <span className="elastic-slider__value">{Math.round(current)}</span>}
    <input type="range" min={startingValue} max={maxValue} step="1" value={current} disabled={disabled} aria-label={ariaLabel} onChange={event => update(Number(event.currentTarget.value))} onPointerUp={() => onChangeEnd?.(current)} onKeyUp={() => onChangeEnd?.(current)} style={{ '--slider-progress': `${((current - startingValue) / Math.max(1, maxValue - startingValue)) * 100}%` } as CSSProperties} />
  </label>;
}
