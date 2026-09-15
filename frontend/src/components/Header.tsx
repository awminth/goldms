import React, { useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { api } from '../services/api';
import { formatMMK } from '../utils/goldCalculations';
import {
  Sun,
  Moon,
  TrendingUp,
  Edit3,
  Check,
  X,
  Globe,
  Menu,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar }) => {
  const {
    goldPrices,
    darkMode,
    toggleDarkMode,
    language,
    toggleLanguage,
    refreshData,
    currentUser,
    logout,
  } = useGoldShop();

  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [edited16Price, setEdited16Price] = useState('');
  const [editedThaiPrice, setEditedThaiPrice] = useState('');

  const pure16 = goldPrices.find((p) => p.gold_type === 'MEELIN');
  const thaiGold = goldPrices.find((p) => p.gold_type === 'THAI_GOLD');
  const pe15 = goldPrices.find((p) => p.gold_type === 'PE15A');

  const startEditPrices = () => {
    setEdited16Price(pure16 ? String(pure16.price_per_kyat) : '5750000');
    setEditedThaiPrice(thaiGold ? String(thaiGold.price_per_kyat) : '5520000');
    setIsEditingPrices(true);
  };

  const saveQuickPrices = async () => {
    const updates: Array<{
      gold_type: 'MEELIN' | 'THAI_GOLD';
      sellPrice: number;
      buyPrice?: number;
    }> = [];
    if (edited16Price && !isNaN(Number(edited16Price))) {
      const sellMeelin = Number(edited16Price);
      // Backend cascades K24 + grade prices from မီးလင်း (same formulas)
      updates.push({
        gold_type: 'MEELIN',
        sellPrice: sellMeelin,
        buyPrice: sellMeelin - 50000,
      });
    }
    if (editedThaiPrice && !isNaN(Number(editedThaiPrice))) {
      const sellThai = Number(editedThaiPrice);
      updates.push({ gold_type: 'THAI_GOLD', sellPrice: sellThai, buyPrice: sellThai - 60000 });
    }
    if (updates.length) {
      await api.updateGoldPricesBulk(updates);
      await refreshData();
    }
    setIsEditingPrices(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-panel/95 dark:bg-[#161616]/95 backdrop-blur border-b border-line dark:border-[#D4AF37]/20 shadow-xs transition-colors">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Left: Mobile hamburger only */}
          <div className="flex items-center space-x-3">
            <button
              id="sidebar-mobile-toggle-btn"
              type="button"
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition border border-gray-200 dark:border-gray-700"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-[#D4AF37]" />
            </button>
          </div>

          {/* Center: Live Gold Price Ticker */}
          <div className="hidden md:flex items-center space-x-3 bg-[#FAF8F2]/80 dark:bg-[#1E1E1E] px-3 py-1.5 rounded-xl border border-[#D4AF37]/20">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#B8860B] dark:text-[#E5C158]">
              <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'ပေါက်ဈေး' : 'Rates'}</span>
            </div>

            {isEditingPrices ? (
              <div className="flex items-center space-x-2 text-xs">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">၁၆ ပဲ:</span>
                  <input
                    type="number"
                    value={edited16Price}
                    onChange={(e) => setEdited16Price(e.target.value)}
                    className="w-24 px-2 py-1 text-xs border rounded bg-white dark:bg-[#121212] dark:text-white border-[#D4AF37] focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">ထိုင်းရွှေ:</span>
                  <input
                    type="number"
                    value={editedThaiPrice}
                    onChange={(e) => setEditedThaiPrice(e.target.value)}
                    className="w-24 px-2 py-1 text-xs border rounded bg-white dark:bg-[#121212] dark:text-white border-[#D4AF37] focus:outline-hidden"
                  />
                </div>
                <button
                  onClick={saveQuickPrices}
                  className="p-1 rounded bg-[#D4AF37] text-white hover:bg-[#C5A059] transition"
                  title="သိမ်းမည်"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingPrices(false)}
                  className="p-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition"
                  title="ပယ်ဖျက်"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 text-xs font-medium">
                {pure16 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 dark:text-gray-400">မီးလင်း:</span>
                    <span className="font-bold text-gray-900 dark:text-amber-300">
                      {formatMMK(pure16.price_per_kyat)}
                    </span>
                  </div>
                )}
                <span className="text-gray-300 dark:text-gray-700">|</span>
                {pe15 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 dark:text-gray-400">15A:</span>
                    <span className="font-bold text-gray-900 dark:text-amber-300">
                      {formatMMK(pe15.price_per_kyat)}
                    </span>
                  </div>
                )}
                <span className="text-gray-300 dark:text-gray-700">|</span>
                {thaiGold && (
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500 dark:text-gray-400">ထိုင်းရွှေ:</span>
                    <span className="font-bold text-gray-900 dark:text-amber-300">
                      {formatMMK(thaiGold.price_per_kyat)}
                    </span>
                  </div>
                )}
                <button
                  onClick={startEditPrices}
                  className="ml-1 p-1 text-gray-400 hover:text-[#D4AF37] dark:hover:text-[#FFD700] transition"
                  title="ရွှေဈေး ပြင်ဆင်ရန်"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Controls: Staff user card + Language + Dark Mode + Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Staff Pill (desktop) */}
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 text-xs">
                <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${currentUser.avatarColor || 'from-amber-500 to-yellow-600'} text-white font-bold flex items-center justify-center text-[10px]`}>
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block text-[11px] leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] text-[#B8860B] dark:text-amber-400 font-bold block leading-tight">
                    {currentUser.role}
                  </span>
                </div>
              </div>
            )}

            {/* Language Switcher */}
            <button
              id="lang-toggle-btn"
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Change Language (မြန်မာ / English)"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'မြန်မာ' : 'EN'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#FFD700]" />
              ) : (
                <Moon className="w-4 h-4 text-gray-700" />
              )}
            </button>

            {/* Logout Button */}
            <button
              id="header-logout-btn"
              onClick={logout}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
              title="Logout / Switch User"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'MM' ? 'ထွက်မည်' : 'Logout'}</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
