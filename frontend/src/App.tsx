import React, { useEffect, useState } from 'react';
import { GoldShopProvider, useGoldShop } from './context/GoldShopContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ActiveTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { PosView } from './components/PosView';
import { PosHistoryView } from './components/PosHistoryView';
import { OrdersView } from './components/OrdersView';
import { PawnView } from './components/PawnView';
import { LedgerView } from './components/LedgerView';
import { ReportsView } from './components/ReportsView';
import { SetupView } from './components/SetupView';
import { VoucherModal } from './components/VoucherModal';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { softwareSystemName } from './branding';

const ACTIVE_TAB_KEY = 'goldms_active_tab';
const PAWN_EDIT_ID_KEY = 'goldms_pawn_edit_id';

const ALL_TABS: ActiveTab[] = [
  'dashboard',
  'pos',
  'pos-sale',
  'pos-purchase',
  'pos-exchange',
  'pos-history',
  'inventory',
  'categories',
  'item-types',
  'orders',
  'pawn',
  'pawn-interest',
  'pawn-redeem',
  'pawn-overdue',
  'pawn-new',
  'pawn-interest-new',
  'pawn-redeem-new',
  'ledger',
  'reports',
  'customers',
  'users',
  'permissions',
  'unit-conversion',
];

function readStoredTab(): ActiveTab {
  try {
    const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
    if (saved === 'pos-sale' || saved === 'pos-purchase' || saved === 'pos-exchange') return 'pos';
    if (saved && (ALL_TABS as string[]).includes(saved)) return saved as ActiveTab;
  } catch {
    /* ignore */
  }
  return 'dashboard';
}

function readStoredPawnEditId(): string | null {
  try {
    return sessionStorage.getItem(PAWN_EDIT_ID_KEY);
  } catch {
    return null;
  }
}

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(readStoredTab);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [pawnEditId, setPawnEditId] = useState<string | null>(readStoredPawnEditId);
  const { language, currentUser, loading, apiError, refreshData, can } = useGoldShop();

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      if (pawnEditId) sessionStorage.setItem(PAWN_EDIT_ID_KEY, pawnEditId);
      else sessionStorage.removeItem(PAWN_EDIT_ID_KEY);
    } catch {
      /* ignore */
    }
  }, [pawnEditId]);

  const openPawnEdit = (id: string) => {
    setPawnEditId(id);
    setActiveTab('pawn-new');
  };

  const clearPawnEdit = () => setPawnEditId(null);

  const pawnNavigate = (tab: ActiveTab) => {
    if (tab !== 'pawn-new') setPawnEditId(null);
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-page dark:bg-[#121212] text-gray-700 dark:text-gray-200">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
        <p className="text-sm font-medium">
          {language === 'MM' ? 'ဒေတာများ တင်ဆောင်နေပါသည်…' : 'Loading shop data…'}
        </p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-page dark:bg-[#121212] px-4 text-center">
        <p className="text-sm text-red-600 dark:text-red-400 max-w-md">{apiError}</p>
        <button
          type="button"
          onClick={() => refreshData()}
          className="px-4 py-2 rounded-xl bg-[#D4AF37] text-white text-sm font-semibold"
        >
          {language === 'MM' ? 'ပြန်လည်ကြိုးစားမည်' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginPage />
        <VoucherModal />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-page dark:bg-[#121212] text-gray-900 dark:text-gray-100 transition-colors flex selection:bg-[#D4AF37]/30 selection:text-[#996515]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        setIsOpenMobile={setIsMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0 lg:pl-72 transition-all duration-300">
        <Header onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        <main className="flex-1 w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-24 overflow-x-hidden">
          {activeTab === 'dashboard' && can('dashboard', 'read') && <DashboardView />}
          {can('pos', 'read') && activeTab === 'pos' && <PosView />}
          {(can('pos_history', 'read') || can('pos', 'read')) &&
            activeTab === 'pos-history' && <PosHistoryView />}
          {activeTab === 'inventory' && can('inventory', 'read') && <InventoryView />}
          {activeTab === 'categories' && can('master', 'read') && (
            <SetupView section="categories" />
          )}
          {activeTab === 'item-types' && can('master', 'read') && (
            <SetupView section="item-types" />
          )}
          {activeTab === 'orders' && can('orders', 'read') && <OrdersView />}
          {can('pawn', 'read') && activeTab === 'pawn' && (
            <PawnView
              section="list"
              onNavigate={pawnNavigate}
              onEdit={openPawnEdit}
              onClearEdit={clearPawnEdit}
            />
          )}
          {can('pawn', 'read') && activeTab === 'pawn-interest' && (
            <PawnView section="interest-list" onNavigate={pawnNavigate} onClearEdit={clearPawnEdit} />
          )}
          {can('pawn', 'read') && activeTab === 'pawn-redeem' && (
            <PawnView section="redeem-list" onNavigate={pawnNavigate} onClearEdit={clearPawnEdit} />
          )}
          {can('pawn', 'read') && activeTab === 'pawn-overdue' && (
            <PawnView section="overdue-list" onNavigate={pawnNavigate} onClearEdit={clearPawnEdit} />
          )}
          {can('pawn', 'read') && activeTab === 'pawn-new' && (
            <PawnView
              section="form-create"
              onNavigate={pawnNavigate}
              editId={pawnEditId}
              onClearEdit={clearPawnEdit}
            />
          )}
          {can('pawn', 'read') && activeTab === 'pawn-interest-new' && (
            <PawnView section="form-interest" onNavigate={pawnNavigate} onClearEdit={clearPawnEdit} />
          )}
          {can('pawn', 'read') && activeTab === 'pawn-redeem-new' && (
            <PawnView section="form-redeem" onNavigate={pawnNavigate} onClearEdit={clearPawnEdit} />
          )}
          {activeTab === 'ledger' && can('ledger', 'read') && <LedgerView />}
          {activeTab === 'reports' && can('reports', 'read') && <ReportsView />}
          {activeTab === 'customers' && can('customers', 'read') && (
            <SetupView section="settings" initialTab="customers" />
          )}
          {activeTab === 'users' && can('staff', 'read') && (
            <SetupView section="settings" initialTab="users" />
          )}
          {activeTab === 'unit-conversion' &&
            (can('unit_conversion', 'read') || can('master', 'read')) && (
            <SetupView section="settings" initialTab="unit-conversion" />
          )}
          {activeTab === 'permissions' && can('permissions', 'read') && (
            <SetupView section="settings" initialTab="permissions" />
          )}
        </main>

        <VoucherModal />

        <footer className="sticky bottom-0 z-20 mt-auto border-t border-line dark:border-gray-800 bg-panel/95 dark:bg-[#161616]/95 backdrop-blur supports-[backdrop-filter]:bg-panel/90 dark:supports-[backdrop-filter]:bg-[#161616]/90 py-3 px-4 sm:px-6 lg:px-8 print:hidden shadow-[0_-4px_12px_rgba(40,35,25,0.06)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {softwareSystemName(language)}
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
              <span>KPY · Thai Gold</span>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <GoldShopProvider>
      <MainLayout />
    </GoldShopProvider>
  );
}
