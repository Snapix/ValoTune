import { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeHighIcon, VolumeLowIcon } from "@hugeicons/core-free-icons";
import "./ElasticSlider.css";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function ElasticSlider({
  value, defaultValue = 50, startingValue = 0, maxValue = 100, isStepped = false, stepSize = 1,
  onChange, onChangeEnd, orientation = "horizontal", leftIcon = <HugeiconsIcon icon={VolumeLowIcon} size={20} strokeWidth={1.75} />,
  rightIcon = <HugeiconsIcon icon={VolumeHighIcon} size={20} strokeWidth={1.75} />, iconPlacement = "outside",
  valuePosition = "top", formatValue, ticks = false, thumb = false, fillFrom, thickness = 6, activeThickness = 12,
  radius, restOpacity = 0.7, growOnHover = true, maxStretch = 50, bounce = 0.5, jumpToClick = true,
  wheel = false, trackColor = "color-mix(in srgb, currentColor 18%, transparent)", rangeColor = "currentColor",
  iconColor = "currentColor", contentColor = "currentColor", fillContentColor = "auto", thumbColor = "#ffffff",
  disabled = false, ariaLabel = "Slider", className = "", style = {}
}) {
  const lo = Math.min(startingValue, maxValue);
  const hi = Math.max(startingValue, maxValue);
  const span = hi - lo || 1;
  const controlled = value !== undefined;
  const [inner, setInner] = useState(clamp(defaultValue, lo, hi));
  const current = clamp(controlled ? value : inner, lo, hi);
  const currentRef = useRef(current);
  const rootRef = useRef(null);
  const hitRef = useRef(null);
  const trackRef = useRef(null);
  const rangeRef = useRef(null);
  const dragRef = useRef(null);
  const [active, setActive] = useState(false);
  const [stretch, setStretch] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const vertical = orientation === "vertical";
  const step = isStepped && stepSize > 0 ? stepSize : 0;
  const origin = clamp(((fillFrom ?? lo) - lo) / span, 0, 1);
  const snap = useCallback(raw => {
    const next = clamp(raw, lo, hi);
    return Number((step ? lo + Math.round((next - lo) / step) * step : next).toFixed(8));
  }, [lo, hi, step]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => {
    const track = trackRef.current;
    const range = rangeRef.current;
    if (!track || !range) return;
    const p = clamp((current - lo) / span, 0, 1);
    range.style.clipPath = vertical
      ? `inset(${(1 - Math.max(origin, p)) * 100}% 0 ${Math.min(origin, p) * 100}% 0 round ${radius ?? activeThickness / 2}px)`
      : `inset(0 ${(1 - Math.max(origin, p)) * 100}% 0 ${Math.min(origin, p) * 100}% round ${radius ?? activeThickness / 2}px)`;
  }, [current, lo, span, vertical, origin, radius, activeThickness]);
  const commit = nextRaw => {
    const next = snap(nextRaw);
    currentRef.current = next;
    if (!controlled) setInner(next);
    onChange?.(next);
  };
  const pointerValue = event => {
    const rect = hitRef.current?.getBoundingClientRect();
    if (!rect) return lo;
    const fraction = vertical ? (rect.bottom - event.clientY) / rect.height : (event.clientX - rect.left) / rect.width;
    return lo + clamp(fraction, 0, 1) * span;
  };
  const onPointerDown = event => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = hitRef.current.getBoundingClientRect();
    const fraction = clamp((currentRef.current - lo) / span, 0, 1);
    dragRef.current = { id: event.pointerId, start: vertical ? event.clientY : event.clientX, fraction };
    setActive(true); setBubbleVisible(true);
    if (jumpToClick) commit(pointerValue(event));
    else dragRef.current.rectLength = vertical ? rect.height : rect.width;
  };
  const onPointerMove = event => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const rect = hitRef.current.getBoundingClientRect();
    const length = Math.max(1, vertical ? rect.height : rect.width);
    const pos = vertical ? rect.bottom - event.clientY : event.clientX - rect.left;
    const fraction = jumpToClick ? pos / length : drag.fraction + ((vertical ? drag.start - event.clientY : event.clientX - drag.start) / length);
    const over = fraction < 0 ? fraction * length : fraction > 1 ? (fraction - 1) * length : 0;
    setStretch(maxStretch ? clamp(over, -maxStretch, maxStretch) : 0);
    commit(lo + clamp(fraction, 0, 1) * span);
  };
  const release = () => {
    if (!dragRef.current) return;
    dragRef.current = null; setActive(false); setBubbleVisible(false);
    if (!reducedMotion()) { setStretch(0); }
    else setStretch(0);
    onChangeEnd?.(currentRef.current);
  };
  const onKeyDown = event => {
    if (disabled) return;
    const unit = step || span / 100;
    const big = Math.max(unit, span / 10);
    const keys = { ArrowRight: currentRef.current + unit, ArrowUp: currentRef.current + unit, ArrowLeft: currentRef.current - unit, ArrowDown: currentRef.current - unit, PageUp: currentRef.current + big, PageDown: currentRef.current - big, Home: lo, End: hi };
    if (!(event.key in keys)) return;
    event.preventDefault(); commit(keys[event.key]); onChangeEnd?.(currentRef.current);
  };
  useEffect(() => {
    if (!wheel || disabled || !hitRef.current) return;
    const hit = hitRef.current;
    const handler = event => {
      event.preventDefault();
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? -event.deltaY : event.deltaX;
      commit(currentRef.current + (step ? Math.sign(delta) * step : delta * span / 800));
      clearTimeout(handler.timer);
      handler.timer = setTimeout(() => onChangeEnd?.(currentRef.current), 180);
    };
    hit.addEventListener("wheel", handler, { passive: false });
    return () => { hit.removeEventListener("wheel", handler); clearTimeout(handler.timer); };
  }, [wheel, disabled, step, span, lo, hi, onChange, onChangeEnd]);
  const label = formatValue ? formatValue(current) : step ? current.toFixed(String(step).split(".")[1]?.length || 0) : String(Math.round(current));
  const place = ["top", "bubble", "inside", "none"].includes(valuePosition) ? valuePosition : "top";
  const inside = iconPlacement === "inside";
  const insideStart = inside ? leftIcon : null;
  const insideEnd = place === "inside" ? <span>{label}</span> : inside ? rightIcon : null;
  const tickValues = Array.isArray(ticks) ? ticks : ticks ? (step && (hi - lo) / step <= 40 ? Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step) : Array.from({ length: 11 }, (_, i) => lo + i * span / 10)) : [];
  const marks = tickValues.filter(t => t > lo && t < hi);
  const contents = (className) => insideStart || insideEnd ? <span className={className}><span>{insideStart}</span><span>{insideEnd}</span></span> : null;
  return <div ref={rootRef} className={["elastic-slider", className].filter(Boolean).join(" ")}
    style={{ "--elastic-slider-track": trackColor, "--elastic-slider-range": rangeColor, "--elastic-slider-icon": iconColor, "--elastic-slider-content": contentColor, "--elastic-slider-fill-content": fillContentColor === "auto" ? "var(--elastic-slider-content)" : fillContentColor, "--elastic-slider-thumb": thumbColor, "--elastic-slider-hit": `${Math.max(34, thickness, activeThickness)}px`, "--elastic-slider-thickness": `${thickness}px`, "--elastic-slider-active-thickness": `${activeThickness}px`, "--elastic-slider-radius": radius === undefined ? "999px" : `${radius}px`, opacity: disabled ? 0.45 : restOpacity, ...style }}
    data-orientation={vertical ? "vertical" : "horizontal"} data-disabled={disabled ? "" : undefined}
    onPointerEnter={() => growOnHover && !disabled && setActive(true)}
    onPointerLeave={() => { if (!dragRef.current) setActive(false); }}>
    {place === "top" && <span className="elastic-slider__value" aria-hidden="true">{label}</span>}
    <div className="elastic-slider__body">
      {!inside && leftIcon && <span className="elastic-slider__icon" aria-hidden="true">{leftIcon}</span>}
      <div ref={hitRef} className="elastic-slider__hit" role="slider" tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel} aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={current} aria-valuetext={label}
        aria-orientation={vertical ? "vertical" : "horizontal"} aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={release} onPointerCancel={release}
        onLostPointerCapture={release} onKeyDown={onKeyDown}
        onFocus={() => { if (!disabled) { setActive(true); setBubbleVisible(true); } }}
        onBlur={() => { if (!dragRef.current) { setActive(false); setBubbleVisible(false); } }}>
        <div ref={trackRef} className="elastic-slider__track" style={{ height: vertical ? "100%" : (active ? activeThickness : thickness), width: vertical ? (active ? activeThickness : thickness) : "100%", transform: vertical ? `scaleX(${1 - stretch / 180}) scaleY(${1 + stretch / 250})` : `scaleX(${1 + stretch / 250}) scaleY(${1 - stretch / 180})` }}>
          {marks.map(t => <span key={t} className="elastic-slider__tick" style={vertical ? { bottom: `${(t-lo)/span*100}%` } : { left: `${(t-lo)/span*100}%` }} />)}
          {contents("elastic-slider__content")}
          <div ref={rangeRef} className="elastic-slider__range">
            {marks.map(t => <span key={t} className="elastic-slider__tick elastic-slider__tick--fill" style={vertical ? { bottom: `${(t-lo)/span*100}%` } : { left: `${(t-lo)/span*100}%` }} />)}
            {contents("elastic-slider__content elastic-slider__content--fill")}
          </div>
        </div>
        {thumb && <span className="elastic-slider__thumb" style={vertical ? { bottom: `${(current-lo)/span*100}%` } : { left: `${(current-lo)/span*100}%` }} />}
        {place === "bubble" && <span className="elastic-slider__bubble" style={{ opacity: bubbleVisible ? 1 : 0, left: vertical ? "calc(50% + 16px)" : `${(current-lo)/span*100}%`, bottom: vertical ? `${(current-lo)/span*100}%` : "calc(50% + 16px)" }}>{label}</span>}
      </div>
      {!inside && rightIcon && <span className="elastic-slider__icon" aria-hidden="true">{rightIcon}</span>}
    </div>
  </div>;
}
