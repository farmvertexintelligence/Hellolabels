/** Simple bottle illustration sized by volume (white cap always). */
export function BottleIcon({ volumeMl, glass, label = "#FF6A4D", height = 120 }: { volumeMl: number; glass?: boolean; label?: string; height?: number }) {
  const scale: Record<number, number> = { 250: 0.55, 300: 0.62, 500: 0.75, 1000: 0.88, 2000: 1 };
  const k = scale[volumeMl] ?? 0.75;
  const bw = 22 + 30 * k; // body width
  const top = 120 - (52 + 56 * k); // top of the neck
  const x0 = 32 - bw / 2;
  const x1 = 32 + bw / 2;
  const sh = top + 16; // shoulder
  const body = glass ? "#DCEBE4" : "#E3F0FA";
  const stroke = glass ? "#7FA898" : "#9DBAD6";
  const d = `M27 ${top} H37 V${top + 4} C 37 ${top + 11}, ${x1} ${top + 9}, ${x1} ${sh} V114 Q ${x1} 118 ${x1 - 4} 118 H${x0 + 4} Q ${x0} 118 ${x0} 114 V${sh} C ${x0} ${top + 9}, 27 ${top + 11}, 27 ${top + 4} Z`;
  const ly = sh + (118 - sh) * 0.28;
  const lh = (118 - sh) * 0.36;
  return (
    <svg width={(height * 64) / 120} height={height} viewBox="0 0 64 120" role="img" aria-label={`${volumeMl} ml ${glass ? "glass" : "plastic"} bottle`}>
      <rect x={26} y={top - 9} width={12} height={10} rx={2} fill="#fff" stroke="#CFC7B9" />
      <path d={d} fill={body} stroke={stroke} strokeWidth={glass ? 1.6 : 1} />
      <rect x={x0} y={ly} width={bw} height={lh} fill={label} />
      <rect x={x0 + bw * 0.66} y={ly} width={bw * 0.16} height={lh} fill="#fff" opacity={0.92} />
      <path d={`M${x0 + 4} ${sh + 4} V112`} stroke="#fff" strokeOpacity={0.75} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
