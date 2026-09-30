import React, { useEffect, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { ActiveTab } from './Navigation';
import {
  LayoutDashboard,
  Gem,
  Clock,
  HandCoins,
  BookOpenCheck,
  FileSpreadsheet,
  Trophy,
  Settings2,
  Tags,
  Package,
  Users,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  X,
  Scale,
  List,
  Percent,
  CheckCircle2,
  AlertOctagon,
  ReceiptText,
  ShoppingBag,
  PackageOpen,
  Hammer,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { SOFTWARE_SIDEBAR_LOGO, softwareName, softwareTagline } from '../branding';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpenMobile?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
}

const SETUP_TABS: ActiveTab[] = [
  'categories',
  'item-types',
  'users',
  'customers',
  'permissions',
  'unit-conversion',
];

const PAWN_TABS: ActiveTab[] = [
  'pawn',
  'pawn-interest',
  'pawn-redeem',
  'pawn-overdue',
  'pawn-new',
  'pawn-interest-new',
  'pawn-redeem-new',
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile = false,
  setIsOpenMobile,
}) => {
  const { customOrders, goldsmithJobs, language, can, pawnRecords } = useGoldShop();
  useBodyScrollLock(isOpenMobile);

  const pendingOrders = customOrders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

  const today = new Date().toISOString().slice(0, 10);
  const goldsmithOverdue = goldsmithJobs.filter(
    (j) => j.status === 'SENT' && j.return_due_date && j.return_due_date < today
  ).length;
  const goldsmithReturnedOrders = goldsmithJobs.filter(
    (j) => j.status === 'RETURNED' && j.source_type === 'ORDER'
  ).length;
  // Notify: overdue returns + ORDER jobs ready for handoff on Orders page
  const goldsmithPending = goldsmithOverdue + goldsmithReturnedOrders;

  const overdueCount = pawnRecords.filter(
    (r) =>
      r.status !== 'REDEEMED' &&
      r.status !== 'CONFISCATED' &&
      (r.status === 'OVERDUE' || r.due_date < today)
  ).length;

  const setupOpenByDefault = SETUP_TABS.includes(activeTab);
  const [setupOpen, setSetupOpen] = useState(setupOpenByDefault);
  const pawnOpenByDefault = PAWN_TABS.includes(activeTab);
  const [pawnOpen, setPawnOpen] = useState(pawnOpenByDefault);

  useEffect(() => {
    if (SETUP_TABS.includes(activeTab)) setSetupOpen(true);
  }, [activeTab]);

  useEffect(() => {
    if (PAWN_TABS.includes(activeTab)) setPawnOpen(true);
  }, [activeTab]);

  const mainNavTop = [
    {
      id: 'dashboard' as ActiveTab,
      labelMM: 'ပင်မစာမျက်နှာ',
      labelEN: 'Dashboard',
      icon: LayoutDashboard,
      badge: null as string | number | null,
      module: 'dashboard',
    },
    {
      id: 'pos' as ActiveTab,
      labelMM: 'အရောင်း / အဝယ် / အလဲ',
      labelEN: 'Sale / Buy / Exchange',
      icon: ShoppingBag,
      badge: null as string | number | null,
      module: 'pos',
    },
    {
      id: 'pos-history' as ActiveTab,
      labelMM: 'ဘောင်ချာမှတ်တမ်း',
      labelEN: 'Voucher History',
      icon: ReceiptText,
      badge: null as string | number | null,
      module: 'pos_history',
    },
    {
      id: 'inventory' as ActiveTab,
      labelMM: 'အထည်စတော့ & ဘားကုဒ်',
      labelEN: 'Inventory & Barcodes',
      icon: Gem,
      badge: null as string | number | null,
      module: 'inventory',
    },
    {
      id: 'old-gold' as ActiveTab,
      labelMM: 'အဟောင်းထည်',
      labelEN: 'Old Gold',
      icon: PackageOpen,
      badge: null as string | number | null,
      module: 'inventory',
    },
    {
      id: 'orders' as ActiveTab,
      labelMM: 'Order တင်ခြင်း & စရံ',
      labelEN: 'Orders & Deposits',
      icon: Clock,
      badge: pendingOrders > 0 ? pendingOrders : null,
      badgeColor: 'bg-amber-500',
      module: 'orders',
    },
    {
      id: 'goldsmith' as ActiveTab,
      labelMM: 'ပန်းထိမ်အပ်',
      labelEN: 'Goldsmith',
      icon: Hammer,
      badge: goldsmithPending > 0 ? goldsmithPending : null,
      badgeColor: 'bg-violet-500',
      module: 'goldsmith',
    },
  ].filter((item) =>
    item.id === 'pos-history'
      ? can('pos_history', 'read') || can('pos', 'read')
      : can(item.module, 'read')
  );

  const mainNavBottom = [
    {
      id: 'ledger' as ActiveTab,
      labelMM: 'အခြားဝင်ငွေ / ထွက်ငွေ',
      labelEN: 'Other Income / Expense',
      icon: BookOpenCheck,
      badge: null as string | number | null,
      badgeColor: undefined as string | undefined,
      module: 'ledger',
    },
    {
      id: 'financial-report' as ActiveTab,
      labelMM: 'ဘဏ္ဍာရေးအစီရင်ခံစာ',
      labelEN: 'Financial Report',
      icon: FileSpreadsheet,
      badge: null as string | number | null,
      badgeColor: undefined as string | undefined,
      module: 'reports',
    },
    {
      id: 'sales-performance' as ActiveTab,
      labelMM: 'ရောင်းအားအစီရင်ခံစာ',
      labelEN: 'Sales Performance',
      icon: Trophy,
      badge: null as string | number | null,
      badgeColor: undefined as string | undefined,
      module: 'reports',
    },
  ].filter((item) => can(item.module, 'read'));

  const pawnChildren = can('pawn', 'read')
    ? [
        {
          id: 'pawn' as ActiveTab,
          labelMM: 'အပေါင်စာရင်း',
          labelEN: 'Pawn List',
          icon: List,
          badge: null as number | null,
        },
        {
          id: 'pawn-interest' as ActiveTab,
          labelMM: 'အတိုးစာရင်း',
          labelEN: 'Interest List',
          icon: Percent,
          badge: null as number | null,
        },
        {
          id: 'pawn-redeem' as ActiveTab,
          labelMM: 'အရွေးစာရင်း',
          labelEN: 'Redeem List',
          icon: CheckCircle2,
          badge: null as number | null,
        },
        {
          id: 'pawn-overdue' as ActiveTab,
          labelMM: 'ရက်လွန်အပေါင်များ',
          labelEN: 'Overdue Pawns',
          icon: AlertOctagon,
          badge: overdueCount > 0 ? overdueCount : null,
        },
      ]
    : [];

  const setupChildren = [
    {
      id: 'categories' as ActiveTab,
      labelMM: 'Categories (ပဲရည်)',
      labelEN: 'Categories',
      icon: Tags,
      visible: can('master', 'read'),
    },
    {
      id: 'item-types' as ActiveTab,
      labelMM: 'ပစ္စည်းအမျိုးအစား',
      labelEN: 'Item Types',
      icon: Package,
      visible: can('master', 'read'),
    },
    {
      id: 'customers' as ActiveTab,
      labelMM: 'ဖောက်သည်',
      labelEN: 'Customers',
      icon: Users,
      visible: can('customers', 'read'),
    },
    {
      id: 'users' as ActiveTab,
      labelMM: 'အသုံးပြုသူအကောင့်',
      labelEN: 'Users',
      icon: Users,
      visible: can('staff', 'read'),
    },
    {
      id: 'unit-conversion' as ActiveTab,
      labelMM: 'ယူနစ်ပြောင်းလဲမှု',
      labelEN: 'Unit Conversion',
      icon: Scale,
      visible: can('unit_conversion', 'read') || can('master', 'read'),
    },
    {
      id: 'permissions' as ActiveTab,
      labelMM: 'ခွင့်ပြုချက်များ',
      labelEN: 'Permissions',
      icon: ShieldCheck,
      visible: can('permissions', 'read'),
    },
  ].filter((c) => c.visible);

  const showSetup = setupChildren.length > 0;
  const setupChildActive = SETUP_TABS.includes(activeTab);
  const showPawn = pawnChildren.length > 0;
  const pawnChildActive = PAWN_TABS.includes(activeTab);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsOpenMobile?.(false);
  };

  return (
    <>
      {isOpenMobile && (
        <div
          onClick={() => setIsOpenMobile?.(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        id="app-left-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-panel dark:bg-[#161616] border-r border-line dark:border-[#D4AF37]/20 flex flex-col shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-4 py-3.5 border-b border-line dark:border-gray-800/80 bg-panel dark:bg-[#161616]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="shrink-0 rounded-xl bg-[#FAF8F2] p-1.5 ring-1 ring-[#D4AF37]/25 shadow-sm">
                <img
                  src={SOFTWARE_SIDEBAR_LOGO}
                  alt={softwareName(language)}
                  className="h-11 w-11 object-contain object-center mix-blend-multiply select-none"
                />
              </div>
              <div className="min-w-0 flex-1 border-l border-[#D4AF37]/20 pl-3">
                <p className="font-bold text-sm leading-tight text-[#996515] dark:text-[#E5C158] font-['Cinzel',serif] tracking-wide truncate">
                  {softwareName(language)}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">
                  {softwareTagline(language)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpenMobile?.(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {mainNavTop.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'goldsmith' && activeTab === 'goldsmith-handoff') ||
              (item.id === 'orders' && activeTab === 'order-handoff');
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-sm border border-[#FFD700]/30'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515] dark:hover:text-[#FFD700]'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-[#D4AF37]'
                    }`}
                  />
                  <span className="truncate">{language === 'MM' ? item.labelMM : item.labelEN}</span>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                  {item.badge !== null && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                        isActive ? 'bg-black/30' : item.badgeColor || 'bg-amber-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                </div>
              </button>
            );
          })}

          {showPawn && (
            <div className="pt-1">
              <button
                type="button"
                id="sidebar-nav-pawn-group"
                onClick={() => setPawnOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  pawnChildActive
                    ? 'bg-[#FAF8F2] dark:bg-[#222222] text-[#996515] dark:text-[#FFD700]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515] dark:hover:text-[#FFD700]'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <HandCoins className="w-4 h-4 shrink-0 text-[#D4AF37]" />
                  <span className="truncate">
                    {language === 'MM' ? 'အပေါင် / အတိုး / ရွေး' : 'Pawn / Interest / Redeem'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                    pawnOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {pawnOpen && (
                <div className="mt-0.5 ml-3 pl-2 border-l border-line dark:border-gray-800 space-y-0.5">
                  {pawnChildren.map((child) => {
                    const Icon = child.icon;
                    const isActive =
                      activeTab === child.id ||
                      (child.id === 'pawn' && activeTab === 'pawn-new') ||
                      (child.id === 'pawn-interest' && activeTab === 'pawn-interest-new') ||
                      (child.id === 'pawn-redeem' && activeTab === 'pawn-redeem-new');
                    return (
                      <button
                        key={child.id}
                        id={`sidebar-nav-${child.id}`}
                        type="button"
                        onClick={() => handleSelectTab(child.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515]'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-white' : 'text-[#D4AF37]'
                            }`}
                          />
                          <span className="truncate">
                            {language === 'MM' ? child.labelMM : child.labelEN}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {child.badge != null && (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                isActive ? 'bg-black/30' : 'bg-rose-500'
                              }`}
                            >
                              {child.badge}
                            </span>
                          )}
                          {isActive && <ChevronRight className="w-3 h-3 text-white/80" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mainNavBottom.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-sm border border-[#FFD700]/30'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515] dark:hover:text-[#FFD700]'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-[#D4AF37]'
                    }`}
                  />
                  <span className="truncate">{language === 'MM' ? item.labelMM : item.labelEN}</span>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                  {item.badge !== null && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                        isActive ? 'bg-black/30' : item.badgeColor || 'bg-amber-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                </div>
              </button>
            );
          })}

          {showSetup && (
            <div className="pt-1">
              <button
                type="button"
                id="sidebar-nav-setup"
                onClick={() => setSetupOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  setupChildActive
                    ? 'bg-[#FAF8F2] dark:bg-[#222222] text-[#996515] dark:text-[#FFD700]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515] dark:hover:text-[#FFD700]'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Settings2 className="w-4 h-4 shrink-0 text-[#D4AF37]" />
                  <span className="truncate">
                    {language === 'MM' ? 'Setup စီမံချက်' : 'Setup'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                    setupOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {setupOpen && (
                <div className="mt-0.5 ml-3 pl-2 border-l border-line dark:border-gray-800 space-y-0.5">
                  {setupChildren.map((child) => {
                    const Icon = child.icon;
                    const isActive = activeTab === child.id;
                    return (
                      <button
                        key={child.id}
                        id={`sidebar-nav-${child.id}`}
                        type="button"
                        onClick={() => handleSelectTab(child.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-[#FAF8F2] dark:hover:bg-[#222222] hover:text-[#996515]'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-white' : 'text-[#D4AF37]'
                            }`}
                          />
                          <span className="truncate">
                            {language === 'MM' ? child.labelMM : child.labelEN}
                          </span>
                        </div>
                        {isActive && <ChevronRight className="w-3 h-3 text-white/80" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
};
