export type PanelHeight = 's' | 'm' | 'l' | 'xl';

export function getPanelHeightInPixels(h: PanelHeight): number {
  switch (h) {
    case 's':
      return 160;
    case 'l':
      return 260;
    case 'xl':
      return 280;
    case 'm':
    default:
      return 220;
  }
}
