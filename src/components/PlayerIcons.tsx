import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function IconBase({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}>{children}</svg>;
}
export function PlayIcon(props: IconProps) { return <IconBase {...props}><path d="M8 5.14v13.72c0 .78.85 1.26 1.52.85l10.3-6.86a1.02 1.02 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" /></IconBase>; }
export function PauseIcon(props: IconProps) { return <IconBase {...props}><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></IconBase>; }
export function VolumeIcon(props: IconProps) { return <IconBase {...props}><path d="M3 9v6h4l5 4V5L7 9H3Zm12.5-1.5v9a5.5 5.5 0 0 0 0-9Zm0-4v2.1a7.5 7.5 0 0 1 0 12.8v2.1a9.5 9.5 0 0 0 0-17Z" /></IconBase>; }
export function NextIcon(props: IconProps) { return <IconBase {...props}><path d="M5 5.7v12.6c0 .8.9 1.3 1.6.8L16 12l-9.4-7.1C5.9 4.4 5 4.9 5 5.7ZM18 5h2v14h-2z" /></IconBase>; }
export function PreviousIcon(props: IconProps) { return <IconBase {...props}><path d="M19 5.7v12.6c0 .8-.9 1.3-1.6.8L8 12l9.4-7.1c.7-.5 1.6 0 1.6.8ZM4 5h2v14H4z" /></IconBase>; }
export function CloseIcon(props: IconProps) { return <IconBase {...props}><path d="m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z" /></IconBase>; }
