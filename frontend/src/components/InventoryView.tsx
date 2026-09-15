import React, { useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  InventoryItem,
  GoldPurity,
  ItemType,
} from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  formatKPYEnglish,
  calculateNetFromParts,
  generateBarcode,
  PURITY_LABELS,
  calculateGoldValuation,
  estimateSellingPrice,
  kpyToYway,
  gramsToKpy,
  kpyToGrams,
  KYAT_TO_GRAMS,
  KYAT_TO_PAE,
  THAI_GRAM_PRESETS,
  calculateThaiGoldPrice,
} from '../utils/goldCalculations';
import {
  Search,
  Plus,
  Barcode,
  Filter,
  Trash2,
  Edit,
  Tag,
  Check,
  X,
  Printer,
  Sparkles,
  Layers,
  RefreshCw,
  PackagePlus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import { DataTable, type DataTableColumn } from './DataTable';
import { ExcelExportButton } from './ExcelExportButton';
import { exportToExcel } from '../utils/excelExport';
import { ModalOverlay } from './ModalOverlay';
import {
  groupInventoryProducts,
  nextStockBarcodes,
  type StockProductGroup,
} from '../utils/inventoryGrouping';

export const InventoryView: React.FC = () => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    goldPrices,
    language,
    refreshData,
    masterCategories,
    shopSettings,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPurity, setSelectedPurity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('IN_STOCK');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Add Stock (restock existing product)
  const [addStockGroup, setAddStockGroup] = useState<StockProductGroup | null>(null);
  const [addStockQty, setAddStockQty] = useState(1);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  // Barcode Tag Preview Modal
  const [tagItem, setTagItem] = useState<InventoryItem | null>(null);

  // Form State
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formNameMM, setFormNameMM] = useState('');
  const [formCategory, setFormCategory] = useState<string>('NECKLACE');
  const [formItemType, setFormItemType] = useState<ItemType>('MYANMAR_GOLD');
  const [formPurity, setFormPurity] = useState<GoldPurity>('MEELIN');


  // Weight tracking: Gross / Gemstone / Wastage (Myanmar) or Thai grams
  const [formGrossGrams, setFormGrossGrams] = useState<number>(KYAT_TO_GRAMS);
  const [formGrossKyat, setFormGrossKyat] = useState<number>(1);
  const [formGrossPae, setFormGrossPae] = useState<number>(0);
  const [formGrossYway, setFormGrossYway] = useState<number>(0);
  const [formGemGrams, setFormGemGrams] = useState<number>(0);
  const [formGemKyat, setFormGemKyat] = useState<number>(0);
  const [formGemPae, setFormGemPae] = useState<number>(0);
  const [formGemYway, setFormGemYway] = useState<number>(0);
  const [formCraftDedGrams, setFormCraftDedGrams] = useState<number>(0);
  const [formCraftDedPae, setFormCraftDedPae] = useState<number>(0);
  const [formCraftDedYway, setFormCraftDedYway] = useState<number>(0);
  const [formProfitDedGrams, setFormProfitDedGrams] = useState<number>(0);
  const [formProfitDedPae, setFormProfitDedPae] = useState<number>(0);
  const [formProfitDedYway, setFormProfitDedYway] = useState<number>(0);
  const [formThaiGrams, setFormThaiGrams] = useState<number>(15.2);
  const [showCustomThaiGram, setShowCustomThaiGram] = useState(false);
  const [formThaiQty, setFormThaiQty] = useState<number>(1);
  const [formCraftsmanship, setFormCraftsmanship] = useState<number>(80000);
  const [formStonePrice, setFormStonePrice] = useState<number>(0);

  const isThaiEntry = formPurity === 'THAI_GOLD' || formItemType === 'THAI_GOLD';

  // Category list from Master Setup (grouped) with fallbacks
  const activeCats = masterCategories.filter((c) => c.is_active);
  const CATEGORIES =
    activeCats.length > 0
      ? activeCats.map((c) => ({
          id: c.code,
          mm: c.name_mm,
          en: c.name_en,
          group: c.category_group || 'PRODUCT',
        }))
      : [
          { id: 'NECKLACE', mm: 'ဆွဲကြိုး', en: 'Necklace', group: 'PRODUCT' },
          { id: 'RING', mm: 'လက်စွပ်', en: 'Ring', group: 'PRODUCT' },
          { id: 'BRACELET', mm: 'လက်ကောက်', en: 'Bracelet', group: 'PRODUCT' },
          { id: 'EARRING', mm: 'နားကပ်', en: 'Earrings', group: 'PRODUCT' },
          { id: 'PENDANT', mm: 'ဆွဲသီး', en: 'Pendant', group: 'PRODUCT' },
          { id: 'BANGLE', mm: 'ဘယက်', en: 'Bangle', group: 'PRODUCT' },
          { id: 'GOLD_BAR', mm: 'ရွှေတုံး', en: 'Gold Bar', group: 'PRODUCT' },
          { id: 'ANKLET', mm: 'ခြေချင်း', en: 'Anklet', group: 'PRODUCT' },
        ];

  const categoryGroups = ['PRODUCT', 'GOLD_CLASS', 'OTHER'] as const;
  // Open modal for new item
  const openNewItemModal = () => {
    setEditingItemId(null);
    setFormBarcode(generateBarcode());
    setFormName('');
    setFormNameMM('');
    setFormCategory('NECKLACE');
    setFormItemType('MYANMAR_GOLD');
    setFormPurity('MEELIN');
    const defaultGrams = kpyToGrams({ kyat: 1, pae: 0, yway: 0 }, kyatToGrams);
    setFormGrossGrams(defaultGrams);
    setFormGrossKyat(1);
    setFormGrossPae(0);
    setFormGrossYway(0);
    setFormGemGrams(0);
    setFormGemKyat(0);
    setFormGemPae(0);
    setFormGemYway(0);
    setFormCraftDedGrams(0);
    setFormCraftDedPae(0);
    setFormCraftDedYway(0);
    setFormProfitDedGrams(0);
    setFormProfitDedPae(0);
    setFormProfitDedYway(0);
    setFormThaiGrams(15.2);
    setShowCustomThaiGram(false);
    setFormThaiQty(1);
    setFormCraftsmanship(80000);
    setFormStonePrice(0);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setFormBarcode(item.barcode);
    setFormName(item.name);
    setFormNameMM(item.name_mm);
    setFormCategory(item.category);
    setFormItemType(item.item_type);
    setFormPurity(item.purity);
    setFormGrossKyat(item.weight_kyat);
    setFormGrossPae(item.weight_pae);
    setFormGrossYway(item.weight_yway);
    setFormGrossGrams(
      kpyToGrams(
        { kyat: item.weight_kyat, pae: item.weight_pae, yway: item.weight_yway },
        kyatToGrams
      )
    );
    setFormGemKyat(item.gemstone_weight_kyat || 0);
    setFormGemPae(item.gemstone_weight_pae || 0);
    setFormGemYway(item.gemstone_weight_yway || 0);
    setFormGemGrams(
      kpyToGrams(
        {
          kyat: item.gemstone_weight_kyat || 0,
          pae: item.gemstone_weight_pae || 0,
          yway: item.gemstone_weight_yway || 0,
        },
        kyatToGrams
      )
    );
    const craftP = item.craft_deduction_pae ?? item.deduction_pae ?? 0;
    const craftY = item.craft_deduction_yway ?? item.deduction_yway ?? 0;
    const profitP = item.profit_deduction_pae ?? 0;
    const profitY = item.profit_deduction_yway ?? 0;
    setFormCraftDedPae(craftP);
    setFormCraftDedYway(craftY);
    setFormCraftDedGrams(kpyToGrams({ kyat: 0, pae: craftP, yway: craftY }, kyatToGrams));
    setFormProfitDedPae(profitP);
    setFormProfitDedYway(profitY);
    setFormProfitDedGrams(kpyToGrams({ kyat: 0, pae: profitP, yway: profitY }, kyatToGrams));
    const thaiG =
      item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'
        ? Number(item.thai_weight_unit || 15.2)
        : 15.2;
    setFormThaiGrams(thaiG);
    setShowCustomThaiGram(!THAI_GRAM_PRESETS.includes(thaiG as (typeof THAI_GRAM_PRESETS)[number]));
    setFormThaiQty(1);
    setFormCraftsmanship(item.craftsmanship_fee);
    setFormStonePrice(item.stone_price || 0);
    setIsModalOpen(true);
  };

  const applyGrossFromGrams = (grams: number) => {
    setFormGrossGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setFormGrossKyat(kpy.kyat);
    setFormGrossPae(kpy.pae);
    setFormGrossYway(kpy.yway);
  };

  const applyGrossFromKpy = (next: { kyat: number; pae: number; yway: number }) => {
    setFormGrossKyat(next.kyat);
    setFormGrossPae(next.pae);
    setFormGrossYway(next.yway);
    setFormGrossGrams(kpyToGrams(next, kyatToGrams));
  };

  const applyGemFromGrams = (grams: number) => {
    setFormGemGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setFormGemKyat(kpy.kyat);
    setFormGemPae(kpy.pae);
    setFormGemYway(kpy.yway);
  };

  const applyGemFromKpy = (next: { kyat: number; pae: number; yway: number }) => {
    setFormGemKyat(next.kyat);
    setFormGemPae(next.pae);
    setFormGemYway(next.yway);
    setFormGemGrams(kpyToGrams(next, kyatToGrams));
  };

  const applyPaeYwayFromGrams = (
    grams: number,
    setGrams: (n: number) => void,
    setPae: (n: number) => void,
    setYway: (n: number) => void
  ) => {
    setGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setPae(kpy.kyat * KYAT_TO_PAE + kpy.pae);
    setYway(kpy.yway);
  };

  const applyGramsFromPaeYway = (
    pae: number,
    yway: number,
    setPae: (n: number) => void,
    setYway: (n: number) => void,
    setGrams: (n: number) => void
  ) => {
    setPae(pae);
    setYway(yway);
    setGrams(kpyToGrams({ kyat: 0, pae, yway }, kyatToGrams));
  };

  const applyThaiGrams = (grams: number) => {
    const g = Math.max(0, Number(grams) || 0);
    setFormThaiGrams(g);
    const thai = calculateThaiGoldPrice(g, 1, 0);
    setFormGrossKyat(thai.weightKpy.kyat);
    setFormGrossPae(thai.weightKpy.pae);
    setFormGrossYway(thai.weightKpy.yway);
    setFormGrossGrams(g);
    setFormGemGrams(0);
    setFormGemKyat(0);
    setFormGemPae(0);
    setFormGemYway(0);
    setFormCraftDedGrams(0);
    setFormCraftDedPae(0);
    setFormCraftDedYway(0);
    setFormProfitDedGrams(0);
    setFormProfitDedPae(0);
    setFormProfitDedYway(0);
  };

  const totalDedPae = formCraftDedPae + formProfitDedPae;
  const totalDedYway = formCraftDedYway + formProfitDedYway;
  const totalDedGrams = kpyToGrams({ kyat: 0, pae: totalDedPae, yway: totalDedYway }, kyatToGrams);

  const gemstoneKpy = { kyat: formGemKyat, pae: formGemPae, yway: formGemYway };
  const computedNet = isThaiEntry
    ? calculateThaiGoldPrice(formThaiGrams, 1, 0).weightKpy
    : calculateNetFromParts(
        { kyat: formGrossKyat, pae: formGrossPae, yway: formGrossYway },
        gemstoneKpy,
        totalDedPae,
        totalDedYway
      );

  // Compute estimated selling price (live rates — Myanmar KPY + Thai)
  const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const specificPurityPrice = goldPrices.find((p) => p.gold_type === formPurity)?.price_per_kyat;
  const estimatedTotalSelling = estimateSellingPrice({
    purity: formPurity,
    itemType: isThaiEntry ? 'THAI_GOLD' : formItemType,
    netWeight: computedNet,
    thaiWeightUnit: isThaiEntry ? formThaiGrams : null,
    craftsmanshipFee: Number(formCraftsmanship || 0),
    stonePrice: Number(formStonePrice || 0),
    pricePerKyat16Pe: pure16Price,
    specificSellPrice: specificPurityPrice,
    thaiRatePerKyat: goldPrices.find((p) => p.gold_type === 'THAI_GOLD')?.price_per_kyat,
  });
  const valuation = isThaiEntry
    ? {
        goldAmount: calculateThaiGoldPrice(
          formThaiGrams,
          goldPrices.find((p) => p.gold_type === 'THAI_GOLD')?.price_per_kyat || 0,
          0
        ).baseGoldPrice,
      }
    : calculateGoldValuation(computedNet, formPurity, pure16Price, specificPurityPrice);

  // Save item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName && !formNameMM) return;

    const itemPayload = {
      barcode: formBarcode || generateBarcode(),
      category: isThaiEntry ? 'THAI_GOLD' : formCategory,
      name: formName || formNameMM,
      name_mm: formNameMM || formName,
      weight_kyat: Number(formGrossKyat || 0),
      weight_pae: Number(formGrossPae || 0),
      weight_yway: Number(formGrossYway || 0),
      gemstone_weight_kyat: isThaiEntry ? 0 : Number(formGemKyat || 0),
      gemstone_weight_pae: isThaiEntry ? 0 : Number(formGemPae || 0),
      gemstone_weight_yway: isThaiEntry ? 0 : Number(formGemYway || 0),
      craft_deduction_pae: isThaiEntry ? 0 : Number(formCraftDedPae || 0),
      craft_deduction_yway: isThaiEntry ? 0 : Number(formCraftDedYway || 0),
      profit_deduction_pae: isThaiEntry ? 0 : Number(formProfitDedPae || 0),
      profit_deduction_yway: isThaiEntry ? 0 : Number(formProfitDedYway || 0),
      deduction_pae: isThaiEntry ? 0 : totalDedPae,
      deduction_yway: isThaiEntry ? 0 : totalDedYway,
      net_weight_kyat: computedNet.kyat,
      net_weight_pae: computedNet.pae,
      net_weight_yway: computedNet.yway,
      purity: formPurity,
      item_type: isThaiEntry ? ('THAI_GOLD' as ItemType) : formItemType,
      thai_weight_unit: isThaiEntry ? formThaiGrams : undefined,
      craftsmanship_fee: Number(formCraftsmanship || 0),
      stone_price: isThaiEntry ? 0 : Number(formStonePrice || 0),
      selling_price_estimated: estimatedTotalSelling,
      status: 'IN_STOCK' as const,
    };

    if (editingItemId) {
      await updateInventoryItem(editingItemId, itemPayload);
    } else if (isThaiEntry) {
      const qty = Math.max(1, Math.min(99, Math.floor(Number(formThaiQty) || 1)));
      const base = (formBarcode || generateBarcode()).replace(/-\d+$/, '');
      for (let i = 0; i < qty; i++) {
        const barcode = qty === 1 ? base : `${base}-${String(i + 1).padStart(2, '0')}`;
        await addInventoryItem({ ...itemPayload, barcode });
      }
    } else {
      await addInventoryItem(itemPayload);
    }

    setIsModalOpen(false);
  };

  // Filtered inventory list (units)
  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_mm.includes(searchQuery);

    const matchesCategory =
      selectedCategory === 'ALL' ||
      item.category === selectedCategory ||
      (selectedCategory === 'THAI_GOLD' &&
        (item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'));
    const matchesPurity = selectedPurity === 'ALL' || item.purity === selectedPurity;
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesPurity && matchesStatus;
  });

  /** Product groups for list — remaining qty always from live IN_STOCK across full inventory */
  const productGroups = useMemo(() => {
    const allByKey = new Map(groupInventoryProducts(inventory).map((g) => [g.key, g]));
    const filteredKeys = new Set(groupInventoryProducts(filteredItems).map((g) => g.key));
    return Array.from(filteredKeys)
      .map((key) => allByKey.get(key)!)
      .filter(Boolean)
      .filter((g) => (selectedStatus === 'IN_STOCK' ? g.remainingQty > 0 : true))
      .sort((a, b) =>
        (a.sample.name_mm || a.sample.name).localeCompare(b.sample.name_mm || b.sample.name)
      );
  }, [inventory, filteredItems, selectedStatus]);

  const handleAddStock = async () => {
    if (!addStockGroup) return;
    const qty = Math.max(1, Math.min(99, Math.floor(Number(addStockQty) || 1)));
    const sample = addStockGroup.sample;
    const barcodes = nextStockBarcodes(
      inventory.map((i) => i.barcode),
      sample.barcode,
      qty
    );
    const isThai = sample.item_type === 'THAI_GOLD' || sample.purity === 'THAI_GOLD';
    for (const barcode of barcodes) {
      await addInventoryItem({
        barcode,
        category: isThai ? 'THAI_GOLD' : sample.category,
        name: sample.name,
        name_mm: sample.name_mm,
        weight_kyat: sample.weight_kyat,
        weight_pae: sample.weight_pae,
        weight_yway: sample.weight_yway,
        gemstone_weight_kyat: sample.gemstone_weight_kyat || 0,
        gemstone_weight_pae: sample.gemstone_weight_pae || 0,
        gemstone_weight_yway: sample.gemstone_weight_yway || 0,
        craft_deduction_pae: sample.craft_deduction_pae || 0,
        craft_deduction_yway: sample.craft_deduction_yway || 0,
        profit_deduction_pae: sample.profit_deduction_pae || 0,
        profit_deduction_yway: sample.profit_deduction_yway || 0,
        deduction_pae: sample.deduction_pae || 0,
        deduction_yway: sample.deduction_yway || 0,
        net_weight_kyat: sample.net_weight_kyat,
        net_weight_pae: sample.net_weight_pae,
        net_weight_yway: sample.net_weight_yway,
        purity: sample.purity,
        item_type: sample.item_type,
        thai_weight_unit: sample.thai_weight_unit,
        craftsmanship_fee: sample.craftsmanship_fee,
        stone_price: sample.stone_price || 0,
        selling_price_estimated: sample.selling_price_estimated,
        status: 'IN_STOCK',
      });
    }
    setAddStockGroup(null);
    setAddStockQty(1);
  };

  const exportInventoryExcel = () => {
    exportToExcel({
      filename: 'inventory',
      sheetName: 'Inventory',
      title: language === 'MM' ? 'ရွှေထည် စာရင်း (Inventory)' : 'Gold Inventory Report',
      columns: [
        { header: 'Barcode', value: (i) => i.barcode, width: 16 },
        { header: language === 'MM' ? 'အမည် (MM)' : 'Name (MM)', value: (i) => i.name_mm, width: 22 },
        { header: 'Name (EN)', value: (i) => i.name, width: 22 },
        { header: 'Category', value: (i) => i.category, width: 14 },
        { header: 'Purity', value: (i) => PURITY_LABELS[i.purity]?.en || i.purity, width: 14 },
        { header: 'Type', value: (i) => i.item_type, width: 14 },
        {
          header: language === 'MM' ? 'အထည်ချိန်' : 'Gross Weight',
          value: (i) => formatKPYEnglish({ kyat: i.weight_kyat, pae: i.weight_pae, yway: i.weight_yway }),
          width: 16,
        },
        {
          header: language === 'MM' ? 'ရွှေချိန်စင်' : 'Net Weight',
          value: (i) =>
            formatKPYEnglish({
              kyat: i.net_weight_kyat,
              pae: i.net_weight_pae,
              yway: i.net_weight_yway,
            }),
          width: 16,
        },
        { header: language === 'MM' ? 'လက်ခ' : 'Craft Fee', value: (i) => i.craftsmanship_fee, width: 12 },
        { header: language === 'MM' ? 'ခန့်မှန်းဈေး' : 'Est. Price', value: (i) => i.selling_price_estimated, width: 14 },
        { header: 'Status', value: (i) => i.status, width: 12 },
      ],
      rows: filteredItems,
    });
  };

  const inventoryColumns = useMemo<DataTableColumn<StockProductGroup>[]>(
    () => [
      {
        id: 'expand',
        header: '',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        cell: (group) => (
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-[#D4AF37]"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedGroupKey((k) => (k === group.key ? null : group.key));
            }}
            title={language === 'MM' ? 'ယူနစ်များ' : 'Units'}
          >
            {expandedGroupKey === group.key ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ),
      },
      {
        id: 'name',
        header: language === 'MM' ? 'ပစ္စည်းအမည်' : 'Product',
        accessor: (g) => (language === 'MM' ? g.sample.name_mm : g.sample.name),
        cell: (group) => {
          const item = group.sample;
          return (
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {language === 'MM' ? item.name_mm : item.name}
              </div>
              <span className="text-[10px] uppercase font-bold text-gray-400">
                {item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD'
                  ? 'THAI GOLD'
                  : `${item.category} • MYANMAR`}
              </span>
            </div>
          );
        },
      },
      {
        id: 'purity',
        header: language === 'MM' ? 'ရွှေရည် / ဂရမ်' : 'Purity / Gram',
        accessor: (g) => g.sample.purity,
        cell: (group) => {
          const item = group.sample;
          const isThai = item.item_type === 'THAI_GOLD' || item.purity === 'THAI_GOLD';
          return (
            <div className="space-y-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#D4AF37]/15 text-[#996515] dark:text-[#FFD700] border border-[#D4AF37]/25 whitespace-nowrap">
                {PURITY_LABELS[item.purity]?.mm || item.purity}
              </span>
              <div className="font-mono text-[11px] text-gray-600 dark:text-gray-300">
                {isThai && item.thai_weight_unit
                  ? `${item.thai_weight_unit} g`
                  : language === 'MM'
                    ? formatKPYMyanmar({
                        kyat: item.net_weight_kyat,
                        pae: item.net_weight_pae,
                        yway: item.net_weight_yway,
                      })
                    : formatKPYEnglish({
                        kyat: item.net_weight_kyat,
                        pae: item.net_weight_pae,
                        yway: item.net_weight_yway,
                      })}
              </div>
            </div>
          );
        },
      },
      {
        id: 'qty',
        header: language === 'MM' ? 'ဆိုင်ကျန် (Qty)' : 'In Stock Qty',
        accessor: (g) => g.remainingQty,
        align: 'center',
        cell: (group) => (
          <span className="inline-flex min-w-[2.5rem] justify-center px-2.5 py-1 rounded-lg text-sm font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
            {group.remainingQty}
          </span>
        ),
      },
      {
        id: 'craft',
        header: language === 'MM' ? 'လက်ခ' : 'Craft',
        accessor: (g) => g.sample.craftsmanship_fee,
        align: 'right',
        cell: (group) => (
          <span className="font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
            {formatMMK(group.sample.craftsmanship_fee)}
          </span>
        ),
      },
      {
        id: 'value',
        header: language === 'MM' ? 'ခန့်မှန်းတန်ဖိုး' : 'Est. Value',
        accessor: (g) => g.sample.selling_price_estimated,
        align: 'right',
        cell: (group) => (
          <span className="font-mono font-bold text-gray-900 dark:text-amber-300 whitespace-nowrap">
            {formatMMK(group.sample.selling_price_estimated)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions',
        accessor: () => '',
        sortable: false,
        searchIgnore: true,
        align: 'center',
        cell: (group) => (
          <div className="flex items-center justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setAddStockGroup(group);
                setAddStockQty(1);
              }}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              title={language === 'MM' ? 'Stock ထပ်တိုးမည်' : 'Add Stock'}
            >
              <PackagePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTagItem(group.sample)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#D4AF37]"
              title="Print Barcode Tag"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openEditModal(group.inStockUnits[0] || group.sample)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"
              title={language === 'MM' ? 'ယူနစ်တစ်ခု ပြင်မည်' : 'Edit one unit'}
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [language, expandedGroupKey]
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Search Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#1A1A1A] p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Tag className="w-5 h-5 text-[#D4AF37]" />
            <span>{language === 'MM' ? 'ရွှေထည်ပစ္စည်း စာရင်း & ဘားကုဒ်စနစ်' : 'Stock Inventory & Barcode Management'}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {language === 'MM'
              ? 'တူညီသောပစ္စည်းများကို Qty အုပ်စုပြသည် — ဆိုင်ကျန်အရေအတွက်သာ ပြသသည်။ Stock ထပ်တိုးရန် Add Stock ကိုသုံးပါ။'
              : 'Identical items are grouped with remaining qty. Use Add Stock to restock — Edit changes one unit only.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Barcode Search / Scanner Input */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder={language === 'MM' ? 'ဘားကုဒ် / ပစ္စည်းအမည် ရှာရန်...' : 'Scan / Search Barcode or Name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
            />
            <Barcode className="w-4 h-4 text-[#D4AF37] absolute left-3 top-2.5" />
          </div>

          <button
            type="button"
            onClick={async () => {
              await api.revalueInventory();
              await refreshData();
            }}
            className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 text-[#996515] dark:text-amber-300 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/30 transition flex items-center space-x-1.5"
            title={language === 'MM' ? 'နေ့စဉ်ဈေးဖြင့် စတော့တန်ဖိုး ပြန်တွက်မည်' : 'Revalue stock from live prices'}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'MM' ? 'ဈေးဖြင့် ပြန်တွက်' : 'Revalue'}</span>
          </button>

          <ExcelExportButton
            language={language}
            onClick={exportInventoryExcel}
            disabled={productGroups.length === 0}
            className="!py-2 !rounded-xl"
          />

          {/* Add New Stock Item Button */}
          <button
            onClick={openNewItemModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold hover:opacity-95 transition shadow-xs flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'MM' ? 'ရွှေထည်အသစ် သွင်းမည်' : 'Add New Item'}</span>
          </button>

        </div>

      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        
        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-gray-200 text-xs font-medium"
        >
          <option value="ALL">{language === 'MM' ? 'အမျိုးအစားအားလုံး' : 'All Categories'}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {language === 'MM' ? c.mm : c.en}
            </option>
          ))}
        </select>

        {/* Purity Filter */}
        <select
          value={selectedPurity}
          onChange={(e) => setSelectedPurity(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-gray-200 text-xs font-medium"
        >
          <option value="ALL">{language === 'MM' ? 'ရွှေရည်အားလုံး' : 'All Purities'}</option>
          {Object.entries(PURITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {language === 'MM' ? v.mm : v.en}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] dark:text-gray-200 text-xs font-medium"
        >
          <option value="ALL">{language === 'MM' ? 'အခြေအနေအားလုံး' : 'All Statuses'}</option>
          <option value="IN_STOCK">{language === 'MM' ? 'ဆိုင်ရှိပစ္စည်း (In Stock)' : 'In Stock'}</option>
          <option value="SOLD">{language === 'MM' ? 'ရောင်းချပြီး (Sold)' : 'Sold'}</option>
          <option value="UNDER_PAWN">{language === 'MM' ? 'ပေါင်နှံထားဆဲ (Under Pawn)' : 'Under Pawn'}</option>
        </select>

        <span className="text-gray-400 dark:text-gray-500 ml-auto">
          {productGroups.length} {language === 'MM' ? 'ပစ္စည်း' : 'products'} ·{' '}
          {productGroups.reduce((n, g) => n + g.remainingQty, 0)}{' '}
          {language === 'MM' ? 'ခု ကျန်' : 'pcs left'}
        </span>
      </div>

      <DataTable
        rows={productGroups}
        columns={inventoryColumns}
        rowKey={(g) => g.key}
        language={language}
        searchable
        searchPlaceholder={language === 'MM' ? 'ဘားကုဒ် / အမည် ရှာရန်…' : 'Search barcode / name…'}
        getSearchText={(g) =>
          [
            g.sample.name,
            g.sample.name_mm,
            g.sample.barcode,
            ...g.units.map((u) => u.barcode),
          ].join(' ')
        }
        resetDeps={[searchQuery, selectedCategory, selectedPurity, selectedStatus, expandedGroupKey]}
        emptyMessage={language === 'MM' ? 'ပစ္စည်းမတွေ့ပါ' : 'No inventory items'}
        maxHeightClass={false}
        renderRowExtra={(group) =>
          expandedGroupKey === group.key ? (
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#121212] border-t border-gray-100 dark:border-gray-800 space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                {language === 'MM' ? 'ယူနစ် / ဘားကုဒ်များ' : 'Units / Barcodes'}
              </p>
              <div className="space-y-1.5">
                {group.units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Barcode className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                      <span className="font-mono text-xs font-bold">{unit.barcode}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          unit.status === 'IN_STOCK'
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {unit.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTagItem(unit)}
                        className="p-1 rounded text-gray-400 hover:text-[#D4AF37]"
                        title="Print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(unit)}
                        className="p-1 rounded text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteInventoryItem(unit.id)}
                        className="p-1 rounded text-gray-400 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        }
      />

      {addStockGroup && (
        <ModalOverlay className="p-3 sm:p-5" onBackdropClick={() => setAddStockGroup(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-emerald-600" />
                  {language === 'MM' ? 'Stock ထပ်တိုးမည်' : 'Add Stock'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {addStockGroup.sample.name_mm || addStockGroup.sample.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {language === 'MM' ? 'လက်ရှိကျန်' : 'Current remaining'}:{' '}
                  <strong className="text-emerald-700">{addStockGroup.remainingQty}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setAddStockGroup(null)} className="p-1 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
              {language === 'MM' ? 'ထပ်တိုးမည့် အရေအတွက် (Qty)' : 'Quantity to add'}
              <input
                type="number"
                min={1}
                max={99}
                value={addStockQty}
                onChange={(e) => setAddStockQty(Number(e.target.value) || 1)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-sm font-bold"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddStockGroup(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700"
              >
                {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleAddStock()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {language === 'MM' ? `${addStockQty} ခု ထည့်မည်` : `Add ${addStockQty}`}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <ModalOverlay className="p-3 sm:p-5">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
                <Tag className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {editingItemId
                    ? (language === 'MM' ? 'ရွှေထည်ပစ္စည်း ပြင်ဆင်ရန်' : 'Edit Stock Item')
                    : (language === 'MM' ? 'ရွှေထည်ပစ္စည်း အသစ်ထည့်သွင်းခြင်း' : 'Add New Gold Inventory Item')}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4 flex-1">
              
              {/* Row 1: Barcode & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ဘားကုဒ်နံပါတ် (Barcode):' : 'Barcode ID:'}
                  </label>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      required
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setFormBarcode(generateBarcode())}
                      className="px-2.5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-200"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isThaiEntry
                      ? language === 'MM'
                        ? 'အမျိုးအစား / အရေအတွက်'
                        : 'Category / Qty'
                      : language === 'MM'
                        ? 'အမျိုးအစား (Category):'
                        : 'Category:'}
                  </label>
                  {isThaiEntry ? (
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border border-[#D4AF37]/40 bg-[#FAF8F2] dark:bg-[#201D17] text-[#996515] dark:text-amber-300">
                        {language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}
                      </div>
                      {!editingItemId && (
                        <div className="w-24">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={formThaiQty}
                            onChange={(e) => setFormThaiQty(Math.max(1, Number(e.target.value) || 1))}
                            title="Qty"
                            className="w-full px-2 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-center"
                          />
                          <span className="block text-[10px] text-center text-gray-400 mt-0.5">
                            {language === 'MM' ? 'Qty' : 'Qty'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                    >
                      {categoryGroups.map((g) => {
                        const opts = CATEGORIES.filter((c) => c.group === g);
                        if (!opts.length) return null;
                        const label =
                          g === 'PRODUCT'
                            ? language === 'MM'
                              ? 'ပစ္စည်းအမျိုးအစား'
                              : 'Item Types'
                            : g === 'GOLD_CLASS'
                              ? language === 'MM'
                                ? 'Categories (ပဲရည်)'
                                : 'Categories (Purity)'
                              : language === 'MM'
                                ? 'အခြား'
                                : 'Other';
                        return (
                          <optgroup key={g} label={label}>
                            {opts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {language === 'MM' ? c.mm : c.en}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

              {/* Row 2: Names (Myanmar and English) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'မြန်မာအမည် (ဥပမာ- နဂါးလိမ်ဆွဲကြိုး):' : 'Item Name (Myanmar):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ရွှေဆွဲကြိုး"
                    value={formNameMM}
                    onChange={(e) => setFormNameMM(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'အင်္ဂလိပ်အမည် (English Name):' : 'English Name:'}
                  </label>
                  <input
                    type="text"
                    placeholder="Gold Necklace"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Row 3: Gold path — Myanmar vs Thai */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {language === 'MM' ? 'ရွှေအမျိုးအစား:' : 'Gold path:'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormItemType('MYANMAR_GOLD');
                        if (formPurity === 'THAI_GOLD') setFormPurity('MEELIN');
                      }}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${
                        !isThaiEntry
                          ? 'bg-[#D4AF37] text-white border-transparent'
                          : 'bg-white dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600'
                      }`}
                    >
                      {language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormItemType('THAI_GOLD');
                        setFormPurity('THAI_GOLD');
                        applyThaiGrams(formThaiGrams || 15.2);
                      }}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${
                        isThaiEntry
                          ? 'bg-[#D4AF37] text-white border-transparent'
                          : 'bg-white dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600'
                      }`}
                    >
                      {language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold'}
                    </button>
                  </div>
                </div>
                {!isThaiEntry && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {language === 'MM' ? 'ရွှေရည် / အရည်အသွေး (Purity):' : 'Purity Standard:'}
                    </label>
                    <select
                      value={formPurity}
                      onChange={(e) => {
                        const pur = e.target.value as GoldPurity;
                        setFormPurity(pur);
                        setFormItemType(pur === 'THAI_GOLD' ? 'THAI_GOLD' : 'MYANMAR_GOLD');
                      }}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                    >
                      {Object.entries(PURITY_LABELS)
                        .filter(([k]) => k !== 'THAI_GOLD')
                        .map(([k, v]) => (
                          <option key={k} value={k}>
                            {language === 'MM' ? v.mm : v.en}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Weight Tracking */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-3">
                {isThaiEntry ? (
                  <>
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {language === 'MM' ? 'ထိုင်းရွှေ Gram ယူနစ်' : 'Thai Gold — Gram units'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {THAI_GRAM_PRESETS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setShowCustomThaiGram(false);
                            applyThaiGrams(g);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                            !showCustomThaiGram && formThaiGrams === g
                              ? 'bg-[#D4AF37] text-white border-transparent'
                              : 'bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-gray-700'
                          }`}
                        >
                          {g} g
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowCustomThaiGram(true)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-dashed border-[#D4AF37] text-[#996515] flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Gram
                      </button>
                    </div>
                    {(showCustomThaiGram ||
                      !(THAI_GRAM_PRESETS as readonly number[]).includes(formThaiGrams)) && (
                      <div className="max-w-[160px]">
                        <label className="text-[11px] text-gray-500 block mb-0.5">Custom Gram</label>
                        <input
                          type="number"
                          min={0}
                          step={0.001}
                          value={formThaiGrams}
                          onChange={(e) => applyThaiGrams(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                        />
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500">
                      {language === 'MM'
                        ? `ရွေးချယ်ထား = ${formThaiGrams} g (၁ ကျပ် ≈ 15.2 g)`
                        : `Selected = ${formThaiGrams} g (1 kyat ≈ 15.2 g)`}
                    </div>
                    {!editingItemId && (
                      <div className="max-w-[140px]">
                        <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                          {language === 'MM' ? 'အရေအတွက် (Qty)' : 'Quantity (Qty)'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={formThaiQty}
                          onChange={(e) => setFormThaiQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {language === 'MM'
                            ? `${formThaiQty} ခု စတော့အဖြစ် သီးခြားထည့်မည်`
                            : `Will add ${formThaiQty} stock unit(s)`}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                        {language === 'MM' ? 'လက်ခ' : 'Craft Fee'}
                      </label>
                      <input
                        type="number"
                        step={5000}
                        value={formCraftsmanship}
                        onChange={(e) => setFormCraftsmanship(Number(e.target.value))}
                        className="w-full max-w-xs px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {language === 'MM' ? 'ရွှေချိန် (Net)' : 'Net Weight'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formThaiGrams} g ·{' '}
                        {language === 'MM' ? formatKPYMyanmar(computedNet) : formatKPYEnglish(computedNet)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                      <span>{language === 'MM' ? '၁။ အထည်ချိန် (Gross Weight)' : '1. Gross Weight'}</span>
                      <span className="text-gray-400 font-normal">Gram / ကျပ် / ပဲ / ရွေး</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                        <input type="number" min={0} step={0.001} value={formGrossGrams} onChange={(e) => applyGrossFromGrams(Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                        <input type="number" min={0} value={formGrossKyat} onChange={(e) => applyGrossFromKpy({ kyat: Number(e.target.value), pae: formGrossPae, yway: formGrossYway })} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                        <input type="number" min={0} max={15} value={formGrossPae} onChange={(e) => applyGrossFromKpy({ kyat: formGrossKyat, pae: Number(e.target.value), yway: formGrossYway })} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                        <input type="number" min={0} step={0.1} value={formGrossYway} onChange={(e) => applyGrossFromKpy({ kyat: formGrossKyat, pae: formGrossPae, yway: Number(e.target.value) })} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="text-xs font-bold text-sky-700 dark:text-sky-300 mb-2 flex items-center justify-between">
                        <span>{language === 'MM' ? '၂။ ကျောက်ချိန်' : '2. Gemstone'}</span>
                        <span className="text-gray-400 font-normal">Gram / ကျပ် / ပဲ / ရွေး</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                          <input type="number" min={0} step={0.001} value={formGemGrams} onChange={(e) => applyGemFromGrams(Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                          <input type="number" min={0} value={formGemKyat} onChange={(e) => applyGemFromKpy({ kyat: Number(e.target.value), pae: formGemPae, yway: formGemYway })} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                          <input type="number" min={0} value={formGemPae} onChange={(e) => applyGemFromKpy({ kyat: formGemKyat, pae: Number(e.target.value), yway: formGemYway })} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                          <input type="number" min={0} step={0.1} value={formGemYway} onChange={(e) => applyGemFromKpy({ kyat: formGemKyat, pae: formGemPae, yway: Number(e.target.value) })} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {language === 'MM' ? '၃။ အလျော့တွက်' : '3. Wastage'}
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-rose-500 mb-1">
                          {language === 'MM' ? 'ပန်းထိမ်အလျော့တွက်' : 'Craft wastage'}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                            <input type="number" min={0} step={0.001} value={formCraftDedGrams} onChange={(e) => applyPaeYwayFromGrams(Number(e.target.value), setFormCraftDedGrams, setFormCraftDedPae, setFormCraftDedYway)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                            <input type="number" min={0} value={formCraftDedPae} onChange={(e) => applyGramsFromPaeYway(Number(e.target.value), formCraftDedYway, setFormCraftDedPae, setFormCraftDedYway, setFormCraftDedGrams)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                            <input type="number" min={0} step={0.1} value={formCraftDedYway} onChange={(e) => applyGramsFromPaeYway(formCraftDedPae, Number(e.target.value), setFormCraftDedPae, setFormCraftDedYway, setFormCraftDedGrams)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-rose-500 mb-1">
                          {language === 'MM' ? 'အမြတ်အလျော့တွက်' : 'Profit wastage'}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                            <input type="number" min={0} step={0.001} value={formProfitDedGrams} onChange={(e) => applyPaeYwayFromGrams(Number(e.target.value), setFormProfitDedGrams, setFormProfitDedPae, setFormProfitDedYway)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                            <input type="number" min={0} value={formProfitDedPae} onChange={(e) => applyGramsFromPaeYway(Number(e.target.value), formProfitDedYway, setFormProfitDedPae, setFormProfitDedYway, setFormProfitDedGrams)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                            <input type="number" min={0} step={0.1} value={formProfitDedYway} onChange={(e) => applyGramsFromPaeYway(formProfitDedPae, Number(e.target.value), setFormProfitDedPae, setFormProfitDedYway, setFormProfitDedGrams)} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                          </div>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 flex justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
                        <span>{language === 'MM' ? 'စုစုပေါင်းအလျော့တွက်' : 'Total wastage'}</span>
                        <span className="font-mono">
                          {totalDedGrams} g · {totalDedPae} ပဲ {totalDedYway} ရွေး
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                          {language === 'MM' ? 'လက်ခ' : 'Craft Fee'}
                        </label>
                        <input type="number" step={5000} value={formCraftsmanship} onChange={(e) => setFormCraftsmanship(Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                          {language === 'MM' ? 'ကျောက်ဖိုး' : 'Stone Price'}
                        </label>
                        <input type="number" step={500} value={formStonePrice} onChange={(e) => setFormStonePrice(Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {language === 'MM' ? '၄။ ရွှေချိန် (Net) = အထည် − ကျောက် − အလျော့' : '4. Net Gold Weight'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        {language === 'MM' ? formatKPYMyanmar(computedNet) : formatKPYEnglish(computedNet)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Total Summary Footer */}
              <div className="p-3 rounded-xl bg-[#FAF8F2] dark:bg-[#221F18] border border-[#D4AF37]/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    {language === 'MM' ? 'ယနေ့ပေါက်ဈေးဖြင့် ခန့်မှန်းရောင်းဈေး:' : 'Estimated Selling Price:'}
                  </span>
                  <span className="text-xs text-gray-400">
                    (ရွှေတန်ဖိုး {formatMMK(valuation.goldAmount)} + လက်ခ {formatMMK(formCraftsmanship)}
                    {Number(formStonePrice) > 0 ? ` + ကျောက်ဖိုး ${formatMMK(formStonePrice)}` : ''})
                  </span>
                </div>
                <div className="text-lg font-extrabold text-[#996515] dark:text-amber-300 font-mono">
                  {formatMMK(estimatedTotalSelling)}
                </div>
              </div>
              </div>

              <div className="px-5 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-2 shrink-0 bg-white dark:bg-[#1A1A1A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059] transition shadow-md"
                >
                  {language === 'MM' ? 'စာရင်းသွင်းမည်' : 'Save Item'}
                </button>
              </div>

            </form>

          </div>
        </ModalOverlay>
      )}

      {/* Barcode Tag Print Preview Modal */}
      {tagItem && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#D4AF37]/30">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center space-x-2">
                <Printer className="w-4 h-4 text-[#D4AF37]" />
                <span>{language === 'MM' ? 'ရွှေပြည့်လှိုင် ရွှေထည်ကတ်ပြား (Tag)' : 'Shwe Pyae Hlaing Jewelry Tag'}</span>
              </h3>
              <button
                onClick={() => setTagItem(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Realistic Jewelry Price Tag */}
            <div className="mt-4 p-4 rounded-xl bg-[#FAF8F2] border-2 border-dashed border-[#D4AF37] text-center text-gray-900">
              <div className="text-[11px] font-extrabold tracking-widest text-[#996515] uppercase font-serif">
                SHWE PYAE HLAING GOLD
              </div>
              <div className="text-xs font-bold text-gray-800 mt-1">
                {tagItem.name_mm}
              </div>

              {/* Barcode visual */}
              <div className="my-2 p-2 bg-white rounded border border-gray-300">
                <div className="text-lg tracking-widest font-mono font-bold text-black select-all">
                  ||| | |||| | ||| ||
                </div>
                <div className="text-[11px] font-mono font-bold text-gray-700">
                  {tagItem.barcode}
                </div>
              </div>

              <div className="text-xs space-y-1 text-left border-t border-gray-200 pt-2 text-gray-700">
                <div className="flex justify-between">
                  <span>ရွှေရည် (Purity):</span>
                  <span className="font-bold">{PURITY_LABELS[tagItem.purity]?.mm || tagItem.purity}</span>
                </div>
                <div className="flex justify-between">
                  <span>အထည်ချိန် (Gross):</span>
                  <span className="font-bold">
                    {formatKPYMyanmar({ kyat: tagItem.weight_kyat, pae: tagItem.weight_pae, yway: tagItem.weight_yway })}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>ရွှေချိန်စင် (Net):</span>
                  <span>
                    {formatKPYMyanmar({ kyat: tagItem.net_weight_kyat, pae: tagItem.net_weight_pae, yway: tagItem.net_weight_yway })}
                  </span>
                </div>
                <div className="flex justify-between text-[#996515] font-extrabold pt-1 border-t border-gray-200">
                  <span>ခန့်မှန်းတန်ဖိုး:</span>
                  <span>{formatMMK(tagItem.selling_price_estimated)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setTagItem(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-white text-xs font-bold hover:bg-[#C5A059] flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'MM' ? 'ကတ်ပြား ပရင့်ထုတ်' : 'Print Tag'}</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
