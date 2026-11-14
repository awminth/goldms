import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scanner, useDevices, type IDetectedBarcode, type IScannerError, type IScannerHandle } from '@yudiel/react-qr-scanner';
import { useGoldShop } from '../context/GoldShopContext';
import { api } from '../services/api';
import { InventoryItem, GoldPurity } from '../types/gold';
import {
  estimateSellingPrice,
  formatMMK,
  formatBaht,
  formatKPYMyanmar,
  formatKPYEnglish,
  kpyToGrams,
  normalizeBarcode,
  PURITY_LABELS,
  KYAT_TO_GRAMS,
} from '../utils/goldCalculations';
import { InventoryBarcodeTag, getBarcodeTagPageStyle } from './InventoryBarcodeTag';
import { useReactToPrint } from 'react-to-print';
import {
  ScanBarcode,
  Scan,
  X,
  Camera,
  CameraOff,
  SwitchCamera,
  Flashlight,
  FlashlightOff,
  Search,
  ShoppingCart,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Scale,
  Gem,
  Tag,
  Coins,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface BarcodeScannerModalProps {
  onNavigate?: (tab: any) => void;
}

/** Plays a crisp synthetic supermarket-style barcode beep */
function playBeep() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // Ignore audio permission errors
  }
}

/** Trigger vibration feedback on mobile */
function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([40, 60, 40]);
    } catch {
      // Ignore vibration error
    }
  }
}

function cleanScannedCode(raw: string): string {
  return normalizeBarcode(raw)
    .replace(/\s+/g, '')
    .replace(/^\][A-Za-z][0-9]/, '')
    .trim();
}

function findInventoryItem(list: InventoryItem[], raw: string): InventoryItem | undefined {
  const key = cleanScannedCode(raw).toLowerCase();
  if (!key) return undefined;
  const digits = key.replace(/\D/g, '');
  return list.find((item) => {
    const itemKey = cleanScannedCode(item.barcode).toLowerCase();
    if (itemKey === key) return true;
    const itemDigits = itemKey.replace(/\D/g, '');
    return digits.length >= 4 && itemDigits === digits;
  });
}

