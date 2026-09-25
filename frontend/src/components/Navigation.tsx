import {
  LayoutDashboard,
  Gem,
  ReceiptText,
  Clock,
  HandCoins,
  BookOpenCheck,
  FileBarChart2,
  Settings2,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'pos-sale'
  | 'pos-purchase'
  | 'pos-exchange'
  | 'pos-history'
  | 'inventory'
  | 'old-gold'
  | 'goldsmith'
  | 'goldsmith-handoff'
  | 'order-handoff'
  | 'categories'
  | 'item-types'
  | 'orders'
  | 'pawn'
  | 'pawn-interest'
  | 'pawn-redeem'
  | 'pawn-overdue'
  | 'pawn-new'
  | 'pawn-interest-new'
  | 'pawn-redeem-new'
  | 'ledger'
  | 'customers'
  | 'financial-report'
  | 'users'
  | 'permissions'
  | 'unit-conversion';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

/** Legacy top nav — primary navigation is Sidebar. Kept for type export compatibility. */
export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const navItems: { id: ActiveTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS', icon: ReceiptText },
    { id: 'inventory', label: 'Inventory', icon: Gem },
    { id: 'orders', label: 'Orders', icon: Clock },
    { id: 'pawn', label: 'Pawn', icon: HandCoins },
    { id: 'ledger', label: 'Ledger', icon: BookOpenCheck },
    { id: 'financial-report', label: 'Financial', icon: FileBarChart2 },
    { id: 'categories', label: 'Setup', icon: Settings2 },
  ];

  return (
    <nav className="bg-panel dark:bg-[#1A1A1A] border-b border-line dark:border-gray-800">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
