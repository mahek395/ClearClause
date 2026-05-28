const config = {
  high: {
    label: 'High Risk',
    emoji: '🔴',
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  medium: {
    label: 'Medium Risk',
    emoji: '🟡',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  low: {
    label: 'Low Risk',
    emoji: '🟢',
    className: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
};

export default function RiskBadge({ level, size = 'sm' }) {
  const risk = config[level?.toLowerCase()] || config.low;
  const sizeClass = size === 'lg'
    ? 'text-sm px-3 py-1.5 font-semibold'
    : 'text-xs px-2.5 py-1 font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${risk.className} ${sizeClass}`}>
      <span>{risk.emoji}</span>
      {risk.label}
    </span>
  );
}