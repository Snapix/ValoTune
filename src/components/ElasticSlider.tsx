import { useEffect, useState, type CSSProperties } from 'react';
import './ElasticSlider.css';

type Props = { value: number; onChange: (value: number) => void; onChangeEnd?: (value: number) => void; startingValue?: number; maxValue?: number; minValue?: number; maxStretch?: number; restOpacity?: number; valuePosition?: 'left' | 'right' | 'none'; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; style?: CSSProperties; ariaLabel?: string; formatValue?: (value: number) => string };
export default function ElasticSlider({ value, onChange, onChangeEnd, startingValue = 0, maxValue = 100, minValue = 0, style, ariaLabel = 'Slider', leftIcon, rightIcon }: Props) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return <div className="elastic-slider" style={style}>
    {leftIcon && <span className="elastic-icon">{leftIcon}</span>}
    <input aria-label={ariaLabel} type="range" min={minValue} max={maxValue} step="1" value={Math.min(maxValue, Math.max(minValue, local ?? startingValue))} onChange={e => { const n = Number(e.target.value); setLocal(n); onChange(n); }} onPointerUp={() => onChangeEnd?.(local)} onKeyUp={() => onChangeEnd?.(local)} />
    {rightIcon && <span className="elastic-icon">{rightIcon}</span>}
  </div>;
}
