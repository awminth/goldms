import React, { useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { api } from '../services/api';
import {
  formatMMK,
  meelinMmkToBaht,
  resolveBahtMmkRate,
  thaiBahtToMmk,
} from '../utils/goldCalculations';
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

const fmtBaht = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '—';

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar }) => {
  const {
    goldPrices,
    shopSettings,
    darkMode,
    toggleDarkMode,
    language,
    toggleLanguage,
    refreshData,
    currentUser,
    logout,
    can,
    updateShopSettings,
  } = useGoldShop();

  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [editedMeelin, setEditedMeelin] = useState('');
  const [editedThaiBaht, setEditedThaiBaht] = useState('');
  const [editedBahtMmk, setEditedBahtMmk] = useState('');
  const [saving, setSaving] = useState(false);

  const pure16 = goldPrices.find((p) => p.gold_type === 'MEELIN');
  const bahtMmkRate = resolveBahtMmkRate(shopSettings);
  const thaiBahtStored = shopSettings.thai_gold_baht || 65000;

  const startEditPrices = () => {
    setEditedMeelin(pure16 ? String(pure16.price_per_kyat) : '9000000');
    setEditedThaiBaht(String(Math.round(thaiBahtStored) || 65000));
    setEditedBahtMmk(String(Number(bahtMmkRate.toFixed(4))));
    setIsEditingPrices(true);
  };

  const saveQuickPrices = async () => {
    const meelin = Number(editedMeelin);
    const thaiBaht = Number(editedThaiBaht);
    const bahtMmk = Number(editedBahtMmk);
    if (![meelin, thaiBaht, bahtMmk].every((n) => Number.isFinite(n) && n > 0)) {
      return;
    }
    setSaving(true);
    try {
      await updateShopSettings({
        baht_mmk_rate: bahtMmk,
        thai_gold_baht: thaiBaht,
      });
      const thaiMmk = Math.round(thaiBahtToMmk(thaiBaht, bahtMmk));
      await api.updateGoldPricesBulk([
        {
          gold_type: 'MEELIN',
          sellPrice: meelin,
          buyPrice: meelin - 50000,
        },
        {
          gold_type: 'THAI_GOLD',
          sellPrice: thaiMmk,
          buyPrice: Math.max(0, thaiMmk - 60000),
        },
      ]);
      await refreshData();
      setIsEditingPrices(false);
    } finally {
      setSaving(false);
    }
  };

  const meelinBahtDisplay = pure16
    ? meelinMmkToBaht(pure16.price_per_kyat, bahtMmkRate)
    : 0;

  return (
    <header className="sticky top-0 z-30 bg-panel/95 dark:bg-[#161616]/95 backdrop-blur border-b border-line dark:border-[#D4AF37]/20 shadow-xs transition-colors">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
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

          <div className="hidden md:flex items-center space-x-2 lg:space-x-3 bg-[#FAF8F2]/80 dark:bg-[#1E1E1E] px-3 py-1.5 rounded-xl border border-[#D4AF37]/20 max-w-[min(100%,52rem)] overflow-x-auto">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#B8860B] dark:text-[#E5C158] shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'ပေါက်ဈေး' : 'Rates'}</span>
            </div>

            {isEditingPrices ? (
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                    မီးလင်း:
                  </span>
                  <input
                    type="number"
                    value={editedMeelin}
                    onChange={(e) => setEditedMeelin(e.target.value)}
                    className="w-24 px-2 py-1 text-xs border rounded bg-white dark:bg-[#121212] dark:text-white border-[#D4AF37] focus:outline-hidden font-mono"
                    title="MMK"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                    ထိုင်းရွှေ:
                  </span>
                  <input
                    type="number"
                    value={editedThaiBaht}
                    onChange={(e) => setEditedThaiBaht(e.target.value)}
                    className="w-20 px-2 py-1 text-xs border rounded bg-white dark:bg-[#121212] dark:text-white border-[#D4AF37] focus:outline-hidden font-mono"
                    title="Baht"
                  />
                  <span className="text-[10px] text-gray-400">฿</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                    {language === 'MM' ? '၁฿ =' : '1฿ ='}
                  </span>
                  <input
                    type="number"
                    step="0.0001"
                    value={editedBahtMmk}
                    onChange={(e) => setEditedBahtMmk(e.target.value)}
                    className="w-20 px-2 py-1 text-xs border rounded bg-white dark:bg-[#121212] dark:text-white border-[#D4AF37] focus:outline-hidden font-mono"
                    title="MMK per 1 Baht"
                  />
                  <span className="text-[10px] text-gray-400">MMK</span>
                </div>
                <button
                  onClick={saveQuickPrices}
                  disabled={saving}
                  className="p-1 rounded bg-[#D4AF37] text-white hover:bg-[#C5A059] transition disabled:opacity-50"
                  title="သိမ်းမည်"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingPrices(false)}
                  disabled={saving}
                  className="p-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition"
                  title="ပယ်ဖျက်"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 lg:space-x-3 text-xs font-medium">
                {pure16 && (
                  <div className="flex items-center space-x-1 whitespace-nowrap">
                    <span className="text-gray-500 dark:text-gray-400">မီးလင်း:</span>
                    <span className="font-bold text-gray-900 dark:text-amber-300">
                      {formatMMK(pure16.price_per_kyat)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      (~{fmtBaht(meelinBahtDisplay)} ฿)
                    </span>
                  </div>
                )}
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <div className="flex items-center space-x-1 whitespace-nowrap">
                  <span className="text-gray-500 dark:text-gray-400">ထိုင်းရွှေ:</span>
                  <span className="font-bold text-gray-900 dark:text-amber-300 font-mono">
                    {fmtBaht(thaiBahtStored)} ฿
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    (~
                    {formatMMK(Math.round(thaiBahtToMmk(thaiBahtStored, bahtMmkRate)))})
                  </span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <div className="flex items-center space-x-1 whitespace-nowrap">
                  <span className="text-gray-500 dark:text-gray-400">
                    {language === 'MM' ? '၁฿ =' : '1฿ ='}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-amber-300 font-mono">
                    {Number(bahtMmkRate.toFixed(2)).toLocaleString()}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">MMK</span>
                </div>
                {can('prices', 'update') && (
                  <button
                    onClick={startEditPrices}
                    className="ml-1 p-1 text-gray-400 hover:text-[#D4AF37] dark:hover:text-[#FFD700] transition shrink-0"
                    title="ရွှေဈေး / ဘတ်ဈေး ပြင်ဆင်ရန်"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 text-xs">
                <div
                  className={`w-6 h-6 rounded-md bg-gradient-to-br ${currentUser.avatarColor || 'from-amber-500 to-yellow-600'} text-white font-bold flex items-center justify-center text-[10px]`}
                >
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

            <button
              id="lang-toggle-btn"
              onClick={toggleLanguage}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Change Language (မြန်မာ / English)"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'မြန်မာ' : 'EN'}</span>
            </button>

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
