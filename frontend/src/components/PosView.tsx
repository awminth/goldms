import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import {
  TransactionItem,
  GoldPurity,
  Customer,
  Transaction,
} from '../types/gold';
import {
  formatMMK,
  formatKPYMyanmar,
  kpyToYway,
  calculateNetWeight,
  estimateSellingPrice,
  calculateSaleLineBreakdown,
  generateInvoiceNo,
  PURITY_LABELS,
  gramsToKpy,
  kpyToGrams,
  KYAT_TO_GRAMS,
} from '../utils/goldCalculations';
import {
  ReceiptText,
  ShoppingBag,
  ArrowDownLeft,
  ArrowLeftRight,
  Search,
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  User,
  Sparkles,
  Barcode,
  X,
  LayoutGrid,
  List,
  Check,
} from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { groupInventoryProducts, type StockProductGroup } from '../utils/inventoryGrouping';

type PosMode = 'SALE' | 'PURCHASE' | 'EXCHANGE';

type Props = {
  /** When set, locks to one mode. When omitted, shows SALE / PURCHASE / EXCHANGE tabs. */
  mode?: PosMode;
};

export const PosView: React.FC<Props> = ({ mode }) => {
  const {
    inventory,
    customers,
    addCustomer,
    goldPrices,
    createTransaction,
    language,
    setSelectedVoucher,
    getLivePriceForPurity,
    getBuyPriceForPurity,
    masterCategories,
    shopSettings,
  } = useGoldShop();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;

  const [activeSubTab, setActiveSubTab] = useState<PosMode>(mode || 'SALE');

  useEffect(() => {
    if (mode) setActiveSubTab(mode);
  }, [mode]);

  const showModeTabs = !mode;

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customers[0] || null);
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [draftCustomerName, setDraftCustomerName] = useState('');
  const [draftCustomerPhone, setDraftCustomerPhone] = useState('');

  const [cartItems, setCartItems] = useState<TransactionItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [stockCategory, setStockCategory] = useState<string>('ALL');
  const [stockView, setStockView] = useState<'grid' | 'list'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'KPAY' | 'WAVEPAY' | 'BANK_TRANSFER' | 'CARD'>('CASH');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [interestRate, setInterestRate] = useState(0);

  const cartIds = useMemo(
    () => new Set(cartItems.map((c) => c.item_id).filter(Boolean) as string[]),
    [cartItems]
  );

  const inStockItems = useMemo(
    () => inventory.filter((i) => i.status === 'IN_STOCK'),
    [inventory]
  );

  const isThaiItem = (i: { item_type?: string; purity?: string }) =>
    i.item_type === 'THAI_GOLD' || i.purity === 'THAI_GOLD';

  const filteredStock = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    return inStockItems.filter((i) => {
      if (stockCategory === 'THAI_GOLD') {
        if (!isThaiItem(i)) return false;
      } else if (stockCategory !== 'ALL') {
        if (isThaiItem(i) || i.category !== stockCategory) return false;
      }
      if (!q) return true;
      return (
        i.barcode.toLowerCase().includes(q) ||
        i.name_mm.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    });
  }, [inStockItems, inventorySearch, stockCategory]);

  const stockFilterChips = useMemo(() => {
    const myanmarCats = masterCategories.filter(
      (c) => c.is_active && (c.category_group === 'PRODUCT' || !c.category_group)
    );
    const fromStock = Array.from(
      new Set(
        inStockItems.filter((i) => !isThaiItem(i)).map((i) => i.category)
      )
    );
    const codes =
      myanmarCats.length > 0
        ? myanmarCats.map((c) => ({
            id: c.code,
            labelMM: c.name_mm,
            labelEN: c.name_en,
          }))
        : fromStock.map((code) => ({ id: code, labelMM: code, labelEN: code }));

    return [
      { id: 'ALL', labelMM: 'အားလုံး', labelEN: 'All' },
      { id: 'THAI_GOLD', labelMM: 'ထိုင်းရွှေ', labelEN: 'Thai Gold' },
      ...codes,
    ];
  }, [masterCategories, inStockItems]);

  const stockGrouped = useMemo(() => {
    const toProductGroups = (items: typeof filteredStock) =>
      groupInventoryProducts(items).filter((g) => g.remainingQty > 0);

    if (stockCategory !== 'ALL') {
      return [{ key: stockCategory, label: '', products: toProductGroups(filteredStock) }];
    }
    const thai = filteredStock.filter(isThaiItem);
    const byCat = new Map<string, typeof filteredStock>();
    for (const i of filteredStock.filter((x) => !isThaiItem(x))) {
      const list = byCat.get(i.category) || [];
      list.push(i);
      byCat.set(i.category, list);
    }
    const groups: { key: string; label: string; products: StockProductGroup[] }[] = [];
    if (thai.length) {
      groups.push({
        key: 'THAI_GOLD',
        label: language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold',
        products: toProductGroups(thai),
      });
    }
    for (const chip of stockFilterChips) {
      if (chip.id === 'ALL' || chip.id === 'THAI_GOLD') continue;
      const items = byCat.get(chip.id);
      if (items?.length) {
        groups.push({
          key: chip.id,
          label: language === 'MM' ? chip.labelMM : chip.labelEN,
          products: toProductGroups(items),
        });
      }
    }
    for (const [code, items] of byCat) {
      if (!groups.some((g) => g.key === code)) {
        groups.push({ key: code, label: code, products: toProductGroups(items) });
      }
    }
    return groups;
  }, [filteredStock, stockCategory, stockFilterChips, language]);

  const stockProductCount = useMemo(
    () => stockGrouped.reduce((n, g) => n + g.products.length, 0),
    [stockGrouped]
  );

  const stockPieceCount = useMemo(
    () => stockGrouped.reduce((n, g) => n + g.products.reduce((m, p) => m + p.remainingQty, 0), 0),
    [stockGrouped]
  );
  useEffect(() => {
    if (activeSubTab === 'SALE') searchInputRef.current?.focus();
  }, [activeSubTab]);

  const addItemFromInventory = (itemId: string) => {
    const inv = inventory.find((i) => i.id === itemId);
    if (!inv) return;
    if (cartItems.some((c) => c.item_id === inv.id)) {
      alert(language === 'MM' ? 'ဤပစ္စည်းသည် စာရင်းထဲတွင် ရောက်ရှိနေပြီးဖြစ်ပါသည်' : 'Item is already in cart');
      return;
    }
    const netKpy = { kyat: inv.net_weight_kyat, pae: inv.net_weight_pae, yway: inv.net_weight_yway };
    const gemKpy = {
      kyat: inv.gemstone_weight_kyat || 0,
      pae: inv.gemstone_weight_pae || 0,
      yway: inv.gemstone_weight_yway || 0,
    };
    const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
    const specificPrice = getLivePriceForPurity(inv.purity);
    const breakdown = calculateSaleLineBreakdown({
      purity: inv.purity,
      itemType: inv.item_type,
      netWeight: netKpy,
      thaiWeightUnit: inv.thai_weight_unit,
      craftsmanshipFee: inv.craftsmanship_fee,
      stonePrice: inv.stone_price || 0,
      pricePerKyat16Pe: pure16Price,
      specificSellPrice: specificPrice,
      thaiRatePerKyat: getLivePriceForPurity('THAI_GOLD'),
    });
    setCartItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        transaction_id: '',
        item_id: inv.id,
        item_name: inv.name_mm || inv.name,
        category: inv.category,
        weight: { kyat: inv.weight_kyat, pae: inv.weight_pae, yway: inv.weight_yway },
        gemstone_weight: gemKpy,
        net_weight: netKpy,
        purity: inv.purity,
        gold_price_snapshot: breakdown.effectivePricePerKyat,
        gold_amount: breakdown.goldAmount,
        craftsmanship_fee: breakdown.craftsmanshipFee,
        stone_price: breakdown.stonePrice,
        wastage_amount: 0,
        subtotal: breakdown.lineSubtotal,
        item_type: inv.item_type,
        thai_weight_unit: inv.thai_weight_unit,
      },
    ]);
    setInventorySearch('');
    searchInputRef.current?.focus();
  };

  const addProductFromGroup = (group: StockProductGroup) => {
    const next = group.inStockUnits.find((u) => !cartIds.has(u.id));
    if (!next) {
      alert(
        language === 'MM'
          ? 'ဤပစ္စည်း၏ စတော့အားလုံး ဘောင်ချာထဲ ရောက်ပြီးသားဖြစ်သည်'
          : 'All units of this product are already in the cart'
      );
      return;
    }
    addItemFromInventory(next.id);
  };

  const tryAddByBarcode = () => {
    const q = inventorySearch.trim();
    if (!q) return;
    const exact = inStockItems.find(
      (i) => i.barcode.toLowerCase() === q.toLowerCase() && !cartIds.has(i.id)
    );
    if (exact) {
      addItemFromInventory(exact.id);
      return;
    }
    if (filteredStock.length === 1 && !cartIds.has(filteredStock[0].id)) {
      addItemFromInventory(filteredStock[0].id);
    }
  };

  const removeCartItem = (id: string) => setCartItems(cartItems.filter((i) => i.id !== id));

  const updateCartLine = (
    id: string,
    patch: Partial<Pick<TransactionItem, 'gold_amount' | 'craftsmanship_fee' | 'stone_price' | 'wastage_amount'>>
  ) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        const gold = Number(next.gold_amount || 0);
        const craft = Number(next.craftsmanship_fee || 0);
        const stone = Number(next.stone_price || 0);
        const waste = Number(next.wastage_amount || 0);
        next.subtotal = Math.max(0, gold + craft + stone - waste);
        return next;
      })
    );
  };

  const totalGoldAmount = cartItems.reduce((sum, i) => sum + Number(i.gold_amount || 0), 0);
  const totalCraftsmanshipCart = cartItems.reduce((sum, i) => sum + i.craftsmanship_fee, 0);
  const totalStoneCart = cartItems.reduce((sum, i) => sum + Number(i.stone_price || 0), 0);
  const totalWastageCart = cartItems.reduce((sum, i) => sum + Number(i.wastage_amount || 0), 0);
  const subtotalCart = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
  const totalSaleAmount = Math.max(0, subtotalCart - Number(discountAmount || 0));
  const totalCartGrams = cartItems.reduce((sum, i) => {
    if (i.item_type === 'THAI_GOLD' && i.thai_weight_unit) return sum + Number(i.thai_weight_unit);
    return sum + kpyToGrams(i.net_weight, kyatToGrams);
  }, 0);
  const thaiQtyByGram = cartItems
    .filter((i) => i.item_type === 'THAI_GOLD')
    .reduce<Record<string, number>>((acc, i) => {
      const key = String(i.thai_weight_unit || 0);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const effectivePaidAmount = amountPaidInput === '' ? totalSaleAmount : Number(amountPaidInput);
  const remainingCreditAmount = Math.max(0, totalSaleAmount - effectivePaidAmount);
  const monthlyInterestPreview = Math.round((remainingCreditAmount * Number(interestRate || 0)) / 100);

  const handleCompleteSale = async () => {
    if (cartItems.length === 0) {
      alert(language === 'MM' ? 'ရောင်းချမည့် ပစ္စည်းထည့်သွင်းပါ' : 'Please add items to sell');
      return;
    }
    if (remainingCreditAmount > 0 && !selectedCustomer && !(isNewCustomer && customCustomerName)) {
      alert(
        language === 'MM'
          ? 'အကြွေး / အရစ်ကျအတွက် ဖောက်သည် ရွေးပါ'
          : 'Select a customer for credit / installment'
      );
      return;
    }
    let customerId = selectedCustomer?.id || '';
    let customerName = selectedCustomer?.name || 'ဧည့်သည်';
    let customerPhone = selectedCustomer?.phone || '';
    if (isNewCustomer && customCustomerName) {
      const created = await addCustomer(customCustomerName, customCustomerPhone, 'Walk-in');
      customerId = created.id;
      customerName = created.name;
      customerPhone = created.phone;
    }
    const newTxn = await createTransaction({
      invoice_no: generateInvoiceNo('INV'),
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      transaction_type: 'SALE',
      items: cartItems,
      gold_price_snapshot: cartItems[0]?.gold_price_snapshot || 5750000,
      craftsmanship_total: totalCraftsmanshipCart,
      stone_total: totalStoneCart,
      discount_amount: Number(discountAmount || 0),
      tax_amount: 0,
      total_amount: totalSaleAmount,
      paid_amount: effectivePaidAmount,
      remaining_amount: remainingCreditAmount,
      payment_method: paymentMethod,
      interest_rate: remainingCreditAmount > 0 ? Number(interestRate || 0) : 0,
      credit_due_date: remainingCreditAmount > 0 ? creditDueDate : undefined,
      is_installment: remainingCreditAmount > 0 && (isInstallment || Number(interestRate || 0) > 0),
      notes: saleNotes,
    } as Omit<Transaction, 'id' | 'created_at'>);
    setCartItems([]);
    setDiscountAmount(0);
    setAmountPaidInput('');
    setSaleNotes('');
    setIsInstallment(false);
    setInterestRate(0);
    setIsNewCustomer(false);
    setCustomCustomerName('');
    setCustomCustomerPhone('');
    setSelectedVoucher(newTxn);
  };


  // -------------------------------------------------------------
  // PURCHASE STATE (အဝယ် - ရွှေဟောင်းဝယ်ယူခြင်း)
  // -------------------------------------------------------------
  const [purCustomerName, setPurCustomerName] = useState('ဦးဇော်လင်း');
  const [purCustomerPhone, setPurCustomerPhone] = useState('09-445566778');
  const [purItemName, setPurItemName] = useState('ရွှေဟောင်းဆွဲကြိုး (အလဲ/အဝယ်)');
  const [purPurity, setPurPurity] = useState<GoldPurity>('PE15A');

  const [purGrossKyat, setPurGrossKyat] = useState<number>(1);
  const [purGrossPae, setPurGrossPae] = useState<number>(0);
  const [purGrossYway, setPurGrossYway] = useState<number>(0);
  const [purGrossGrams, setPurGrossGrams] = useState<number>(KYAT_TO_GRAMS);

  const [purDeductPae, setPurDeductPae] = useState<number>(0);
  const [purDeductYway, setPurDeductYway] = useState<number>(4); // Default 4 Yway deduction

  const [purPaymentMethod, setPurPaymentMethod] = useState<'CASH' | 'KPAY' | 'WAVEPAY' | 'BANK_TRANSFER'>('CASH');
  const [purNotes, setPurNotes] = useState('အလျော့တွက် ၄ ရွေး နုတ်ပြီး ပေါက်ဈေးအတိုင်း ရှင်းပေးသည်။');
  const [purAddToStock, setPurAddToStock] = useState(true);
  const [purManualAmount, setPurManualAmount] = useState<string>('');

  // Purchase Net Calculation
  const purNetKpy = calculateNetWeight(
    { kyat: purGrossKyat, pae: purGrossPae, yway: purGrossYway },
    purDeductPae,
    purDeductYway
  );

  const purBuyRate = getBuyPriceForPurity(purPurity);

  const purNetYway = kpyToYway(purNetKpy.kyat, purNetKpy.pae, purNetKpy.yway);
  const purCalcPayout = Math.round((purNetYway / 128) * purBuyRate);
  const purTotalPayout =
    purManualAmount === '' ? purCalcPayout : Math.max(0, Number(purManualAmount) || 0);

  const applyPurGrossFromGrams = (grams: number) => {
    setPurGrossGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setPurGrossKyat(kpy.kyat);
    setPurGrossPae(kpy.pae);
    setPurGrossYway(kpy.yway);
  };

  const applyPurGrossFromKpy = (kyat: number, pae: number, yway: number) => {
    setPurGrossKyat(kyat);
    setPurGrossPae(pae);
    setPurGrossYway(yway);
    setPurGrossGrams(kpyToGrams({ kyat, pae, yway }, kyatToGrams));
  };

  const handleCompletePurchase = async () => {
    if (purTotalPayout <= 0) return;

    const newTxn = await createTransaction({
      invoice_no: generateInvoiceNo('PUR'),
      customer_id: '',
      customer_name: purCustomerName,
      customer_phone: purCustomerPhone,
      transaction_type: 'PURCHASE',
      items: [
        {
          id: `item-pur-${Date.now()}`,
          transaction_id: '',
          item_name: purItemName,
          category: 'OLD_GOLD',
          weight: { kyat: purGrossKyat, pae: purGrossPae, yway: purGrossYway },
          net_weight: purNetKpy,
          purity: purPurity,
          gold_price_snapshot: purBuyRate,
          craftsmanship_fee: 0,
          subtotal: purTotalPayout,
          item_type: purPurity === 'THAI_GOLD' ? 'THAI_GOLD' : 'MYANMAR_GOLD',
        },
      ],
      gold_price_snapshot: purBuyRate,
      craftsmanship_total: 0,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: purTotalPayout,
      paid_amount: purTotalPayout,
      remaining_amount: 0,
      payment_method: purPaymentMethod as any,
      notes: purNotes,
      add_to_stock: purAddToStock,
    } as any);

    setSelectedVoucher(newTxn);
  };

  // -------------------------------------------------------------
  // EXCHANGE STATE (အလဲအလှယ်)
  // -------------------------------------------------------------
  const [excCustomerName, setExcCustomerName] = useState('');
  const [excCustomerPhone, setExcCustomerPhone] = useState('');
  const [excStockId, setExcStockId] = useState('');
  const [excTradeName, setExcTradeName] = useState('ရွှေဟောင်း အလဲ');
  const [excTradePurity, setExcTradePurity] = useState<GoldPurity>('PE15A');
  const [excGrossKyat, setExcGrossKyat] = useState(0);
  const [excGrossPae, setExcGrossPae] = useState(0);
  const [excGrossYway, setExcGrossYway] = useState(0);
  const [excGrossGrams, setExcGrossGrams] = useState(0);
  const [excDeductPae, setExcDeductPae] = useState(0);
  const [excDeductYway, setExcDeductYway] = useState(4);
  const [excPaid, setExcPaid] = useState('');

  const applyExcGrossFromGrams = (grams: number) => {
    setExcGrossGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setExcGrossKyat(kpy.kyat);
    setExcGrossPae(kpy.pae);
    setExcGrossYway(kpy.yway);
  };

  const excTradeNet = calculateNetWeight(
    { kyat: excGrossKyat, pae: excGrossPae, yway: excGrossYway },
    excDeductPae,
    excDeductYway
  );
  const excBuyRate = getBuyPriceForPurity(excTradePurity);
  const excTradeCredit = Math.round((kpyToYway(excTradeNet.kyat, excTradeNet.pae, excTradeNet.yway) / 128) * excBuyRate);
  const excNewItem = inventory.find((i) => i.id === excStockId && i.status === 'IN_STOCK');
  const pure16 = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
  const excNewPrice = excNewItem
    ? estimateSellingPrice({
        purity: excNewItem.purity,
        itemType: excNewItem.item_type,
        netWeight: {
          kyat: excNewItem.net_weight_kyat,
          pae: excNewItem.net_weight_pae,
          yway: excNewItem.net_weight_yway,
        },
        thaiWeightUnit: excNewItem.thai_weight_unit,
        craftsmanshipFee: excNewItem.craftsmanship_fee,
        pricePerKyat16Pe: pure16,
        specificSellPrice: getLivePriceForPurity(excNewItem.purity),
        thaiRatePerKyat: getLivePriceForPurity('THAI_GOLD'),
      })
    : 0;
  const excNetDue = Math.max(0, excNewPrice - excTradeCredit);

  const handleCompleteExchange = async () => {
    if (!excNewItem || excNewPrice <= 0) return;
    const paid = excPaid !== '' ? Number(excPaid) : excNetDue;
    const txn = await createTransaction({
      invoice_no: generateInvoiceNo('EXC'),
      customer_id: '',
      customer_name: excCustomerName || 'ဧည့်သည်',
      customer_phone: excCustomerPhone,
      transaction_type: 'EXCHANGE',
      items: [
        {
          id: `exc-new-${Date.now()}`,
          transaction_id: '',
          item_id: excNewItem.id,
          item_name: excNewItem.name_mm || excNewItem.name,
          category: excNewItem.category,
          weight: {
            kyat: excNewItem.weight_kyat,
            pae: excNewItem.weight_pae,
            yway: excNewItem.weight_yway,
          },
          net_weight: {
            kyat: excNewItem.net_weight_kyat,
            pae: excNewItem.net_weight_pae,
            yway: excNewItem.net_weight_yway,
          },
          purity: excNewItem.purity,
          gold_price_snapshot: getLivePriceForPurity(excNewItem.purity),
          craftsmanship_fee: excNewItem.craftsmanship_fee,
          subtotal: excNewPrice,
          item_type: excNewItem.item_type,
          line_role: 'NEW_ITEM',
        } as any,
        {
          id: `exc-trade-${Date.now()}`,
          transaction_id: '',
          item_name: excTradeName,
          category: 'OLD_GOLD',
          weight: { kyat: excGrossKyat, pae: excGrossPae, yway: excGrossYway },
          net_weight: excTradeNet,
          purity: excTradePurity,
          gold_price_snapshot: excBuyRate,
          craftsmanship_fee: 0,
          subtotal: excTradeCredit,
          item_type: excTradePurity === 'THAI_GOLD' ? 'THAI_GOLD' : 'MYANMAR_GOLD',
          line_role: 'TRADE_IN',
        } as any,
      ],
      gold_price_snapshot: pure16,
      craftsmanship_total: excNewItem.craftsmanship_fee,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: excNetDue,
      paid_amount: paid,
      remaining_amount: Math.max(0, excNetDue - paid),
      payment_method: 'CASH',
      notes: 'အလဲအလှယ် (Exchange) — လက်ခ/အတိုးအတင် ပါဝင်သည်',
      add_to_stock: true,
      use_client_total: true,
    } as any);
    setSelectedVoucher(txn);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between bg-white dark:bg-[#1A1A1A] p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        {showModeTabs ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('SALE')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'SALE'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{language === 'MM' ? 'အရောင်းဘောင်ချာ' : 'Sales'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('PURCHASE')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'PURCHASE'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{language === 'MM' ? 'အဝယ်ဘောင်ချာ' : 'Purchase'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('EXCHANGE')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'EXCHANGE'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{language === 'MM' ? 'အလဲအလှယ်' : 'Exchange'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {activeSubTab === 'SALE' && <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />}
            {activeSubTab === 'PURCHASE' && <ArrowDownLeft className="w-5 h-5 text-blue-600" />}
            {activeSubTab === 'EXCHANGE' && <ArrowLeftRight className="w-5 h-5 text-emerald-600" />}
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {activeSubTab === 'SALE'
                ? language === 'MM'
                  ? 'အရောင်းဘောင်ချာ'
                  : 'Sales Voucher'
                : activeSubTab === 'PURCHASE'
                  ? language === 'MM'
                    ? 'အဝယ်ဘောင်ချာ'
                    : 'Purchase Voucher'
                  : language === 'MM'
                    ? 'အလဲအလှယ်'
                    : 'Exchange'}
            </h2>
          </div>
        )}
        <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-[#B8860B] dark:text-[#E5C158] bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{language === 'MM' ? 'ပေါက်ဈေး အလိုအလျောက်ချိတ်ဆက်ပြီး' : 'Live rates linked'}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SALES TAB — inventory-only selection + checkout */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'SALE' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[70vh]">
          {/* LEFT — wide inventory picker */}
          <section className="xl:col-span-8 flex flex-col rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Barcode className="w-5 h-5 text-[#D4AF37] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    {language === 'MM' ? 'ဆိုင်ရှိ ရွှေထည် ရွေးချယ်ရန်' : 'Select Stock Items'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {language === 'MM'
                      ? 'စတော့ရှိ ပစ္စည်းများသာ — ဘားကုဒ် / အမည်ဖြင့် ရှာဖွေပါ'
                      : 'In-stock only — search by barcode or name'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#FAF8F2] dark:bg-[#201D17] text-[#996515] dark:text-amber-300 border border-[#D4AF37]/25">
                {inStockItems.length} {language === 'MM' ? 'ထည်' : 'in stock'}
              </span>
            </div>

            <div className="px-4 sm:px-5 py-3 space-y-3 border-b border-gray-100 dark:border-gray-900">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        tryAddByBarcode();
                      }
                    }}
                    placeholder={
                      language === 'MM'
                        ? 'ဘားကုဒ် စကင် / အမည် ရိုက်ပြီး Enter…'
                        : 'Scan barcode / type name + Enter…'
                    }
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] dark:text-white font-medium focus:ring-2 focus:ring-[#D4AF37] focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 p-0.5">
                    <button
                      type="button"
                      onClick={() => setStockView('grid')}
                      className={`p-2 rounded-lg ${stockView === 'grid' ? 'bg-[#D4AF37] text-white' : 'text-gray-500'}`}
                      title="Grid"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockView('list')}
                      className={`p-2 rounded-lg ${stockView === 'list' ? 'bg-[#D4AF37] text-white' : 'text-gray-500'}`}
                      title="List"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stockFilterChips.map((chip) => {
                  const active = stockCategory === chip.id;
                  const count =
                    chip.id === 'ALL'
                      ? groupInventoryProducts(inStockItems).filter((g) => g.remainingQty > 0).length
                      : chip.id === 'THAI_GOLD'
                        ? groupInventoryProducts(inStockItems.filter(isThaiItem)).filter(
                            (g) => g.remainingQty > 0
                          ).length
                        : groupInventoryProducts(
                            inStockItems.filter((i) => !isThaiItem(i) && i.category === chip.id)
                          ).filter((g) => g.remainingQty > 0).length;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setStockCategory(chip.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        active
                          ? chip.id === 'THAI_GOLD'
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-[#D4AF37] text-white border-transparent'
                          : 'bg-white dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {language === 'MM' ? chip.labelMM : chip.labelEN}
                      <span className={`ml-1 ${active ? 'opacity-80' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500">
                {stockProductCount}{' '}
                {language === 'MM' ? 'ပစ္စည်း' : 'products'}
                {' · '}
                {stockPieceCount} {language === 'MM' ? 'ခု' : 'pcs'}
                {cartItems.length > 0
                  ? ` · ${cartItems.length} ${language === 'MM' ? 'ဘောင်ချာထဲ' : 'in cart'}`
                  : ''}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 max-h-[62vh]">
              {stockProductCount === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                  {language === 'MM' ? 'ပစ္စည်းမတွေ့ပါ' : 'No stock items found'}
                </div>
              ) : (
                <div className="space-y-5">
                  {stockGrouped.map((group) => (
                    <div key={group.key}>
                      {group.label && (
                        <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur py-1.5">
                          <span
                            className={`text-[11px] font-extrabold tracking-wide px-2 py-0.5 rounded-md ${
                              group.key === 'THAI_GOLD'
                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                : 'bg-[#D4AF37]/15 text-[#996515] dark:text-amber-300'
                            }`}
                          >
                            {group.label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {group.products.length}{' '}
                            {language === 'MM' ? 'ပစ္စည်း' : 'SKU'} ·{' '}
                            {group.products.reduce((n, p) => n + p.remainingQty, 0)}{' '}
                            {language === 'MM' ? 'ခု' : 'pcs'}
                          </span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                        </div>
                      )}
                      {stockView === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {group.products.map((product) => {
                            const item = product.sample;
                            const available = product.inStockUnits.filter((u) => !cartIds.has(u.id))
                              .length;
                            const soldOut = available <= 0;
                            return (
                              <button
                                key={product.key}
                                type="button"
                                disabled={soldOut}
                                onClick={() => addProductFromGroup(product)}
                                className={`text-left rounded-2xl border p-3.5 transition ${
                                  soldOut
                                    ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 opacity-70'
                                    : 'border-gray-200 dark:border-gray-800 bg-[#FAF8F2]/50 dark:bg-[#141414] hover:border-[#D4AF37]/50 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-[#D4AF37]/15 text-[#996515] dark:text-amber-300 border border-[#D4AF37]/25">
                                    Qty {product.remainingQty}
                                    {available < product.remainingQty ? ` · ${available} left` : ''}
                                  </span>
                                  {soldOut ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                      <Check className="w-3 h-3" />
                                      CART
                                    </span>
                                  ) : (
                                    <Plus className="w-4 h-4 text-[#D4AF37]" />
                                  )}
                                </div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
                                  {item.name_mm || item.name}
                                </div>
                                <div className="mt-1.5 text-[11px] text-gray-500 space-y-0.5">
                                  <div>
                                    {isThaiItem(item)
                                      ? language === 'MM'
                                        ? 'ထိုင်းရွှေ'
                                        : 'Thai Gold'
                                      : item.category}{' '}
                                    · {PURITY_LABELS[item.purity]?.mm || item.purity}
                                  </div>
                                  <div className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                                    {item.item_type === 'THAI_GOLD' && item.thai_weight_unit
                                      ? `${item.thai_weight_unit} g`
                                      : formatKPYMyanmar({
                                          kyat: item.net_weight_kyat,
                                          pae: item.net_weight_pae,
                                          yway: item.net_weight_yway,
                                        })}
                                  </div>
                                  <div className="font-mono font-bold text-[#996515] dark:text-amber-300">
                                    {formatMMK(item.selling_price_estimated)}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {group.products.map((product) => {
                            const item = product.sample;
                            const available = product.inStockUnits.filter((u) => !cartIds.has(u.id))
                              .length;
                            const soldOut = available <= 0;
                            return (
                              <button
                                key={product.key}
                                type="button"
                                disabled={soldOut}
                                onClick={() => addProductFromGroup(product)}
                                className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 transition ${
                                  soldOut
                                    ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 opacity-70'
                                    : 'border-gray-200 dark:border-gray-800 hover:border-[#D4AF37]/40'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#D4AF37]/15 text-[#996515]">
                                      Qty {product.remainingQty}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                      {item.name_mm || item.name}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    {isThaiItem(item)
                                      ? language === 'MM'
                                        ? 'ထိုင်းရွှေ'
                                        : 'Thai Gold'
                                      : item.category}{' '}
                                    · {PURITY_LABELS[item.purity]?.mm || item.purity} ·{' '}
                                    {item.item_type === 'THAI_GOLD' && item.thai_weight_unit
                                      ? `${item.thai_weight_unit} g`
                                      : formatKPYMyanmar({
                                          kyat: item.net_weight_kyat,
                                          pae: item.net_weight_pae,
                                          yway: item.net_weight_yway,
                                        })}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono text-xs font-bold text-[#996515] dark:text-amber-300">
                                    {formatMMK(item.selling_price_estimated)}
                                  </div>
                                  {soldOut ? (
                                    <span className="text-[10px] font-bold text-emerald-600">CART</span>
                                  ) : (
                                    <Plus className="w-4 h-4 text-[#D4AF37] ml-auto" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT — cart & checkout */}
          <section className="xl:col-span-4 flex flex-col rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden xl:sticky xl:top-20 xl:self-start max-h-[85vh]">
            <div className="px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-[#D4AF37]" />
                {language === 'MM' ? 'ဘောင်ချာ / ငွေရှင်း' : 'Invoice & Checkout'}
              </h3>
              <span className="font-mono text-xs font-bold text-[#D4AF37]">
                {cartItems.length} {language === 'MM' ? 'ထည်' : 'items'}
              </span>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="p-3 rounded-xl bg-[#FAF8F2] dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {language === 'MM' ? 'ဖောက်သည်' : 'Customer'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftCustomerName('');
                      setDraftCustomerPhone('');
                      setShowNewCustomerModal(true);
                    }}
                    className="text-[11px] text-[#B8860B] dark:text-[#FFD700] underline font-semibold"
                  >
                    {language === 'MM' ? '+ အသစ်' : '+ New'}
                  </button>
                </div>
                {isNewCustomer ? (
                  <div className="flex items-center justify-between gap-2 text-xs px-2.5 py-2 rounded-lg bg-white dark:bg-[#1A1A1A] border border-[#D4AF37]/30">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{customCustomerName}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{customCustomerPhone || '—'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewCustomer(false);
                        setCustomCustomerName('');
                        setCustomCustomerPhone('');
                      }}
                      className="text-[10px] font-semibold text-rose-600"
                    >
                      {language === 'MM' ? 'ဖယ်' : 'Clear'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const c = customers.find((cust) => cust.id === e.target.value);
                      if (c) setSelectedCustomer(c);
                    }}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-medium"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-900 max-h-52 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 px-3">
                    {language === 'MM'
                      ? 'ဘယ်ဘက်မှ စတော့ပစ္စည်း ရွေးထည့်ပါ'
                      : 'Select stock items from the left'}
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="px-3 py-2.5 space-y-1.5 text-xs border-b border-gray-100 dark:border-gray-900 last:border-0">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-gray-900 dark:text-white">{item.item_name}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {item.item_type === 'THAI_GOLD' && item.thai_weight_unit
                              ? `${item.thai_weight_unit} g`
                              : formatKPYMyanmar(item.net_weight)}{' '}
                            · {item.item_type === 'THAI_GOLD' ? 'Thai' : 'MM'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="text-gray-400 hover:text-rose-600 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-gray-400">ရွှေချိန်တန်ဖိုး</label>
                          <input
                            type="number"
                            value={Number(item.gold_amount || 0)}
                            onChange={(e) => updateCartLine(item.id, { gold_amount: Number(e.target.value) })}
                            className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">လက်ခ</label>
                          <input
                            type="number"
                            value={Number(item.craftsmanship_fee || 0)}
                            onChange={(e) =>
                              updateCartLine(item.id, { craftsmanship_fee: Number(e.target.value) })
                            }
                            className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">ကျောက်ဖိုး</label>
                          <input
                            type="number"
                            value={Number(item.stone_price || 0)}
                            onChange={(e) => updateCartLine(item.id, { stone_price: Number(e.target.value) })}
                            className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">အလျော့တွက်</label>
                          <input
                            type="number"
                            value={Number(item.wastage_amount || 0)}
                            onChange={(e) =>
                              updateCartLine(item.id, { wastage_amount: Number(e.target.value) })
                            }
                            className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-gray-900 dark:text-amber-300">
                        {formatMMK(item.subtotal)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 text-xs pt-1">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div className="text-gray-500">Type / Qty</div>
                  <div className="text-right font-bold">
                    {cartItems.length} pcs
                    {Object.keys(thaiQtyByGram).length > 0 && (
                      <span className="block font-normal text-gray-500">
                        Thai:{' '}
                        {Object.entries(thaiQtyByGram)
                          .map(([g, q]) => `${g}g×${q}`)
                          .join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500">{language === 'MM' ? 'Gram စုစုပေါင်း' : 'Total grams'}</div>
                  <div className="text-right font-mono font-bold">{totalCartGrams.toFixed(3)} g</div>
                  <div className="text-gray-500">{language === 'MM' ? 'ငွေစုစုပေါင်း' : 'Total amount'}</div>
                  <div className="text-right font-mono font-bold">{formatMMK(totalSaleAmount)}</div>
                </div>
                {/* Voucher-style calculation table */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-[#FAF8F2] dark:bg-[#1E1B15] text-gray-600 dark:text-gray-300">
                        <th className="text-left px-2 py-1.5 font-semibold">{language === 'MM' ? 'အကြောင်းအရာ' : 'Line'}</th>
                        <th className="text-right px-2 py-1.5 font-semibold">{language === 'MM' ? 'သင့်ငွေ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'ရွှေချိန်တန်ဖိုး' : 'Gold value'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold">{formatMMK(totalGoldAmount)}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'လက်ခ' : 'Craft fee'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold">{formatMMK(totalCraftsmanshipCart)}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'ကျောက်ဖိုး' : 'Stone price'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold">{formatMMK(totalStoneCart)}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'အလျော့တွက်' : 'Wastage'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-600">
                          −{formatMMK(totalWastageCart)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'လျော့ငွေ' : 'Discount'}</td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            step={5000}
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(Number(e.target.value))}
                            className="w-24 ml-auto block px-2 py-1 text-right font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </td>
                      </tr>
                      <tr className="bg-amber-50/60 dark:bg-amber-950/20">
                        <td className="px-2 py-2 font-extrabold text-gray-900 dark:text-amber-300">
                          {language === 'MM' ? 'ကျသင့်ငွေ' : 'Net payable'}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-extrabold text-gray-900 dark:text-amber-300">
                          {formatMMK(totalSaleAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    {language === 'MM' ? 'ငွေပေးချေမှု' : 'Payment'}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    {(['CASH', 'KPAY', 'WAVEPAY', 'BANK_TRANSFER', 'CARD'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-1.5 rounded-lg font-bold border ${
                          paymentMethod === m
                            ? 'bg-[#D4AF37] text-white border-[#C5A059]'
                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                      {language === 'MM' ? 'လက်ခံငွေ' : 'Paid'}
                    </label>
                    <input
                      type="number"
                      placeholder={String(totalSaleAmount)}
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                      {language === 'MM' ? 'ကျန်ငွေ' : 'Balance'}
                    </label>
                    <div className="px-2 py-1.5 text-xs font-mono font-bold rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300">
                      {formatMMK(remainingCreditAmount)}
                    </div>
                  </div>
                </div>

                {remainingCreditAmount > 0 && (
                  <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 dark:text-amber-300">
                      <input
                        type="checkbox"
                        checked={isInstallment || interestRate > 0}
                        onChange={(e) => setIsInstallment(e.target.checked)}
                      />
                      {language === 'MM' ? 'အရစ်ကျ / အကြွေး စာရင်းသွင်းမည်' : 'Record as installment / credit'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">
                          {language === 'MM' ? 'သတ်မှတ်ရက်' : 'Due date'}
                        </label>
                        <input
                          type="date"
                          value={creditDueDate}
                          onChange={(e) => setCreditDueDate(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">
                          {language === 'MM' ? 'အတိုးနှုန်း %' : 'Interest %'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={interestRate}
                          onChange={(e) => {
                            setInterestRate(Number(e.target.value));
                            if (Number(e.target.value) > 0) setIsInstallment(true);
                          }}
                          className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212]"
                        />
                      </div>
                    </div>
                    {interestRate > 0 && (
                      <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold">
                        {language === 'MM' ? 'လစဉ်အတိုး ခန့်မှန်း:' : 'Est. monthly interest:'}{' '}
                        {formatMMK(monthlyInterestPreview)}
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  rows={2}
                  placeholder={language === 'MM' ? 'မှတ်ချက် (optional)' : 'Notes (optional)'}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => void handleCompleteSale()}
                disabled={cartItems.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#C5A059] to-[#996515] disabled:opacity-40 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                {language === 'MM' ? 'အရောင်းပြီးစီး / ဘောင်ချာ' : 'Complete Sale & Print'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PURCHASE TAB (အဝယ် - ရွှေဟောင်းဝယ်ယူခြင်း) */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'PURCHASE' && (
        <div className="max-w-3xl mx-auto bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
          
          <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2">
              <ArrowDownLeft className="w-5 h-5 text-blue-600" />
              <span>{language === 'MM' ? 'ဧည့်သည်ထံမှ ရွှေပြန်လည်ဝယ်ယူခြင်း (Gold Buyback)' : 'Customer Gold Purchase / Buyback'}</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {language === 'MM'
                ? 'အလျော့တွက်၊ ပန်းထိန်း နုတ်ပယ်ပြီး ယနေ့အဝယ်ပေါက်ဈေးအတိုင်း တန်ဖိုးရှင်းတွက်ချက်မှု'
                : 'Automated weight deductions & payout calculation based on daily live buyback rate'}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            
            {/* Customer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ရောင်းချသူ အမည် (Customer Name):' : 'Seller Name:'}
                </label>
                <input
                  type="text"
                  value={purCustomerName}
                  onChange={(e) => setPurCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ဖုန်းနံပါတ် (Phone):' : 'Phone:'}
                </label>
                <input
                  type="text"
                  value={purCustomerPhone}
                  onChange={(e) => setPurCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>
            </div>

            {/* Item & Purity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ပစ္စည်းဖော်ပြချက်:' : 'Item Description:'}
                </label>
                <input
                  type="text"
                  value={purItemName}
                  onChange={(e) => setPurItemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'MM' ? 'ရွှေရည် (Purity Quality):' : 'Purity Quality:'}
                </label>
                <select
                  value={purPurity}
                  onChange={(e) => setPurPurity(e.target.value as GoldPurity)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-bold"
                >
                  {Object.entries(PURITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {language === 'MM' ? v.mm : v.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Weights & Deductions Box */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {language === 'MM' ? '၁။ အထည်ချိန် (Gram / ကျပ် / ပဲ / ရွေး):' : '1. Gross Weight:'}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-gray-400 block">Gram</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={purGrossGrams}
                    onChange={(e) => applyPurGrossFromGrams(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A] dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block">ကျပ်</label>
                  <input
                    type="number"
                    min="0"
                    value={purGrossKyat}
                    onChange={(e) =>
                      applyPurGrossFromKpy(Number(e.target.value), purGrossPae, purGrossYway)
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block">ပဲ</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={purGrossPae}
                    onChange={(e) =>
                      applyPurGrossFromKpy(purGrossKyat, Number(e.target.value), purGrossYway)
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block">ရွေး</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={purGrossYway}
                    onChange={(e) =>
                      applyPurGrossFromKpy(purGrossKyat, purGrossPae, Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                  />
                </div>
              </div>

              {/* Deductions */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                  {language === 'MM' ? '၂။ နုတ်ပယ်ချက် (အလျော့တွက်/ပန်းထိန်း):' : '2. Deductions:'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400">ပဲ နုတ်ချက် (Pae):</span>
                    <input
                      type="number"
                      min="0"
                      value={purDeductPae}
                      onChange={(e) => setPurDeductPae(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">ရွေး နုတ်ချက် (Yway):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={purDeductYway}
                      onChange={(e) => setPurDeductYway(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Net weight & rate preview */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex justify-between items-center text-xs">
                <div>
                  <span className="text-blue-700 dark:text-blue-300 font-semibold block">
                    {language === 'MM' ? 'အဝယ် ရွှေချိန်စင် (Net Weight):' : 'Net Buyback Weight:'}
                  </span>
                  <span className="text-sm font-extrabold text-blue-900 dark:text-blue-200">
                    {formatKPYMyanmar(purNetKpy)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 dark:text-gray-400 text-[11px] block">
                    {language === 'MM' ? 'ယနေ့အဝယ်ပေါက်ဈေး:' : 'Buyback Rate:'}
                  </span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {formatMMK(purBuyRate)}
                  </span>
                </div>
              </div>

            </div>

            {/* Payout & Payment Method */}
            <div className="p-4 rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/30 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1 w-full">
                  <span className="text-xs text-[#B8860B] dark:text-[#E5C158] font-bold block mb-1">
                    {language === 'MM' ? 'ထုတ်ပေးငွေ (manual ရိုက်နိုင်):' : 'Payout amount (editable):'}
                  </span>
                  <input
                    type="number"
                    value={purManualAmount === '' ? purCalcPayout : purManualAmount}
                    onChange={(e) => setPurManualAmount(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 text-xl font-extrabold font-mono rounded-xl border border-[#D4AF37]/40 bg-white dark:bg-[#121212] text-[#996515] dark:text-amber-300"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    {language === 'MM' ? `တွက်ချက် = ${formatMMK(purCalcPayout)}` : `Calculated = ${formatMMK(purCalcPayout)}`}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {(['CASH', 'KPAY', 'WAVEPAY', 'BANK_TRANSFER'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPurPaymentMethod(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        purPaymentMethod === m
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                  {language === 'MM' ? 'မှတ်ချက်' : 'Notes'}
                </label>
                <textarea
                  value={purNotes}
                  onChange={(e) => setPurNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
              <div className="text-[11px] text-gray-500 flex flex-wrap gap-3">
                <span>Type: {purPurity === 'THAI_GOLD' ? 'Thai' : 'Myanmar'}</span>
                <span>Gram: {kpyToGrams(purNetKpy, kyatToGrams).toFixed(3)} g</span>
                <span>Qty: 1</span>
                <span>Amount: {formatMMK(purTotalPayout)}</span>
              </div>
            </div>

            <button
              onClick={handleCompletePurchase}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'MM' ? 'အဝယ်ဘောင်ချာ ထုတ်ယူပြီး ငွေရှင်းမည်' : 'Complete Buyback & Print Voucher'}</span>
            </button>

            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={purAddToStock}
                onChange={(e) => setPurAddToStock(e.target.checked)}
                className="rounded border-gray-300"
              />
              {language === 'MM'
                ? 'ဝယ်ယူသောရွှေကို စတော့ထဲ ထည့်မည် (ဘားကုဒ်အလိုအလျောက်)'
                : 'Add purchased gold into inventory (auto barcode)'}
            </label>

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. EXCHANGE TAB */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'EXCHANGE' && (
        <div className="max-w-3xl mx-auto bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
              {language === 'MM' ? 'ပစ္စည်းအလဲအလှယ် (Exchange)' : 'Gold Exchange / Trade-in'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {language === 'MM'
                ? 'အဟောင်းဝယ်ဈေးနှုတ်ပြီး အသစ်ရောင်းဈေး (လက်ခပါ) ကျန်ငွေ ရှင်းတွက်သည်'
                : 'Net due = new item live sell price − trade-in buyback credit'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder={language === 'MM' ? 'ဧည့်သည်အမည်' : 'Customer name'}
              value={excCustomerName}
              onChange={(e) => setExcCustomerName(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
            />
            <input
              type="text"
              placeholder={language === 'MM' ? 'ဖုန်း' : 'Phone'}
              value={excCustomerPhone}
              onChange={(e) => setExcCustomerPhone(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              {language === 'MM' ? 'အသစ်ရွေးမည့် စတော့ပစ္စည်း' : 'New stock item'}
            </label>
            <select
              value={excStockId}
              onChange={(e) => setExcStockId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-medium"
            >
              <option value="">—</option>
              {inventory
                .filter((i) => i.status === 'IN_STOCK')
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.barcode} · {i.name_mm || i.name} · {formatMMK(i.selling_price_estimated)}
                  </option>
                ))}
            </select>
            {excNewItem && (
              <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-400 font-mono">
                {language === 'MM' ? 'အသစ်ဈေး (live):' : 'New item (live):'} {formatMMK(excNewPrice)}
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-gray-800 space-y-2">
            <div className="text-xs font-bold">{language === 'MM' ? 'အဟောင်းအလဲ (Trade-in)' : 'Trade-in gold'}</div>
            <input
              type="text"
              value={excTradeName}
              onChange={(e) => setExcTradeName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
            />
            <select
              value={excTradePurity}
              onChange={(e) => setExcTradePurity(e.target.value as GoldPurity)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
            >
              {Object.entries(PURITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {language === 'MM' ? v.mm : v.en}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="number"
                min={0}
                step={0.001}
                value={excGrossGrams}
                onChange={(e) => applyExcGrossFromGrams(Number(e.target.value))}
                placeholder="Gram"
                className="px-2 py-1.5 text-xs rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
              />
              <input
                type="number"
                min={0}
                value={excGrossKyat}
                onChange={(e) => {
                  const k = Number(e.target.value);
                  setExcGrossKyat(k);
                  setExcGrossGrams(kpyToGrams({ kyat: k, pae: excGrossPae, yway: excGrossYway }, kyatToGrams));
                }}
                placeholder="ကျပ်"
                className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
              />
              <input
                type="number"
                min={0}
                value={excGrossPae}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setExcGrossPae(p);
                  setExcGrossGrams(kpyToGrams({ kyat: excGrossKyat, pae: p, yway: excGrossYway }, kyatToGrams));
                }}
                placeholder="ပဲ"
                className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
              />
              <input
                type="number"
                min={0}
                value={excGrossYway}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setExcGrossYway(y);
                  setExcGrossGrams(kpyToGrams({ kyat: excGrossKyat, pae: excGrossPae, yway: y }, kyatToGrams));
                }}
                placeholder="ရွေး"
                className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} value={excDeductPae} onChange={(e) => setExcDeductPae(Number(e.target.value))} placeholder="ပန်းထိန်း ပဲ" className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
              <input type="number" min={0} value={excDeductYway} onChange={(e) => setExcDeductYway(Number(e.target.value))} placeholder="အမွှတ် ရွေး" className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]" />
            </div>
            <p className="text-xs font-mono text-blue-700 dark:text-blue-300">
              {language === 'MM' ? 'အဟောင်းခရက်ဒစ်:' : 'Trade credit:'} {formatMMK(excTradeCredit)} · net {formatKPYMyanmar(excTradeNet)}
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              {language === 'MM' ? 'ဧည့်သည်ပေးရမည့်ကျန်ငွေ' : 'Customer net due'}
            </span>
            <span className="text-xl font-mono font-extrabold text-emerald-700 dark:text-emerald-300">{formatMMK(excNetDue)}</span>
          </div>

          <input
            type="number"
            min={0}
            value={excPaid}
            onChange={(e) => setExcPaid(e.target.value)}
            placeholder={language === 'MM' ? 'ပေးသွင်းငွေ (အလွတ် = ကျန်ငွေအပြည့်)' : 'Amount paid (blank = full due)'}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
          />

          <button
            type="button"
            onClick={() => void handleCompleteExchange()}
            disabled={!excNewItem}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {language === 'MM' ? 'အလဲအလှယ် ပြီးစီးမည်' : 'Complete Exchange'}
          </button>
        </div>
      )}

      {showNewCustomerModal && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#D4AF37]" />
                {language === 'MM' ? 'ဖောက်သည်အသစ် ထည့်ရန်' : 'Add New Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                  {language === 'MM' ? 'အမည် *' : 'Name *'}
                </label>
                <input
                  value={draftCustomerName}
                  onChange={(e) => setDraftCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                  {language === 'MM' ? 'ဖုန်း' : 'Phone'}
                </label>
                <input
                  value={draftCustomerPhone}
                  onChange={(e) => setDraftCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!draftCustomerName.trim()) return;
                  setCustomCustomerName(draftCustomerName.trim());
                  setCustomCustomerPhone(draftCustomerPhone.trim());
                  setIsNewCustomer(true);
                  setShowNewCustomerModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold"
              >
                {language === 'MM' ? 'အတည်ပြု' : 'Confirm'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
