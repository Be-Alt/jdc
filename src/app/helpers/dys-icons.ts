export type DysIconConfig = {
  icon: string;
  bgClass: string;
  textClass: string;
};

const DYS_ICON_MAP: Record<string, DysIconConfig> = {
  DYSLEXIE: {
    icon: 'Aa',
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-700'
  },
  DYSPHASIE: {
    icon: 'Or',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700'
  },
  DYSPRAXIE: {
    icon: 'Mv',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700'
  },
  DYSCALCULIE: {
    icon: '12',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700'
  },
  DYSGRAPHIE: {
    icon: 'Wr',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-700'
  },
  DYSORTHOGRAPHIE: {
    icon: 'Ab',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700'
  },
  DYSORTHO: {
    icon: 'Ab',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700'
  },
  TDAH: {
    icon: 'T+',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700'
  }
};

function normalizeDysKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function getDysIconConfig(value: string): DysIconConfig {
  const normalizedValue = normalizeDysKey(value);

  return DYS_ICON_MAP[normalizedValue] ?? {
    icon: 'D',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700'
  };
}
