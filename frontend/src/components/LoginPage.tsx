import React, { useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Crown,
  Sun,
  Moon,
  Globe,
  Coins,
} from 'lucide-react';
import {
  SOFTWARE_LOGO,
  softwareName,
  softwareSystemName,
  softwareTagline,
} from '../branding';

export const LoginPage: React.FC = () => {
  const { login, language, toggleLanguage, darkMode, toggleDarkMode } = useGoldShop();

  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const res = await login(username, pin);
    if (!res.success) {
      setErrorMessage(res.message || (language === 'MM' ? 'အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ' : 'Login failed'));
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col text-gray-900 dark:text-gray-100 transition-colors">
      {/* Full-bleed split: brand | form */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        {/* Left: Brand panel (full height) */}
        <div className="relative bg-gradient-to-br from-[#1C160C] via-[#2A2012] to-[#120E08] text-white flex flex-col overflow-hidden min-h-[40vh] lg:min-h-screen">
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-16 w-80 h-80 rounded-full bg-[#FFD700]/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-10 lg:py-12 max-w-xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FFD700] text-xs font-semibold mb-6 w-fit">
              <Crown className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>{softwareSystemName(language)}</span>
            </div>

            <div className="mb-4 flex justify-start">
              <img
                src={SOFTWARE_LOGO}
                alt={softwareName(language)}
                className="h-20 sm:h-24 w-auto object-contain drop-shadow-lg"
              />
            </div>

            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-white mb-3 font-['Cinzel',serif]">
              {softwareName(language)}
            </h1>
            <p className="text-amber-200/90 text-sm sm:text-base font-medium tracking-wide mb-5">
              {softwareTagline(language)}
            </p>
            <p className="text-sm text-gray-300 leading-relaxed mb-10">
              {language === 'MM'
                ? 'မြန်မာ့ရိုးရာ အခေါက်ရွှေ (၁၆ပဲရည်၊ ၁၅ပဲရည်) နှင့် ထိုင်းရွှေ ဈေးနှုန်းတွက်ချက်မှု၊ အရောင်းဘောက်ချာ၊ အထည်စတော့၊ အော်ဒါနှင့် အပေါင်လုပ်ငန်း စီမံခန့်ခွဲမှုစနစ်'
                : 'Complete POS, Kyat-Pae-Yway weight computation, Thai gold exchange, custom orders, pawn records & financial accounting.'}
            </p>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-sm text-amber-100/80">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-[#FFD700]" />
                </div>
                <span>{language === 'MM' ? 'တိုက်ရိုက်ရွှေပေါက်ဈေး ချိတ်ဆက်မှု' : 'Real-time Daily Market Gold Rates'}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-amber-100/80">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#FFD700]" />
                </div>
                <span>{language === 'MM' ? 'က-ပဲ-ရွေး တိကျသော အလေးချိန်တွက်စနစ်' : 'Exact Kyat-Pae-Yway Precision'}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-amber-100/80">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#FFD700]" />
                </div>
                <span>{language === 'MM' ? 'လုံခြုံသော စာရင်းအင်းနှင့် ဘောက်ချာစနစ်' : 'Printable Official Gold Invoices'}</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 px-6 sm:px-10 lg:px-12 pb-8 pt-4 border-t border-amber-900/40 text-xs text-amber-200/60 flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>POS Terminal Ready • Database Active</span>
          </div>
        </div>

        {/* Right: Login form (full height) */}
        <div className="relative flex flex-col bg-page dark:bg-[#1A1A1A] min-h-[60vh] lg:min-h-screen">
          <div className="flex items-center justify-end gap-2 px-6 sm:px-10 lg:px-12 pt-6 sm:pt-8">
            <button
              id="login-lang-btn"
              type="button"
              onClick={toggleLanguage}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{language === 'MM' ? 'မြန်မာ' : 'English'}</span>
            </button>
            <button
              id="login-theme-btn"
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#FFD700]" /> : <Moon className="w-4 h-4 text-gray-700" />}
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-20 py-10 w-full max-w-lg mx-auto lg:mx-0 lg:max-w-none lg:w-full">
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-0 xl:ml-8">
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {language === 'MM' ? 'စနစ်သို့ ဝင်ရောက်ပါ' : 'Sign in to Terminal'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {language === 'MM'
                    ? 'ဝန်ထမ်းအကောင့်အချက်အလက်ကို ထည့်သွင်းပါ'
                    : 'Enter your staff credentials to continue'}
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {language === 'MM' ? 'အသုံးပြုသူအမည် (Username)' : 'Username / Staff ID'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <input
                      id="login-username-input"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin, manager, or cashier"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-hidden transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {language === 'MM' ? 'လျှို့ဝှက်ကုဒ် / PIN Code' : 'Password / PIN Code'}
                    </label>
                    <span className="text-[11px] text-[#B8860B] dark:text-amber-400 font-medium">
                      Default: 1234
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <input
                      id="login-pin-input"
                      type={showPin ? 'text' : 'password'}
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••"
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212] text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-hidden tracking-wider transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] border-gray-300"
                    />
                    <span>{language === 'MM' ? 'အကောင့်မှတ်ထားမည်' : 'Remember session'}</span>
                  </label>
                  <span className="text-[11px] text-gray-400">POS Secured</span>
                </div>

                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#996515] hover:brightness-105 active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-[#D4AF37]/30 flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{language === 'MM' ? 'စနစ်ထဲသို့ ဝင်မည်' : 'Sign In to Dashboard'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 pt-4 text-center text-[11px] text-gray-400 dark:text-gray-500 flex items-center justify-center space-x-2">
                <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {language === 'MM'
                    ? `${softwareSystemName('MM')} • သီးသန့်လုံခြုံစိတ်ချရသော ဆာဗာ`
                    : `${softwareSystemName('EN')} • Role-Based Access Control`}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-10 lg:px-12 pb-6 text-center text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} {softwareName(language)} · {softwareTagline(language)}
          </div>
        </div>
      </div>
    </div>
  );
};
