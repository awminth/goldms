import React, { useState, useMemo } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { OldGoldInflow } from '../types/gold';
import {
  gramsToKpy,
  kpyToGrams,
  KYAT_TO_GRAMS,
  THAI_GRAM_PRESETS,
} from '../utils/goldCalculations';
import { formatDate, todayISO } from '../utils/dateFormat';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';
import { DateInput } from './DateInput';
import { NumberInput } from './NumberInput';
import {
  PackagePlus,
  Search,
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  X,
  Calendar,
  Scale,
  AlertCircle,
  CheckCircle,
  FileText,
  RefreshCw,
} from 'lucide-react';

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const OldGoldInflowView: React.FC = () => {
  const {
    oldGoldInflows,
    addOldGoldInflow,
    updateOldGoldInflow,
    deleteOldGoldInflow,
    masterCategories,
    shopSettings,
    language,
    can,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  // Filter States (Default: 7 days range)
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [purityFilter, setPurityFilter] = useState('ALL');
  const [startDate, setStartDate] = useState(() => daysAgoISO(6));
  const [endDate, setEndDate] = useState(() => todayISO());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OldGoldInflow | null>(null);

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<OldGoldInflow | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    inflow_date: new Date().toISOString().slice(0, 10),
    gold_origin: 'MYANMAR_GOLD',
    purity: '',
    purity_name: '',
    grams: 0,
    kyat: 0,
    pae: 0,
    yway: 0,
    description: '',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Setup Gold Origins
  const goldOrigins = useMemo(() => {
    const list = masterCategories.filter((c) => c.category_group === 'GOLD_ORIGIN');
    if (list.length > 0) {
      return list.map((c) => ({
        code: c.gold_origin || (c.code === 'ORIGIN_THAI' ? 'THAI_GOLD' : 'MYANMAR_GOLD'),
        label: language === 'MM' ? (c.name_mm || c.name_en) : (c.name_en || c.name_mm),
        raw: c,
      }));
    }
    return [
      { code: 'MYANMAR_GOLD', label: language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar Gold' },
      { code: 'THAI_GOLD', label: language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold' },
    ];
  }, [masterCategories, language]);

  // Purities filtered by selected origin in form
  const availablePurities = useMemo(() => {
    const allClasses = masterCategories.filter((c) => c.category_group === 'GOLD_CLASS');
    const selectedOrigin = formData.gold_origin;
    const isThai = selectedOrigin === 'THAI_GOLD' || selectedOrigin === 'ORIGIN_THAI';

    const filtered = allClasses.filter((c) => {
      const cOrigin = c.gold_origin;
      if (isThai) {
        return cOrigin === 'THAI_GOLD' || cOrigin === 'ORIGIN_THAI';
      } else {
        return !cOrigin || cOrigin === 'MYANMAR_GOLD' || cOrigin === 'ORIGIN_MYANMAR';
      }
    });

    return filtered.map((c) => ({
      code: c.code,
      name: language === 'MM' ? (c.name_mm || c.name_en) : (c.name_en || c.name_mm),
      goldCategory: c.gold_origin === 'THAI_GOLD' ? 'THAI_GOLD' : 'PAE_16',
    }));
  }, [masterCategories, formData.gold_origin, language]);

  // All purities for table filter
  const allPurities = useMemo(() => {
    const allClasses = masterCategories.filter((c) => c.category_group === 'GOLD_CLASS');
    return allClasses.map((c) => ({
      code: c.code,
      name: language === 'MM' ? (c.name_mm || c.name_en) : (c.name_en || c.name_mm),
    }));
  }, [masterCategories, language]);

  // Helper to resolve KPY accurately from item
  const resolveItemKpy = (item: { grams: number; weight?: { kyat: number; pae: number; yway: number } }) => {
    const w = item.weight;
    if (w && (w.kyat > 0 || w.pae > 0 || w.yway > 0)) {
      return w;
    }
    return gramsToKpy(Number(item.grams || 0), kyatToGrams);
  };

  const formatKpyDisplay = (kpy: { kyat: number; pae: number; yway: number }) => {
    const ywayStr = Number(kpy.yway || 0).toFixed(1).replace(/\.0$/, '.0');
    return `${kpy.kyat} ကျပ် ${kpy.pae} ပဲ ${ywayStr} ရွေး`;
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    const defaultOrigin = goldOrigins[0]?.code || 'MYANMAR_GOLD';
    const isThai = defaultOrigin === 'THAI_GOLD' || defaultOrigin === 'ORIGIN_THAI';
    const initialClasses = masterCategories.filter(
      (c) => c.category_group === 'GOLD_CLASS' && (isThai ? c.gold_origin === 'THAI_GOLD' : c.gold_origin !== 'THAI_GOLD')
    );
    const firstPurity = initialClasses[0];

    setEditingItem(null);
    setFormData({
      inflow_date: new Date().toISOString().slice(0, 10),
      gold_origin: defaultOrigin,
      purity: firstPurity ? firstPurity.code : (isThai ? 'THAI_GOLD' : 'MEELIN'),
      purity_name: firstPurity ? (firstPurity.name_mm || firstPurity.name_en) : '',
      grams: 0,
      kyat: 0,
      pae: 0,
      yway: 0,
      description: '',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (item: OldGoldInflow) => {
    setEditingItem(item);
    const kpy = resolveItemKpy(item);
    setFormData({
      inflow_date: item.inflow_date ? item.inflow_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      gold_origin: item.gold_origin,
      purity: item.purity,
      purity_name: item.purity_name || '',
      grams: item.grams,
      kyat: kpy.kyat,
      pae: kpy.pae,
      yway: kpy.yway,
      description: item.description,
      notes: item.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Sync grams when KPY changes (Inventory box style)
  const applyFromKpy = (next: { kyat: number; pae: number; yway: number }) => {
    const calculatedGrams = kpyToGrams(next, kyatToGrams);
    setFormData((prev) => ({
      ...prev,
      kyat: next.kyat,
      pae: next.pae,
      yway: next.yway,
      grams: Number(calculatedGrams.toFixed(3)),
    }));
  };

  // Sync KPY when grams change (Inventory box style)
  const applyFromGrams = (grams: number) => {
    const kpy = gramsToKpy(grams, kyatToGrams);
    setFormData((prev) => ({
      ...prev,
      grams,
      kyat: kpy.kyat,
      pae: kpy.pae,
      yway: kpy.yway,
    }));
  };

  // Origin change handler
  const handleOriginChange = (newOrigin: string) => {
    const isThai = newOrigin === 'THAI_GOLD' || newOrigin === 'ORIGIN_THAI';
    const classes = masterCategories.filter(
      (c) => c.category_group === 'GOLD_CLASS' && (isThai ? c.gold_origin === 'THAI_GOLD' : c.gold_origin !== 'THAI_GOLD')
    );
    const firstPurity = classes[0];

    setFormData((prev) => ({
      ...prev,
      gold_origin: newOrigin,
      purity: firstPurity ? firstPurity.code : (isThai ? 'THAI_GOLD' : 'MEELIN'),
      purity_name: firstPurity ? (firstPurity.name_mm || firstPurity.name_en) : '',
    }));
  };

  // Save (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setFormError(language === 'MM' ? 'အကြောင်းအရာ (description) ထည့်သွင်းရန် လိုအပ်ပါသည်' : 'Description is required');
      return;
    }
    if (formData.grams <= 0) {
      setFormError(language === 'MM' ? 'အလေးချိန် (grams) သည် ၀ ထက် ကြီးရပါမည်' : 'Weight must be greater than 0');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const selectedPurityObj = availablePurities.find((p) => p.code === formData.purity);
      const purityName = selectedPurityObj ? selectedPurityObj.name : formData.purity_name || formData.purity;

      const payload = {
        inflow_date: formData.inflow_date,
        gold_origin: formData.gold_origin,
        purity: formData.purity,
        purity_name: purityName,
        grams: formData.grams,
        weight_kyat: formData.kyat,
        weight_pae: formData.pae,
        weight_yway: formData.yway,
        description: formData.description.trim(),
        notes: formData.notes.trim() || undefined,
      };

      if (editingItem) {
        await updateOldGoldInflow(editingItem.id, payload);
        showToast(language === 'MM' ? 'အဟောင်းထည် အဝင်မှတ်တမ်း ပြင်ဆင်ပြီးပါပြီ' : 'Inflow record updated successfully');
      } else {
        await addOldGoldInflow(payload);
        showToast(language === 'MM' ? 'အဟောင်းထည် အဝင်မှတ်တမ်း အသစ်ထည့်သွင်းပြီးပါပြီ' : 'New inflow recorded successfully');
      }

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteOldGoldInflow(deletingItem.id);
      showToast(language === 'MM' ? 'အဟောင်းထည် အဝင်မှတ်တမ်း ပယ်ဖျက်ပြီးပါပြီ' : 'Record deleted successfully');
      setDeletingItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return oldGoldInflows.filter((item) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchNo = item.inflow_no?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        if (!matchNo && !matchDesc && !matchNotes) return false;
      }

      if (originFilter !== 'ALL') {
        const isThai = item.gold_origin === 'THAI_GOLD' || item.gold_origin === 'ORIGIN_THAI';
        if (originFilter === 'THAI_GOLD' && !isThai) return false;
        if (originFilter === 'MYANMAR_GOLD' && isThai) return false;
      }

      if (purityFilter !== 'ALL' && item.purity !== purityFilter) {
        return false;
      }

      if (startDate) {
        const d = item.inflow_date?.slice(0, 10);
        if (d && d < startDate) return false;
      }
      if (endDate) {
        const d = item.inflow_date?.slice(0, 10);
        if (d && d > endDate) return false;
      }

      return true;
    });
  }, [oldGoldInflows, searchTerm, originFilter, purityFilter, startDate, endDate]);

  // Overall Totals
  const totals = useMemo(() => {
    let totalGrams = 0;
    let myanmarGrams = 0;
    let thaiGrams = 0;

    for (const item of filteredList) {
      const g = Number(item.grams || 0);
      totalGrams += g;
      const isThai = item.gold_origin === 'THAI_GOLD' || item.gold_origin === 'ORIGIN_THAI';
      if (isThai) {
        thaiGrams += g;
      } else {
        myanmarGrams += g;
      }
    }

    const totalKpy = gramsToKpy(totalGrams, kyatToGrams);
    const myanmarKpy = gramsToKpy(myanmarGrams, kyatToGrams);
    const thaiKpy = gramsToKpy(thaiGrams, kyatToGrams);

    return {
      count: filteredList.length,
      totalGrams: Number(totalGrams.toFixed(3)),
      myanmarGrams: Number(myanmarGrams.toFixed(3)),
      thaiGrams: Number(thaiGrams.toFixed(3)),
      totalKpy,
      myanmarKpy,
      thaiKpy,
    };
  }, [filteredList, kyatToGrams]);

  // Origin display label helper
  const getOriginLabel = (originCode: string) => {
    const found = goldOrigins.find((o) => o.code === originCode);
    if (found) return found.label;
    if (originCode === 'THAI_GOLD' || originCode === 'ORIGIN_THAI') {
      return language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold';
    }
    return language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar Gold';
  };

  // Excel Export
  const handleExportExcel = () => {
    exportToExcel({
      filename: `old_gold_inflows_${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Old Gold Inflows',
      title: language === 'MM' ? 'အဟောင်းထည် အဝင်မှတ်တမ်းများ' : 'Old Gold Inflows Report',
      columns: [
        { header: language === 'MM' ? 'ရက်စွဲ' : 'Date', value: (r) => r.inflow_date?.slice(0, 10), width: 14 },
        { header: language === 'MM' ? 'မှတ်တမ်းအမှတ်' : 'Inflow No', value: (r) => r.inflow_no, width: 18 },
        { header: language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Origin', value: (r) => getOriginLabel(r.gold_origin), width: 15 },
        { header: language === 'MM' ? 'ရွှေရည်' : 'Purity', value: (r) => r.purity_name || r.purity, width: 14 },
        { header: language === 'MM' ? 'အလေးချိန် (Gram)' : 'Weight (g)', value: (r) => Number(r.grams || 0).toFixed(3), width: 15 },
        {
          header: language === 'MM' ? 'အလေးချိန် (ကျပ်-ပဲ-ရွေး)' : 'Weight (KPY)',
          value: (r) => formatKpyDisplay(resolveItemKpy(r)),
          width: 24,
        },
        { header: language === 'MM' ? 'အကြောင်းအရာ' : 'Description', value: (r) => r.description, width: 28 },
        { header: language === 'MM' ? 'မှတ်ချက်' : 'Notes', value: (r) => r.notes || '—', width: 22 },
      ],
      rows: filteredList,
    });
  };

  const isThaiFormOrigin =
    formData.gold_origin === 'THAI_GOLD' || formData.gold_origin === 'ORIGIN_THAI';

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-lg text-white font-bold text-xs transition-all duration-300 ${
            toastMsg.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toastMsg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  {language === 'MM' ? 'အဟောင်းထည် အဝင်' : 'Old Gold Inflows'}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-mono">
                  {totals.count} {language === 'MM' ? 'ခု' : 'items'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {language === 'MM'
                  ? 'အဟောင်းထည် အဝင်စာရင်းများ ထည့်သွင်းခြင်း၊ ပြင်ဆင်ခြင်းနှင့် မှတ်တမ်းစီမံခြင်း'
                  : 'Manage, record and track all old gold inbound entries and purities'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-gray-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{language === 'MM' ? 'Excel ဒေါင်းလုဒ်' : 'Export Excel'}</span>
            </button>

            {can('old_gold_inflow', 'create') && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'MM' ? 'အဝင်အသစ်ထည့်ရန်' : 'Add Inflow'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Inflows */}
        <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-[11px] font-bold">
              {language === 'MM' ? 'စုစုပေါင်း အဝင်အရေအတွက်' : 'Total Inflow Items'}
            </span>
            <FileText className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-base sm:text-lg font-extrabold font-mono text-gray-900 dark:text-white">
            {totals.count} <span className="text-xs font-sans font-normal text-gray-500">{language === 'MM' ? 'ခု' : 'items'}</span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
            {totals.totalGrams.toFixed(3)} g · {formatKpyDisplay(totals.totalKpy)}
          </div>
        </div>

        {/* Total Grams */}
        <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-[11px] font-bold">
              {language === 'MM' ? 'စုစုပေါင်း အလေးချိန်' : 'Total Weight'}
            </span>
            <Scale className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">
            {totals.totalGrams.toFixed(3)} <span className="text-xs font-sans font-normal text-gray-500">g</span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatKpyDisplay(totals.totalKpy)}
          </div>
        </div>

        {/* Myanmar Gold */}
        <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-[11px] font-bold">
              {getOriginLabel('MYANMAR_GOLD')}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              MM
            </span>
          </div>
          <div className="text-base sm:text-lg font-extrabold font-mono text-gray-900 dark:text-white">
            {totals.myanmarGrams.toFixed(3)} <span className="text-xs font-sans font-normal text-gray-500">g</span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatKpyDisplay(totals.myanmarKpy)}
          </div>
        </div>

        {/* Thai Gold */}
        <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-[11px] font-bold">
              {getOriginLabel('THAI_GOLD')}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
              TH
            </span>
          </div>
          <div className="text-base sm:text-lg font-extrabold font-mono text-gray-900 dark:text-white">
            {totals.thaiGrams.toFixed(3)} <span className="text-xs font-sans font-normal text-gray-500">g</span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatKpyDisplay(totals.thaiKpy)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1A1A1A] p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'MM' ? 'အမှတ်၊ အကြောင်းအရာ ရှာဖွေပါ...' : 'Search by No, description...'}
              className="w-full h-9 pl-8 pr-3 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
            />
          </div>

          {/* Origin Filter */}
          <div>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
            >
              <option value="ALL">{language === 'MM' ? 'ရွှေအမျိုးအစား အားလုံး' : 'All Gold Origins'}</option>
              {goldOrigins.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Purity Filter */}
          <div>
            <select
              value={purityFilter}
              onChange={(e) => setPurityFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
            >
              <option value="ALL">{language === 'MM' ? 'ရွှေရည် အားလုံး' : 'All Purities'}</option>
              {allPurities.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filter Button */}
          <div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setOriginFilter('ALL');
                setPurityFilter('ALL');
                setStartDate(daysAgoISO(6));
                setEndDate(todayISO());
              }}
              className="w-full h-9 flex items-center justify-center gap-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{language === 'MM' ? 'Filter ရှင်းရန်' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{language === 'MM' ? 'ရက်စွဲအပိုင်းအခြား:' : 'Date Range:'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateInput
              value={startDate}
              onChange={setStartDate}
              className="w-36 h-8 px-2.5 text-xs font-mono bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
            />
            <span className="text-gray-400">-</span>
            <DateInput
              value={endDate}
              onChange={setEndDate}
              className="w-36 h-8 px-2.5 text-xs font-mono bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => {
                setStartDate(daysAgoISO(6));
                setEndDate(todayISO());
              }}
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                startDate === daysAgoISO(6) && endDate === todayISO()
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {language === 'MM' ? '၇ ရက်' : '7 Days'}
            </button>
            <button
              type="button"
              onClick={() => {
                const t = todayISO();
                setStartDate(t);
                setEndDate(t);
              }}
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                startDate === todayISO() && endDate === todayISO()
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {language === 'MM' ? 'ယနေ့' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                !startDate && !endDate
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {language === 'MM' ? 'အားလုံး' : 'All'}
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gray-50/50 dark:bg-[#141414] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {language === 'MM' ? 'အဟောင်းထည် အဝင် မှတ်တမ်းစာရင်း' : 'Old Gold Inflow Records'}
            </h3>
          </div>
          <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300">
            <span className="text-gray-500 font-sans mr-1">{language === 'MM' ? 'မှတ်တမ်းပေါင်း:' : 'Records:'}</span>
            <strong className="text-gray-900 dark:text-white font-bold">{totals.count}</strong> {language === 'MM' ? 'ခု' : 'items'}
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
            <strong className="text-amber-700 dark:text-amber-400 font-bold">{totals.totalGrams.toFixed(3)} g</strong>
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
            <strong className="text-gray-800 dark:text-gray-200 font-sans font-bold">{formatKpyDisplay(totals.totalKpy)}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th className="px-3 py-2.5 font-bold w-10">စဉ်</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'ရက်စွဲ' : 'Date'}</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'မှတ်တမ်းအမှတ်' : 'Inflow No'}</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'ရွှေအမျိုးအစား' : 'Origin'}</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'ရွှေရည်' : 'Purity'}</th>
                <th className="px-3 py-2.5 font-bold text-right">{language === 'MM' ? 'အလေးချိန် (Gram)' : 'Grams'}</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'ကျပ် - ပဲ - ရွေး' : 'Kyat - Pae - Yway'}</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'အကြောင်းအရာ' : 'Description'}</th>
                <th className="px-3 py-2.5 font-bold">{language === 'MM' ? 'မှတ်ချက်' : 'Notes'}</th>
                <th className="px-3 py-2.5 font-bold text-center">{language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-xs">
                    <PackagePlus className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                    <p>{language === 'MM' ? 'မှတ်တမ်းမရှိသေးပါ' : 'No inflow records found'}</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const isThai = item.gold_origin === 'THAI_GOLD' || item.gold_origin === 'ORIGIN_THAI';
                  const kpy = resolveItemKpy(item);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-[#141414] transition">
                      {/* No */}
                      <td className="px-3 py-2.5 font-mono text-gray-400">{idx + 1}</td>

                      {/* Date */}
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        {item.inflow_date ? formatDate(item.inflow_date) : '—'}
                      </td>

                      {/* Inflow No */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono font-bold text-amber-600 dark:text-amber-400">
                        {item.inflow_no}
                      </td>

                      {/* Gold Origin */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isThai
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {getOriginLabel(item.gold_origin)}
                        </span>
                      </td>

                      {/* Purity */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-bold text-gray-900 dark:text-white">
                        {item.purity_name || item.purity}
                      </td>

                      {/* Grams */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-mono font-bold text-gray-900 dark:text-white">
                        {Number(item.grams || 0).toFixed(3)} g
                      </td>

                      {/* KPY (Always show full Kyat, Pae, Yway) */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
                        {formatKpyDisplay(kpy)}
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2.5 max-w-[240px] truncate font-medium text-gray-800 dark:text-gray-200" title={item.description}>
                        {item.description}
                      </td>

                      {/* Notes */}
                      <td className="px-3 py-2.5 max-w-[180px] truncate text-gray-500 dark:text-gray-400" title={item.notes}>
                        {item.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {can('old_gold_inflow', 'update') && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title={language === 'MM' ? 'ပြင်ဆင်ရန်' : 'Edit'}
                              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can('old_gold_inflow', 'delete') && (
                            <button
                              type="button"
                              onClick={() => setDeletingItem(item)}
                              title={language === 'MM' ? 'ပယ်ဖျက်ရန်' : 'Delete'}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Total Row */}
            {filteredList.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-[#121212] font-bold border-t border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-xs">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-right">
                    {language === 'MM' ? 'စုစုပေါင်း' : 'Total'}:
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                    {totals.totalGrams.toFixed(3)} g
                  </td>
                  <td className="px-3 py-2.5">
                    {formatKpyDisplay(totals.totalKpy)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <ModalOverlay onClose={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-xl p-5">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <PackagePlus className="w-4 h-4 text-amber-600" />
                <span>
                  {editingItem
                    ? language === 'MM'
                      ? 'အဟောင်းထည် အဝင် ပြင်ဆင်ရန်'
                      : 'Edit Old Gold Inflow'
                    : language === 'MM'
                      ? 'အဟောင်းထည် အဝင် အသစ်ထည့်သွင်းရန်'
                      : 'Add New Old Gold Inflow'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="mt-3.5 space-y-3.5 text-xs max-h-[78vh] overflow-y-auto pr-1">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Gold Origin & Purity (Equal-sized side-by-side dropdowns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ရွှေအမျိုးအစား (Gold Origin) *' : 'Gold Origin *'}
                  </label>
                  <select
                    value={formData.gold_origin}
                    onChange={(e) => handleOriginChange(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white font-semibold"
                  >
                    {goldOrigins.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ရွှေရည် (Purity) *' : 'Purity *'}
                  </label>
                  <select
                    value={formData.purity}
                    onChange={(e) => {
                      const sel = availablePurities.find((p) => p.code === e.target.value);
                      setFormData({
                        ...formData,
                        purity: e.target.value,
                        purity_name: sel ? sel.name : e.target.value,
                      });
                    }}
                    className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white font-semibold"
                  >
                    {availablePurities.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Inflow Date & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ရက်စွဲ *' : 'Inflow Date *'}
                  </label>
                  <DateInput
                    value={formData.inflow_date}
                    onChange={(v) => setFormData({ ...formData, inflow_date: v })}
                    className="w-full h-10 px-3 text-xs font-mono bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'အကြောင်းအရာ (Description) *' : 'Description *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={language === 'MM' ? 'ဥပမာ - ရွှေဆွဲကြိုးအဟောင်း၊ လက်ကောက်အဟောင်း' : 'e.g. Old necklace, old bangle'}
                    className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Row 3: Weight Input (Inventory Box Style: Gram + ကျပ် / ပဲ / ရွေး side-by-side) */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-2.5">
                <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                  <span>{language === 'MM' ? 'အလေးချိန် (Weight) *' : 'Weight *'}</span>
                  <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                </div>

                {isThaiFormOrigin && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {THAI_GRAM_PRESETS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => applyFromGrams(g)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          formData.grams === g
                            ? 'bg-[#D4AF37] text-white border-transparent'
                            : 'bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-amber-50'
                        }`}
                      >
                        {g} g
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-y-2">
                  <div className="w-[8rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                    <NumberInput
                      min={0}
                      step={0.001}
                      value={formData.grams}
                      onChange={applyFromGrams}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                  <div className="hidden sm:block w-5 shrink-0" aria-hidden />
                  <div className="hidden sm:block w-px self-stretch bg-gray-300 dark:bg-gray-600 my-1" />
                  <div className="hidden sm:block w-5 shrink-0" aria-hidden />
                  <div className="flex flex-wrap gap-1.5">
                    <div className="w-[4.75rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                      <NumberInput
                        min={0}
                        value={formData.kyat}
                        onChange={(v) =>
                          applyFromKpy({ kyat: v, pae: formData.pae, yway: formData.yway })
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="w-[4.75rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                      <NumberInput
                        min={0}
                        max={15}
                        value={formData.pae}
                        onChange={(v) =>
                          applyFromKpy({ kyat: formData.kyat, pae: v, yway: formData.yway })
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="w-[4.75rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                      <NumberInput
                        min={0}
                        step={0.1}
                        value={formData.yway}
                        onChange={(v) =>
                          applyFromKpy({ kyat: formData.kyat, pae: formData.pae, yway: v })
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>
                    {language === 'MM' ? 'စုစုပေါင်း အလေးချိန်:' : 'Total Weight:'}
                  </span>
                  <span className="font-mono">
                    {formData.grams.toFixed(3)} g · {formatKpyDisplay({ kyat: formData.kyat, pae: formData.pae, yway: formData.yway })}
                  </span>
                </div>
              </div>

              {/* Row 4: Notes */}
              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  {language === 'MM' ? 'မှတ်ချက် (Notes)' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={language === 'MM' ? 'အခြားအသေးစိတ်အချက်အလက်များ...' : 'Additional notes...'}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {language === 'MM' ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isSaving
                      ? language === 'MM'
                        ? 'သိမ်းဆည်းနေသည်...'
                        : 'Saving...'
                      : language === 'MM'
                        ? 'သိမ်းဆည်းမည်'
                        : 'Save Inflow'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <ModalOverlay onClose={() => setDeletingItem(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-sm p-5 space-y-3.5">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {language === 'MM' ? 'အဟောင်းထည် အဝင်မှတ်တမ်း ပယ်ဖျက်ရန်' : 'Delete Inflow Record'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {language === 'MM'
                  ? `မှတ်တမ်းအမှတ် ${deletingItem.inflow_no} (${deletingItem.description} - ${deletingItem.grams}g) ကို ဖျက်ရန် သေချာပါသလား?`
                  : `Are you sure you want to delete ${deletingItem.inflow_no} (${deletingItem.description} - ${deletingItem.grams}g)?`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {language === 'MM' ? 'မလုပ်တော့ပါ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {language === 'MM' ? 'ဖျက်မည်' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
