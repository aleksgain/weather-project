import { Laptop, Moon, Sun } from 'lucide-react';

const MODE_LABELS = {
  system: 'System',
  dark: 'Dark',
  light: 'Light',
};

export default function ThemeToggle({ mode, resolvedTheme, onToggle }) {
  const Icon = mode === 'system' ? Laptop : resolvedTheme === 'dark' ? Moon : Sun;
  const nextMode = mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system';

  return (
    <button
      onClick={onToggle}
      className="theme-toggle glass-panel"
      aria-label={`Theme mode: ${MODE_LABELS[mode]}. Click to switch to ${MODE_LABELS[nextMode]}.`}
      title={`Theme: ${MODE_LABELS[mode]} (next: ${MODE_LABELS[nextMode]})`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{MODE_LABELS[mode]}</span>
    </button>
  );
}
