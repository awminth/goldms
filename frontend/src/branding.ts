/** Website (browser tab) — Marctober Tech */
export const WEBSITE_TITLE = 'Marctober Tech';
export const WEBSITE_FAVICON = '/favicon.webp';

/** Internal shop software branding — Shwe Pyae Hlaing */
export const SOFTWARE_LOGO = '/brand/shwe-pyae-hlaing-logo.png';
/** Sidebar / dark-panel logo (black background artwork) */
export const SOFTWARE_SIDEBAR_LOGO = '/brand/shwe-pyae-hlaing-sidebar-logo.png';

export const SOFTWARE_NAME = {
  en: 'Shwe Pyae Hlaing',
  mm: 'ရွှေပြည့်လှိုင်',
} as const;

export const SOFTWARE_TAGLINE = {
  en: 'Guaranteed Jewelry Gold Shop',
  mm: 'အာမခံရတနာရွှေဆိုင်',
} as const;

export const SOFTWARE_SYSTEM_NAME = {
  en: 'Shwe Pyae Hlaing Gold MS',
  mm: 'ရွှေပြည့်လှိုင် စီမံခန့်ခွဲမှုစနစ်',
} as const;

export function softwareName(language: 'MM' | 'EN'): string {
  return language === 'MM' ? SOFTWARE_NAME.mm : SOFTWARE_NAME.en;
}

export function softwareTagline(language: 'MM' | 'EN'): string {
  return language === 'MM' ? SOFTWARE_TAGLINE.mm : SOFTWARE_TAGLINE.en;
}

export function softwareSystemName(language: 'MM' | 'EN'): string {
  return language === 'MM' ? SOFTWARE_SYSTEM_NAME.mm : SOFTWARE_SYSTEM_NAME.en;
}
