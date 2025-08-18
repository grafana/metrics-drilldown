import { CONFIG_PRESET, type PanelConfigPreset } from './types';

export const DEFAULT_STATUS_UP_DOWN_PRESETS: Record<string, PanelConfigPreset> = {
  [CONFIG_PRESET.STATUS_UPDOWN_HISTORY]: {
    id: String(CONFIG_PRESET.STATUS_UPDOWN_HISTORY),
    name: 'Status History (default)',
    panelOptions: {
      type: 'statushistory',
      description:
        'Displays binary status changes over time as colored bars (green=up, red=down). Perfect for monitoring service availability, health checks, or any binary state metrics. Shows patterns in uptime/downtime and helps identify recurring issues.',
    },
    queryOptions: {
      queries: [{ fn: 'min' }],
    },
  },
  [CONFIG_PRESET.STATUS_UPDOWN_STAT]: {
    id: String(CONFIG_PRESET.STATUS_UPDOWN_STAT),
    name: 'Stat with latest value',
    panelOptions: {
      type: 'stat',
      description:
        'Shows the current status as a single value display with color coding (green=up, red=down). Ideal for dashboards where you need an at-a-glance view of service health or binary state. Uses minimum value to ensure any "down" status is highlighted.',
    },
    queryOptions: {
      queries: [{ fn: 'min' }],
    },
  },
} as const;
