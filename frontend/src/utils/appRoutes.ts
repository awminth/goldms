import type { ActiveTab } from '../components/Navigation';

/** URL path segment for each app tab (localhost:7020/<path>). */
export const TAB_TO_PATH: Record<ActiveTab, string> = {
  dashboard: 'dashboard',
  pos: 'pos',
  'pos-sale': 'pos',
  'pos-purchase': 'pos',
  'pos-exchange': 'pos',
  'pos-history': 'pos-history',
  inventory: 'inventory',
  'old-gold': 'old-gold',
  goldsmith: 'goldsmith',
  'goldsmith-handoff': 'goldsmith-handoff',
  'order-handoff': 'order-handoff',
  categories: 'categories',
  'item-types': 'item-types',
  orders: 'orders',
  pawn: 'pawn',
  'pawn-interest': 'pawn-interest',
  'pawn-redeem': 'pawn-redeem',
  'pawn-overdue': 'pawn-overdue',
  'pawn-new': 'pawn-new',
  'pawn-interest-new': 'pawn-interest-new',
  'pawn-redeem-new': 'pawn-redeem-new',
  ledger: 'ledger',
  customers: 'customers',
  'financial-report': 'financial-report',
  'sales-performance': 'sales-performance',
  users: 'users',
  permissions: 'permissions',
  'unit-conversion': 'unit-conversion',
};

const PATH_TO_TAB: Record<string, ActiveTab> = Object.entries(TAB_TO_PATH).reduce(
  (acc, [tab, path]) => {
    if (!acc[path]) acc[path] = tab as ActiveTab;
    return acc;
  },
  {} as Record<string, ActiveTab>
);

/** Legacy URL aliases → current tabs */
PATH_TO_TAB['reports'] = 'financial-report';

export type RouteState = {
  tab: ActiveTab;
  goldsmithHandoffId: string | null;
  orderHandoffId: string | null;
  pawnEditId: string | null;
};

export function buildAppPath(state: {
  tab: ActiveTab;
  goldsmithHandoffId?: string | null;
  orderHandoffId?: string | null;
  pawnEditId?: string | null;
}): string {
  const tab = state.tab;
  if (tab === 'goldsmith-handoff' && state.goldsmithHandoffId) {
    return `/goldsmith-handoff/${encodeURIComponent(state.goldsmithHandoffId)}`;
  }
  if (tab === 'order-handoff' && state.orderHandoffId) {
    return `/order-handoff/${encodeURIComponent(state.orderHandoffId)}`;
  }
  if (tab === 'pawn-new' && state.pawnEditId) {
    return `/pawn-new/${encodeURIComponent(state.pawnEditId)}`;
  }
  return `/${TAB_TO_PATH[tab] || 'dashboard'}`;
}

export function parseAppPath(pathname: string): RouteState {
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const head = (parts[0] || 'dashboard').toLowerCase();
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  if (head === 'login') {
    return {
      tab: 'dashboard',
      goldsmithHandoffId: null,
      orderHandoffId: null,
      pawnEditId: null,
    };
  }

  const tab = PATH_TO_TAB[head] || 'dashboard';

  return {
    tab,
    goldsmithHandoffId: tab === 'goldsmith-handoff' ? id : null,
    orderHandoffId: tab === 'order-handoff' ? id : null,
    pawnEditId: tab === 'pawn-new' ? id : null,
  };
}

export function replaceAppUrl(path: string) {
  if (typeof window === 'undefined') return;
  const next = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== next) {
    window.history.replaceState(null, '', next);
  }
}

export function pushAppUrl(path: string) {
  if (typeof window === 'undefined') return;
  const next = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== next) {
    window.history.pushState(null, '', next);
  }
}