function scannerErrorText(error: IScannerError): string {
  switch (error.kind) {
    case 'permission-denied':
      return 'ကင်မရာ အသုံးပြုခွင့် (Permission) ပိတ်ထားပါသည်။ ခွင့်ပြုပေးပါ သို့မဟုတ် လက်ရိုက်စနစ်ဖြင့် အသုံးပြုပါ။';
    case 'no-camera':
      return 'ကင်မရာ ရှာမတွေ့ပါ။ လက်ရိုက်စနစ်ဖြင့် ရှာဖွေနိုင်ပါသည်။';
    case 'in-use':
      return 'ကင်မရာကို အခြား app က အသုံးပြုနေပါသည်။ အဲ့ဒီ app ကို ပိတ်ပြီး Refresh လုပ်ပါ။';
    case 'insecure-context':
      return 'ကင်မရာကို HTTPS မှာသာ ဖွင့်လို့ရပါသည်။';
    default:
      return 'ကင်မရာ ဖွင့်မရပါ။ လက်ရိုက်စနစ်ဖြင့် အသုံးပြုနိုင်ပါသည်။';
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ onNavigate }) => {
  const { inventory, goldPrices, shopSettings, language, refreshData } = useGoldShop();

  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'camera' | 'manual'>('camera');
  const [manualQuery, setManualQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Scanned item modal
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const [showTagPreview, setShowTagPreview] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Scanner state
  const [cameraNonce, setCameraNonce] = useState(0);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Zoom control state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);

  // Recent scans list (session-only)
  const [recentScans, setRecentScans] = useState<Array<{ barcode: string; name: string; time: string }>>([]);

  const videoDevices = useDevices();
  const scannerRef = useRef<IScannerHandle>(null);
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;
  const pausedRef = useRef(false);
  const foundLockRef = useRef(false);
  const recentRejectRef = useRef<{ text: string; at: number } | null>(null);
  const handleBarcodeFoundRef = useRef<(code: string) => Promise<void>>(async () => {});
  const tagPrintRef = useRef<HTMLDivElement | null>(null);

  const handlePrintTag = useReactToPrint({
    contentRef: tagPrintRef,
    documentTitle: `Tag-${scannedItem?.barcode || 'label'}`,
    pageStyle: getBarcodeTagPageStyle(1.5, 0, false),
    ignoreGlobalStyles: true,
  });

  // Calculate live market selling price for item
  const getCalculatedPrice = useCallback(
    (item: InventoryItem): number => {
      const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
      if (isThai && item.selling_price_estimated) {
        return item.selling_price_estimated;
      }

      const craftTotal =
        Number(item.craftsmanship_fee || 0) + Number(item.craftsmanship_profit_fee || 0);
      const stoneTotal =
        Number(item.stone_price || 0) + Number(item.stone_profit_price || 0);
      const pure16 =
        goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
      const specificPrice =
        goldPrices.find((p) => p.gold_type === item.purity)?.price_per_kyat || 0;

      return estimateSellingPrice({
        purity: item.purity,
        itemType: item.item_type,
        netWeight: {
          kyat: Number(item.net_weight_kyat || 0),
          pae: Number(item.net_weight_pae || 0),
          yway: Number(item.net_weight_yway || 0),
        },
        thaiWeightUnit: item.thai_weight_unit || null,
        craftsmanshipFee: craftTotal,
        stonePrice: stoneTotal,
        pricePerKyat16Pe: pure16,
        specificSellPrice: specificPrice,
      });
    },
    [goldPrices]
  );

  const handleBarcodeFound = async (rawCode: string) => {
    const cleanCode = cleanScannedCode(rawCode);
    if (!cleanCode) return;

    playBeep();
    triggerHaptic();

    let found = findInventoryItem(inventoryRef.current, cleanCode);
    if (!found && cleanCode.length >= 4) {
      try {
        const data = await api.bootstrap();
        found = findInventoryItem(data.inventory || [], cleanCode);
        if (found) void refreshData();
      } catch {
        // Keep the in-memory result when the network lookup fails.
      }
    }

    if (found) {
      foundLockRef.current = true;
      pausedRef.current = true;
      recentRejectRef.current = null;
      setSearchError(null);
      setScannedItem(found);
      setShowTagPreview(false);
      setRecentScans((prev) => {
        const filtered = prev.filter((r) => r.barcode !== found!.barcode);
        return [
          {
            barcode: found!.barcode,
            name: found!.name_mm || found!.name,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          },
          ...filtered.slice(0, 4),
        ];
      });
      return;
    }

    recentRejectRef.current = { text: cleanCode, at: Date.now() };
    setSearchError(`ဘားကုဒ် "${cleanCode}" ဖြင့် စာရင်းထဲတွင် ပစ္စည်းရှာမတွေ့ပါ`);
  };
  handleBarcodeFoundRef.current = handleBarcodeFound;

  const cameraTrack = () => scannerRef.current?.getStream()?.getVideoTracks()[0] ?? null;

  const handleSetZoom = async (val: number) => {
    const track = cameraTrack();
    if (!track || !zoomRange) return;
    try {
      const clamped = Math.min(Math.max(zoomRange.min, val), zoomRange.max);
      await track.applyConstraints({
        advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
      });
      setZoomLevel(clamped);
    } catch (err) {
      console.warn('Failed to set zoom:', err);
    }
  };

  const switchCamera = () => {
    if (videoDevices.length <= 1) return;
    const current = videoDevices.findIndex((device) => device.deviceId === deviceId);
    const next = videoDevices[(current < 0 ? 0 : current + 1) % videoDevices.length];
    setDeviceId(next?.deviceId);
    setTorchOn(false);
    setZoomLevel(2);
  };

  const toggleTorch = async () => {
    const track = cameraTrack();
    if (!track || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const showCamera = isOpen && activeMode === 'camera' && !scannedItem && !cameraError;

  useEffect(() => {
    if (!isOpen) {
      foundLockRef.current = false;
      pausedRef.current = false;
      setScannedItem(null);
      setSearchError(null);
      setCameraError(null);
      setTorchOn(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showCamera) return;
    let cancelled = false;
    const tune = async () => {
      const track = cameraTrack();
      if (!track || cancelled) return false;
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
        zoom?: { min?: number; max?: number; step?: number };
      };
      setHasTorch(Boolean(caps.torch));
      if (caps.zoom && typeof caps.zoom.max === 'number') {
        const range = {
          min: typeof caps.zoom.min === 'number' ? caps.zoom.min : 1,
          max: caps.zoom.max,
          step: typeof caps.zoom.step === 'number' && caps.zoom.step > 0 ? caps.zoom.step : 0.1,
        };
        const target = Math.min(range.max, Math.max(range.min, 2));
        const steps = Math.round((target - range.min) / range.step);
        const zoom = Math.min(range.max, Math.max(range.min, range.min + steps * range.step));
        try {
          await track.applyConstraints({
            advanced: [{ zoom } as MediaTrackConstraintSet],
          });
          if (!cancelled) setZoomLevel(zoom);
        } catch {
          if (!cancelled) setZoomLevel(range.min);
        }
        if (!cancelled) setZoomRange(range);
      } else if (!cancelled) {
        setZoomRange(null);
        setZoomLevel(1);
      }
      return true;
    };
    const timer = window.setInterval(() => {
      void tune().then((ready) => {
        if (ready) window.clearInterval(timer);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [showCamera, cameraNonce, deviceId]);

  const handleLibraryScan = (codes: IDetectedBarcode[]) => {
    const raw = codes[0]?.rawValue;
    if (!raw || pausedRef.current || foundLockRef.current) return;
    const clean = cleanScannedCode(raw);
    if (clean.length < 4) return;
    const rejected = recentRejectRef.current;
    if (rejected && rejected.text === clean && Date.now() - rejected.at < 1200) return;
    pausedRef.current = true;
    void handleBarcodeFoundRef.current(clean).finally(() => {
      if (!foundLockRef.current) {
        window.setTimeout(() => {
          pausedRef.current = false;
        }, 200);
      }
    });
  };

  // Handle manual search submit
  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualQuery.trim()) return;
    recentRejectRef.current = null;
    void handleBarcodeFound(manualQuery.trim());
  };

  // Send item to POS Cart
  const handleSendToPOS = () => {
    if (!scannedItem) return;
    try {
      sessionStorage.setItem('goldms_pos_pending_barcode', scannedItem.barcode);
      sessionStorage.setItem('goldms_active_tab', 'pos');
    } catch {
      // ignore
    }
    setIsOpen(false);
    setScannedItem(null);
    if (onNavigate) {
      onNavigate('pos');
    }
  };

  // Resume camera for next item. Opening the camera view starts the session.
  const handleScanNext = () => {
    foundLockRef.current = false;
    pausedRef.current = false;
    recentRejectRef.current = null;
    setScannedItem(null);
    setShowTagPreview(false);
    setSearchError(null);
    setManualQuery('');
    setCameraError(null);
    setActiveMode('camera');
  };

  // Copy barcode helper
  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const renderKPY = (kyat: number = 0, pae: number = 0, yway: number = 0) => {
    const kpy = { kyat: Number(kyat || 0), pae: Number(pae || 0), yway: Number(yway || 0) };
    return language === 'MM' ? formatKPYMyanmar(kpy) : formatKPYEnglish(kpy);
  };

  return (
    <>
      {/* 🌟 Floating Action Button (FAB) - Circular action button */}
      <aside aria-label="Quick Barcode Scanner" className="fixed bottom-20 right-4 sm:bottom-7 sm:right-7 z-40 print:hidden pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            foundLockRef.current = false;
            pausedRef.current = false;
            recentRejectRef.current = null;
            setCameraError(null);
            setIsOpen(true);
            setScannedItem(null);
            setShowTagPreview(false);
            setActiveMode('camera');
          }}
          className="relative group flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-[#D4AF37] text-white shadow-[0_6px_20px_rgba(212,175,55,0.45)] hover:shadow-[0_8px_26px_rgba(212,175,55,0.65)] hover:scale-110 active:scale-95 transition-all duration-300 border border-amber-300/50 focus:outline-hidden focus:ring-4 focus:ring-amber-400/40"
          title="ဖုန်းဖြင့် Barcode Scan ဖတ်ရန် / ပစ္စည်းအသေးစိတ်ရှာရန်"
        >
          {/* Animated Glow Wave */}
          <span className="absolute -inset-1 rounded-full bg-amber-400/30 blur-xs group-hover:bg-amber-400/50 transition-all duration-300 animate-pulse pointer-events-none" />

          {/* Centered Barcode Scan Icon */}
          <ScanBarcode className="relative w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] drop-shadow-xs" />
        </button>
      </aside>

      {/* 📱 Fullscreen / Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in print:hidden">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-white dark:bg-[#18181B] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-amber-500/20">

            {/* Modal Top Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <ScanBarcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>{language === 'MM' ? 'Barcode Scanner' : 'Barcode Scanner'}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Smart AI Detector
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {scannedItem
                      ? (language === 'MM' ? 'ပစ္စည်းအသေးစိတ် အချက်အလက်များ' : 'Scanned Item Details')
                      : (language === 'MM' ? 'ဖုန်းကင်မရာဖြင့် အလွယ်တကူ Scan ဖတ်ပါ' : 'Scan barcode using camera or manual input')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="ပိတ်မည်"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If NO item is currently scanned -> SHOW SCANNER INTERFACE */}
            {!scannedItem && (
              <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Mode Switcher Tabs */}
                <div className="flex p-2 bg-gray-100 dark:bg-gray-900/60 m-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode('camera');
                      setSearchError(null);
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      activeMode === 'camera'
                        ? 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>{language === 'MM' ? 'ကင်မရာ စကင်နာ' : 'Camera Scanner'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode('manual');
                      setSearchError(null);
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      activeMode === 'manual'
                        ? 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span>{language === 'MM' ? 'လက်ရိုက် ရှာရန်' : 'Manual Search'}</span>
                  </button>
                </div>

                {/* Error Banner */}
                {searchError && (
                  <div className="mx-4 mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-shake">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}

                {/* CAMERA MODE */}
                {activeMode === 'camera' && (
                  <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
                    {cameraError ? (
                      <div className="text-center p-6 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 max-w-sm">
                        <CameraOff className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                          {cameraError}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCameraError(null);
                              setCameraNonce((n) => n + 1);
                            }}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs"
                          >
                            ပြန်ကြိုးစားမည်
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveMode('manual')}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-amber-300 text-amber-800 dark:text-amber-200 text-xs font-bold rounded-xl"
                          >
                            လက်ရိုက်စနစ်သို့ သွားမည်
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center">
                        {/* Live Camera Viewport Box */}
                        <div className="relative w-full max-w-md aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-inner border-2 border-amber-500/40">
                          <Scanner
                            key={`${cameraNonce}-${deviceId ?? 'environment'}`}
                            ref={scannerRef}
                            onScan={handleLibraryScan}
                            onError={(error) => {
                              if (error.kind === 'unknown' || error.kind === 'aborted') return;
                              setCameraError(scannerErrorText(error));
                            }}
                            formats={['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code']}
                            sound={false}
                            allowMultiple
                            scanDelay={200}
                            retryDelay={40}
                            constraints={
                              deviceId
                                ? {
                                    deviceId: { exact: deviceId },
                                    width: { ideal: 1920 },
                                    height: { ideal: 1080 },
                                  }
                                : {
                                    facingMode: { ideal: 'environment' },
                                    width: { ideal: 1920 },
                                    height: { ideal: 1080 },
                                  }
                            }
                            components={{ finder: false, torch: false, zoom: false, onOff: false }}
                            styles={{
                              container: { width: '100%', height: '100%', position: 'relative' },
                              video: { width: '100%', height: '100%', objectFit: 'cover' },
                            }}
                            classNames={{ container: 'h-full w-full', video: 'h-full w-full object-cover' }}
                          >
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                              <div className="relative w-[90%] h-[42%] border-2 border-amber-400/80 rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.4)] flex items-center justify-center">
                                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-scanner-laser" />
                                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-300" />
                                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-300" />
                                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-300" />
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-300" />
                              </div>
                              <span className="mt-2 text-[11px] font-medium text-white/95 bg-black/70 px-3 py-0.5 rounded-full backdrop-blur-xs">
                                {language === 'MM' ? 'ဘားကုဒ်ကို အနီရောင်မျဉ်းပေါ်တင်ပြီး ခဏငြိမ်အောင် ကိုင်ထားပါ' : 'Hold the barcode steady on the red line'}
                              </span>
                            </div>
                          </Scanner>
                        </div>

                        {/* 💡 Scanner Controls: Zoom, Flashlight, Camera Switch */}
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 w-full max-w-md">
                          {/* Zoom Presets (Crucial for tiny jewelry stickers!) */}
                          {zoomRange && (
                            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1.5 flex items-center gap-0.5">
                                <ZoomIn className="w-3 h-3 text-amber-500" />
                                <span>Zoom:</span>
                              </span>
                              {[1, 1.5, 2, 2.5].map((z) => {
                                if (z < zoomRange.min || z > zoomRange.max) return null;
                                const isCurrent = Math.abs(zoomLevel - z) < 0.15;
                                return (
                                  <button
                                    key={z}
                                    type="button"
                                    onClick={() => void handleSetZoom(z)}
                                    className={`px-2 py-1 rounded-lg text-xs font-bold font-mono transition-all ${
                                      isCurrent
                                        ? 'bg-amber-500 text-white shadow-xs scale-105'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    {z}x
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Flashlight Button */}
                          {hasTorch && (
                            <button
                              type="button"
                              onClick={() => void toggleTorch()}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                torchOn
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                              }`}
                              title="မီးဖွင့်/ပိတ်မည်"
                            >
                              {torchOn ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5" />}
                              <span>{torchOn ? 'မီးပိတ်' : 'မီးဖွင့်'}</span>
                            </button>
                          )}

                          {/* Switch Camera */}
                          {videoDevices.length > 1 && (
                            <button
                              type="button"
                              onClick={() => void switchCamera()}
                              className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              title="ကင်မရာ ရှေ့/နောက် ပြောင်းမည်"
                            >
                              <SwitchCamera className="w-3.5 h-3.5" />
                              <span>{language === 'MM' ? 'ကင်မရာ ပြောင်း' : 'Camera'}</span>
                            </button>
                          )}

                          {/* Restart */}
                          <button
                            type="button"
                            onClick={() => setCameraNonce((n) => n + 1)}
                            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            title="ကင်မရာ ပြန်စမည်"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{language === 'MM' ? 'Refresh' : 'Restart'}</span>
                          </button>
                        </div>

                        {/* Scanning Tip Banner */}
                        <p className="mt-2 text-[11px] text-amber-800/90 dark:text-amber-300/90 text-center max-w-sm px-2">
                          💡 ဘားကုဒ်ကို အနီရောင်မျဉ်းပေါ် တည့်တည့်တင်ပြီး ဖုန်းကို မလှုပ်အောင် ခဏကိုင်ထားပါ။ မဖတ်နိုင်ရင် ပိုနီးကပ်ပါ၊ Zoom တိုးပါ၊ သို့မဟုတ် မီးဖွင့်ပါ။
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* MANUAL SEARCH MODE */}
                {activeMode === 'manual' && (
                  <div className="flex-1 px-5 pb-5">
                    <form onSubmit={handleManualSearch} className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {language === 'MM'
                          ? 'Barcode နံပါတ် ရိုက်ထည့်၍ ရှာပါ (e.g. 946199):'
                          : 'Enter Barcode Number:'}
                      </label>
                      <div className="relative flex items-center">
                        <ScanBarcode className="absolute left-3.5 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          autoFocus
                          value={manualQuery}
                          onChange={(e) => setManualQuery(e.target.value)}
                          placeholder="Barcode နံပါတ် ရိုက်ထည့်ပြီး Enter ခေါက်ပါ…"
                          className="w-full pl-11 pr-24 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                        <button
                          type="submit"
                          className="absolute right-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                        >
                          ရှာမည်
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        💡 စာရင်းသွင်းထားသော Barcode ဖြစ်ပါက ချက်ချင်း ပစ္စည်းအသေးစိတ် ပေါ်လာပါမည်။
                      </p>
                    </form>

                    {/* Recent Scans (Quick history) */}
                    {recentScans.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2.5">
                          {language === 'MM' ? 'လတ်တလော Scan ဖတ်ထားသော ပစ္စည်းများ:' : 'Recently Scanned:'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {recentScans.map((r, i) => (
                            <button
                              key={`${r.barcode}-${i}`}
                              type="button"
                              onClick={() => void handleBarcodeFound(r.barcode)}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-400 border border-transparent text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors"
                            >
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                {r.barcode}
                              </span>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{r.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 💎 ITEM DETAILS MODAL (When an item is scanned/found!) */}
            {scannedItem && (
              <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 space-y-4">

                {/* Scanned Badge Notification */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold">
                      {language === 'MM' ? 'ပစ္စည်း ရှာဖွေတွေ့ရှိပါသည်' : 'Item successfully scanned'}
                    </span>
                  </div>
                  <span className="font-mono bg-emerald-100 dark:bg-emerald-900/80 px-2 py-0.5 rounded-md font-bold">
                    #{scannedItem.barcode}
                  </span>
                </div>

                {/* Item Main Info Card */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                        {scannedItem.name_mm || scannedItem.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {/* Barcode pill with copy */}
                        <button
                          type="button"
                          onClick={() => handleCopyCode(scannedItem.barcode)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs font-mono font-bold text-gray-700 dark:text-gray-300 hover:border-amber-400"
                          title="Barcode ကူးယူမည်"
                        >
                          <span>{scannedItem.barcode}</span>
                          {copiedCode ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>

                        {/* Category */}
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                          {scannedItem.category}
                        </span>

                        {/* Purity */}
                        <span className="px-2 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 text-xs font-bold">
                          {PURITY_LABELS[scannedItem.purity]?.mm || scannedItem.purity}
                        </span>

                        {/* Status */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            scannedItem.status === 'IN_STOCK'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {scannedItem.status === 'IN_STOCK' ? 'လက်ကျန်ရှိ (In Stock)' : scannedItem.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 💰 Highlighted Price Display */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-yellow-500/15 border border-amber-300/40 dark:border-amber-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                        {language === 'MM' ? 'ယနေ့ခန့်မှန်းရောင်းဈေး (Selling Price)' : 'Estimated Selling Price'}
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                          {formatMMK(getCalculatedPrice(scannedItem))}
                        </span>
                      </div>
                    </div>

                    {scannedItem.craftsmanship_fee_baht ? (
                      <div className="text-right sm:border-l sm:border-amber-200 dark:sm:border-amber-800 sm:pl-4">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                          Thai Baht (฿)
                        </span>
                        <span className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">
                          {formatBaht(scannedItem.selling_price_baht || 0)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* ⚖️ Specifications Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Weight Details */}
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200 pb-1 border-b border-gray-200 dark:border-gray-800">
                      <Scale className="w-3.5 h-3.5 text-amber-500" />
                      <span>{language === 'MM' ? 'အလေးချိန် အချက်အလက်' : 'Weight Details'}</span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                        <span>စုစုပေါင်းအလေးချိန် (Gross):</span>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                          {renderKPY(
                            scannedItem.weight_kyat,
                            scannedItem.weight_pae,
                            scannedItem.weight_yway
                          )}{' '}
                          ({kpyToGrams(
                            {
                              kyat: scannedItem.weight_kyat,
                              pae: scannedItem.weight_pae,
                              yway: scannedItem.weight_yway,
                            },
                            KYAT_TO_GRAMS
                          ).toFixed(3)}{' '}
                          g)
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                        <span>ရွှေသားအလေးချိန် (Net):</span>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                          {renderKPY(
                            scannedItem.net_weight_kyat,
                            scannedItem.net_weight_pae,
                            scannedItem.net_weight_yway
                          )}{' '}
                          ({kpyToGrams(
                            {
                              kyat: scannedItem.net_weight_kyat,
                              pae: scannedItem.net_weight_pae,
                              yway: scannedItem.net_weight_yway,
                            },
                            KYAT_TO_GRAMS
                          ).toFixed(3)}{' '}
                          g)
                        </span>
                      </div>

                      {(Number(scannedItem.gemstone_weight_kyat || 0) > 0 ||
                        Number(scannedItem.gemstone_weight_pae || 0) > 0 ||
                        Number(scannedItem.gemstone_weight_yway || 0) > 0) && (
                        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                          <span>ကျောက်ချိန် (Gem Weight):</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                            {renderKPY(
                              scannedItem.gemstone_weight_kyat || 0,
                              scannedItem.gemstone_weight_pae || 0,
                              scannedItem.gemstone_weight_yway || 0
                            )}
                          </span>
                        </div>
                      )}

                      {scannedItem.thai_weight_unit ? (
                        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                          <span>ထိုင်းဂရမ် (Thai Grams):</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {scannedItem.thai_weight_unit} g
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Wastage & Fees */}
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200 pb-1 border-b border-gray-200 dark:border-gray-800">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span>{language === 'MM' ? 'အလျော့တွက်နှင့် လက်ခ' : 'Wastage & Craft'}</span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                        <span>အလျော့တွက် (Wastage):</span>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">
                          {Number(scannedItem.deduction_pae || 0) > 0
                            ? `${scannedItem.deduction_pae} ပဲ `
                            : ''}
                          {Number(scannedItem.deduction_yway || 0)} Y
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                        <span>လက်ခ (Craft Fee):</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatMMK(
                            Number(scannedItem.craftsmanship_fee || 0) +
                              Number(scannedItem.craftsmanship_profit_fee || 0)
                          )}
                          {scannedItem.craftsmanship_fee_baht
                            ? ` (${formatBaht(scannedItem.craftsmanship_fee_baht)})`
                            : ''}
                        </span>
                      </div>

                      {Number(scannedItem.stone_price || 0) > 0 && (
                        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                          <span>ကျောက်ဖိုး (Stone Price):</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                            {formatMMK(
                              Number(scannedItem.stone_price || 0) +
                                Number(scannedItem.stone_profit_price || 0)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 🏷️ Barcode Tag Preview Section (Toggleable) */}
                {showTagPreview && (
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Dumbbell Barcode Tag (75mm × 15mm Preview)
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePrintTag()}
                        className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Tag</span>
                      </button>
                    </div>

                    <div className="flex justify-center py-2 bg-white dark:bg-black/40 rounded-xl overflow-x-auto border border-amber-200 dark:border-amber-900/40">
                      <InventoryBarcodeTag
                        ref={tagPrintRef}
                        item={scannedItem}
                        offsetY={1.5}
                        offsetX={0}
                        printerModel="xprinter"
                        headOrder="text_first"
                        rotate180={false}
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Barcode Tag Button */}
                    <button
                      type="button"
                      onClick={() => setShowTagPreview(!showTagPreview)}
                      className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {showTagPreview
                          ? (language === 'MM' ? 'Tag ဖျောက်မည်' : 'Hide Tag')
                          : (language === 'MM' ? 'Barcode Tag ကြည့်မည်' : 'View Tag')}
                      </span>
                    </button>

                    {/* Scan Next Button */}
                    <button
                      type="button"
                      onClick={handleScanNext}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                      <span>{language === 'MM' ? 'နောက်တစ်ခု Scan ဖတ်မည်' : 'Scan Next'}</span>
                    </button>
                  </div>

                  {/* Add to POS Button */}
                  <button
                    type="button"
                    onClick={handleSendToPOS}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{language === 'MM' ? 'အရောင်းသို့ ထည့်မည် (POS)' : 'Add to POS / Sell'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
