import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import {
  TransactionItem,
  GoldPurity,
  Customer,
  Transaction,
  InventoryItem,
} from '../types/gold';
import {
  formatMMK,
  formatBaht,
  formatKPYMyanmar,
  kpyToYway,
  calculateNetWeight,
  calculateNetFromParts,
  estimateSellingPrice,
  calculateSaleLineBreakdown,
  calculateThaiGoldPrice,
  generateInvoiceNo,
  PURITY_LABELS,
  gramsToKpy,
  kpyToGrams,
  KYAT_TO_GRAMS,
  bahtToMmk,
  mmkToBaht,
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
  PackageMinus,
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
import { NumberInput } from './NumberInput';

type PosMode = 'SALE' | 'PURCHASE' | 'EXCHANGE' | 'SHOP_OUT';

type Props = {
  /** When set, locks to one mode. When omitted, shows SALE / PURCHASE / EXCHANGE tabs. */
  mode?: PosMode;
};

type ThaiSaleCurrency = 'MMK' | 'BAHT';

type ThaiLineAmounts = {
  gold_amount: number;
  craftsmanship_fee: number;
  stone_price: number;
  wastage_amount: number;
  subtotal: number;
  gold_price_snapshot: number;
};

function thaiFxRates(shopSettings?: {
  thai_gold_baht?: number;
  baht_to_mmk_buy?: number;
  baht_to_mmk_sell?: number;
}) {
  return {
    thaiBahtRate: shopSettings?.thai_gold_baht || 65000,
    buyRate: shopSettings?.baht_to_mmk_buy || 755,
    sellRate: shopSettings?.baht_to_mmk_sell || 765,
  };
}

/** Live Thai line in Baht or MMK using Header FX formula (rate / 100000). */
function buildThaiSaleLine(
  inv: Pick<
    InventoryItem,
    | 'thai_weight_unit'
    | 'craftsmanship_fee'
    | 'craftsmanship_profit_fee'
    | 'stone_price'
    | 'stone_profit_price'
  >,
  currency: ThaiSaleCurrency,
  shopSettings?: {
    thai_gold_baht?: number;
    baht_to_mmk_buy?: number;
    baht_to_mmk_sell?: number;
  }
): ThaiLineAmounts {
  const { thaiBahtRate, buyRate, sellRate } = thaiFxRates(shopSettings);
  const grams = Number(inv.thai_weight_unit || 0);
  const craftMmk =
    Number(inv.craftsmanship_fee || 0) + Number(inv.craftsmanship_profit_fee || 0);
  // Inventory saved Baht→MMK with sell rate — reverse MMK→Baht uses BUY rate
  const craftBaht = mmkToBaht(craftMmk, buyRate);
  const baht = calculateThaiGoldPrice(grams, thaiBahtRate, 0);

  if (currency === 'BAHT') {
    const gold = baht.baseGoldPrice;
    const craft = Number(craftBaht.toFixed(2));
    return {
      gold_amount: gold,
      craftsmanship_fee: craft,
      stone_price: 0,
      wastage_amount: 0,
      subtotal: Math.max(0, gold + craft),
      gold_price_snapshot: thaiBahtRate,
    };
  }

  // Baht → MMK uses SELL rate
  const goldMmk = Math.round(bahtToMmk(baht.baseGoldPrice, sellRate));
  return {
    gold_amount: goldMmk,
    craftsmanship_fee: craftMmk,
    stone_price: 0,
    wastage_amount: 0,
    subtotal: Math.max(0, goldMmk + craftMmk),
    gold_price_snapshot: Math.round(bahtToMmk(thaiBahtRate, sellRate)),
  };
}

function thaiDisplayPrices(
  inv: InventoryItem,
  shopSettings?: {
    thai_gold_baht?: number;
    baht_to_mmk_buy?: number;
    baht_to_mmk_sell?: number;
  }
) {
  const bahtLine = buildThaiSaleLine(inv, 'BAHT', shopSettings);
  const mmkLine = buildThaiSaleLine(inv, 'MMK', shopSettings);
  return { baht: bahtLine.subtotal, mmk: mmkLine.subtotal };
}

function bahtCartLineToMmk(
  item: TransactionItem,
  shopSettings?: {
    baht_to_mmk_buy?: number;
    baht_to_mmk_sell?: number;
  }
): TransactionItem {
  const { sellRate } = thaiFxRates(shopSettings);
  // Baht → MMK always uses SELL rate
  const gold = Math.round(bahtToMmk(Number(item.gold_amount || 0), sellRate));
  const craft = Math.round(bahtToMmk(Number(item.craftsmanship_fee || 0), sellRate));
  return {
    ...item,
    gold_amount: gold,
    craftsmanship_fee: craft,
    stone_price: 0,
    wastage_amount: 0,
    subtotal: Math.max(0, gold + craft),
    gold_price_snapshot: Math.round(
      bahtToMmk(Number(item.gold_price_snapshot || 0), sellRate)
    ),
  };
}

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
    shopSettings,
    masterCategories,
  } = useGoldShop();
  const dialog = useDialog();

  const kyatToGrams = shopSettings?.kyat_to_grams || KYAT_TO_GRAMS;
  const productCategories = useMemo(
    () =>
      masterCategories.filter(
        (c) => (c.category_group || 'PRODUCT') === 'PRODUCT' || c.category_group === 'OTHER'
      ),
    [masterCategories]
  );

  const [activeSubTab, setActiveSubTab] = useState<PosMode>(mode || 'SALE');

  useEffect(() => {
    if (mode) setActiveSubTab(mode);
  }, [mode]);

  const showModeTabs = !mode;

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customers[0] || null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [draftCustomerName, setDraftCustomerName] = useState('');
  const [draftCustomerPhone, setDraftCustomerPhone] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Keep selected customer in sync after list refresh / new save
  useEffect(() => {
    if (!customers.length) {
      setSelectedCustomer(null);
      return;
    }
    setSelectedCustomer((prev) => {
      if (prev) {
        const still = customers.find((c) => c.id === prev.id);
        if (still) return still;
      }
      return customers[0];
    });
  }, [customers]);

  const [cartItems, setCartItems] = useState<TransactionItem[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [stockCategory, setStockCategory] = useState<string>('MYANMAR_GOLD');
  const [thaiSaleCurrency, setThaiSaleCurrency] = useState<ThaiSaleCurrency>('MMK');
  const [stockView, setStockView] = useState<'grid' | 'list'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'KPAY' | 'WAVEPAY' | 'BANK_TRANSFER' | 'CARD'>('CASH');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState('');

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
      } else if (stockCategory === 'MYANMAR_GOLD') {
        if (isThaiItem(i)) return false;
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

  const stockFilterChips = useMemo(
    () => [
      { id: 'THAI_GOLD', labelMM: 'ထိုင်းရွှေ', labelEN: 'Thai Gold' },
      { id: 'MYANMAR_GOLD', labelMM: 'မြန်မာရွှေ', labelEN: 'Myanmar Gold' },
    ],
    []
  );

  const stockGrouped = useMemo(() => {
    const list = (items: typeof filteredStock) =>
      [...items].sort((a, b) =>
        (a.name_mm || a.name).localeCompare(b.name_mm || b.name)
      );

    if (stockCategory === 'THAI_GOLD') {
      return [
        {
          key: 'THAI_GOLD',
          label: language === 'MM' ? 'ထိုင်းရွှေ' : 'Thai Gold',
          items: list(filteredStock),
        },
      ];
    }
    return [
      {
        key: 'MYANMAR_GOLD',
        label: language === 'MM' ? 'မြန်မာရွှေ' : 'Myanmar Gold',
        items: list(filteredStock),
      },
    ];
  }, [filteredStock, stockCategory, language]);

  const stockItemCount = useMemo(
    () => stockGrouped.reduce((n, g) => n + g.items.length, 0),
    [stockGrouped]
  );
  useEffect(() => {
    if (activeSubTab === 'SALE') searchInputRef.current?.focus();
  }, [activeSubTab]);

  const addItemFromInventory = (itemId: string) => {
    const inv = inventory.find((i) => i.id === itemId);
    if (!inv) return;
    if (cartItems.some((c) => c.item_id === inv.id)) {
      void dialog.alert(language === 'MM' ? 'ဤပစ္စည်းသည် စာရင်းထဲတွင် ရောက်ရှိနေပြီးဖြစ်ပါသည်' : 'Item is already in cart');
      return;
    }
    const cartHasThai = cartItems.some((c) => isThaiItem(c));
    const cartHasMm = cartItems.some((c) => !isThaiItem(c));
    if (cartHasThai && !isThaiItem(inv)) {
      void dialog.alert(
        language === 'MM'
          ? 'ထိုင်းရွှေနဲ့ မြန်မာရွှေ တူတူရောင်းလို့ မရပါ — မြန်မာရွှေမထည့်မီ ထိုင်းရွှေကို ဖယ်ပါ'
          : 'Cannot mix Thai and Myanmar gold — clear Thai items first'
      );
      return;
    }
    if (cartHasMm && isThaiItem(inv)) {
      void dialog.alert(
        language === 'MM'
          ? 'ထိုင်းရွှေနဲ့ မြန်မာရွှေ တူတူရောင်းလို့ မရပါ — ထိုင်းရွှေမထည့်မီ မြန်မာရွှေကို ဖယ်ပါ'
          : 'Cannot mix Thai and Myanmar gold — clear Myanmar items first'
      );
      return;
    }
    if (thaiSaleCurrency === 'BAHT' && !isThaiItem(inv)) {
      void dialog.alert(
        language === 'MM'
          ? 'Baht ငွေကြေးရွေးထားချိန်တွင် မြန်မာရွှေ မထည့်နိုင်ပါ — MMK သို့ ပြောင်းပါ'
          : 'Myanmar gold cannot be added while Baht currency is selected — switch to MMK'
      );
      return;
    }
    const netKpy = { kyat: inv.net_weight_kyat, pae: inv.net_weight_pae, yway: inv.net_weight_yway };
    const gemKpy = {
      kyat: inv.gemstone_weight_kyat || 0,
      pae: inv.gemstone_weight_pae || 0,
      yway: inv.gemstone_weight_yway || 0,
    };

    let gold_amount: number;
    let craftsmanship_fee: number;
    let stone_price: number;
    let subtotal: number;
    let gold_price_snapshot: number;

    if (isThaiItem(inv)) {
      const line = buildThaiSaleLine(inv, thaiSaleCurrency, shopSettings);
      gold_amount = line.gold_amount;
      craftsmanship_fee = line.craftsmanship_fee;
      stone_price = line.stone_price;
      subtotal = line.subtotal;
      gold_price_snapshot = line.gold_price_snapshot;
    } else {
      const pure16Price = goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 5750000;
      const specificPrice = getLivePriceForPurity(inv.purity);
      const breakdown = calculateSaleLineBreakdown({
        purity: inv.purity,
        itemType: inv.item_type,
        netWeight: netKpy,
        thaiWeightUnit: inv.thai_weight_unit,
        craftsmanshipFee: inv.craftsmanship_fee + (inv.craftsmanship_profit_fee || 0),
        stonePrice: (inv.stone_price || 0) + (inv.stone_profit_price || 0),
        pricePerKyat16Pe: pure16Price,
        specificSellPrice: specificPrice,
      });
      gold_amount = breakdown.goldAmount;
      craftsmanship_fee = breakdown.craftsmanshipFee;
      stone_price = breakdown.stonePrice;
      subtotal = breakdown.lineSubtotal;
      gold_price_snapshot = breakdown.effectivePricePerKyat;
    }

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
        gold_price_snapshot,
        gold_amount,
        craftsmanship_fee,
        stone_price,
        wastage_amount: 0,
        subtotal,
        item_type: inv.item_type,
        thai_weight_unit: inv.thai_weight_unit,
      },
    ]);
    setInventorySearch('');
    searchInputRef.current?.focus();
  };

  const applyThaiSaleCurrency = (next: ThaiSaleCurrency) => {
    if (next === 'BAHT') {
      const hasMyanmar = cartItems.some((i) => !isThaiItem(i));
      if (hasMyanmar) {
        void dialog.alert(
          language === 'MM'
            ? 'Baht ရွေးရန် မြန်မာရွှေကို ဘောင်ချာမှ ဖယ်ပါ'
            : 'Remove Myanmar gold from cart before selecting Baht'
        );
        return;
      }
      setStockCategory('THAI_GOLD');
    }
    setThaiSaleCurrency(next);
    setCartItems((prev) =>
      prev.map((item) => {
        if (!isThaiItem(item) || !item.item_id) return item;
        const inv = inventory.find((i) => i.id === item.item_id);
        if (!inv) return item;
        const line = buildThaiSaleLine(inv, next, shopSettings);
        return {
          ...item,
          gold_amount: line.gold_amount,
          craftsmanship_fee: line.craftsmanship_fee,
          stone_price: line.stone_price,
          wastage_amount: 0,
          subtotal: line.subtotal,
          gold_price_snapshot: line.gold_price_snapshot,
        };
      })
    );
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
        if (isThaiItem(next)) {
          // ထိုင်းရွှေ — ရွှေချိန်တန်ဖိုး + လက်ခ သာ
          next.stone_price = 0;
          next.wastage_amount = 0;
          next.subtotal = Math.max(0, gold + craft);
        } else {
          const stone = Number(next.stone_price || 0);
          const waste = Number(next.wastage_amount || 0);
          next.subtotal = Math.max(0, gold + craft + stone - waste);
        }
        return next;
      })
    );
  };

  const totalGoldAmount = cartItems.reduce((sum, i) => sum + Number(i.gold_amount || 0), 0);
  const totalCraftsmanshipCart = cartItems.reduce((sum, i) => sum + i.craftsmanship_fee, 0);
  const totalStoneCart = cartItems.reduce((sum, i) => sum + Number(i.stone_price || 0), 0);
  const totalWastageCart = cartItems.reduce((sum, i) => sum + Number(i.wastage_amount || 0), 0);
  const subtotalCart = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
  const cartHasThai = cartItems.some((i) => isThaiItem(i));
  const isThaiOnlyCart =
    cartItems.length > 0 && cartItems.every((i) => isThaiItem(i));
  // MMK / Baht ရွေးခွင့် — ထိုင်းရွှေ category ရောင်းချိန်မှသာ
  const showThaiCurrencyToggle = stockCategory === 'THAI_GOLD';
  const saleInBaht = stockCategory === 'THAI_GOLD' && thaiSaleCurrency === 'BAHT';
  const formatSaleMoney = (n: number) => (saleInBaht ? formatBaht(n) : formatMMK(n));
  // ထိုင်းရွှေအရောင်း — ရွှေချိန်တန်ဖိုး + လက်ခ (− လျော့ငွေ)
  const thaiSaleMode = stockCategory === 'THAI_GOLD' || isThaiOnlyCart;
  const effectiveDiscount = Number(discountAmount || 0);
  const totalSaleAmount = Math.max(
    0,
    thaiSaleMode
      ? totalGoldAmount + totalCraftsmanshipCart - effectiveDiscount
      : subtotalCart - effectiveDiscount
  );
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

  const handleCompleteSale = async () => {
    if (cartItems.length === 0) {
      void dialog.alert(language === 'MM' ? 'ရောင်းချမည့် ပစ္စည်းထည့်သွင်းပါ' : 'Please add items to sell');
      return;
    }
    if (remainingCreditAmount > 0) {
      void dialog.alert(
        language === 'MM'
          ? 'လက်ငင်းရောင်းသာ — ကျသင့်ငွေ အပြည့် လက်ခံငွေ ထည့်ပါ (အရစ်ကျ / အကြွေး မရပါ)'
          : 'Cash sale only — enter full payment (no installment / credit)'
      );
      return;
    }
    if (cartHasThai && cartItems.some((i) => !isThaiItem(i))) {
      void dialog.alert(
        language === 'MM'
          ? 'ထိုင်းရွှေနဲ့ မြန်မာရွှေ တူတူရောင်းလို့ မရပါ'
          : 'Cannot mix Thai and Myanmar gold in one sale'
      );
      return;
    }
    const customerId = selectedCustomer?.id || '';
    const customerName = selectedCustomer?.name || 'ဧည့်သည်';
    const customerPhone = selectedCustomer?.phone || '';

    // Persist sale in MMK (convert Baht cart via Header FX formula)
    const itemsForApi =
      thaiSaleCurrency === 'BAHT'
        ? cartItems.map((item) =>
            isThaiItem(item) ? bahtCartLineToMmk(item, shopSettings) : item
          )
        : cartItems.map((item) =>
            isThaiItem(item)
              ? {
                  ...item,
                  stone_price: 0,
                  wastage_amount: 0,
                  subtotal: Math.max(
                    0,
                    Number(item.gold_amount || 0) + Number(item.craftsmanship_fee || 0)
                  ),
                }
              : item
          );
    const craftTotalApi = itemsForApi.reduce((s, i) => s + Number(i.craftsmanship_fee || 0), 0);
    const stoneTotalApi = thaiSaleMode
      ? 0
      : itemsForApi.reduce((s, i) => s + Number(i.stone_price || 0), 0);
    const subtotalApi = itemsForApi.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const discountMmk =
      thaiSaleCurrency === 'BAHT'
        ? Math.round(bahtToMmk(Number(discountAmount || 0), thaiFxRates(shopSettings).sellRate))
        : Number(discountAmount || 0);
    const totalMmk = Math.max(0, subtotalApi - discountMmk);
    const remainingMmk = 0;

    const newTxn = await createTransaction({
      invoice_no: generateInvoiceNo('INV'),
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      transaction_type: 'SALE',
      items: itemsForApi,
      gold_price_snapshot: itemsForApi[0]?.gold_price_snapshot || 5750000,
      craftsmanship_total: craftTotalApi,
      stone_total: stoneTotalApi,
      discount_amount: discountMmk,
      tax_amount: 0,
      total_amount: totalMmk,
      paid_amount: totalMmk,
      remaining_amount: remainingMmk,
      payment_method: paymentMethod,
      interest_rate: 0,
      credit_due_date: undefined,
      is_installment: false,
      notes:
        thaiSaleCurrency === 'BAHT'
          ? `${saleNotes ? saleNotes + ' — ' : ''}Thai sale priced in Baht (converted to MMK)`
          : saleNotes,
    } as Omit<Transaction, 'id' | 'created_at'>);
    setCartItems([]);
    setDiscountAmount(0);
    setAmountPaidInput('');
    setSaleNotes('');
    setThaiSaleCurrency('MMK');
    setSelectedVoucher(newTxn);
  };


  // -------------------------------------------------------------
  // PURCHASE STATE (အဝယ် - ရွှေဟောင်းဝယ်ယူခြင်း)
  // -------------------------------------------------------------
  const [purCustomerName, setPurCustomerName] = useState('ဦးဇော်လင်း');
  const [purCustomerPhone, setPurCustomerPhone] = useState('09-445566778');
  const [purItemName, setPurItemName] = useState('ရွှေဟောင်းဆွဲကြိုး (အလဲ/အဝယ်)');
  const [purCategory, setPurCategory] = useState('NECKLACE');
  const [purPurity, setPurPurity] = useState<GoldPurity>('PE15A');

  const [purGrossKyat, setPurGrossKyat] = useState<number>(1);
  const [purGrossPae, setPurGrossPae] = useState<number>(0);
  const [purGrossYway, setPurGrossYway] = useState<number>(0);
  const [purGrossGrams, setPurGrossGrams] = useState<number>(KYAT_TO_GRAMS);

  // နုတ်ပယ်ချက် = ကျောက်ချိန် သာ
  const [purGemKyat, setPurGemKyat] = useState(0);
  const [purGemPae, setPurGemPae] = useState(0);
  const [purGemYway, setPurGemYway] = useState(0);
  const [purGemGrams, setPurGemGrams] = useState(0);

  const [purPaymentMethod, setPurPaymentMethod] = useState<'CASH' | 'KPAY' | 'WAVEPAY' | 'BANK_TRANSFER'>('CASH');
  const [purNotes, setPurNotes] = useState('ကျောက်ချိန် နုတ်ပြီး အဝယ်ပေါက်ဈေးအတိုင်း ရှင်းပေးသည်။');
  const [purManualAmount, setPurManualAmount] = useState<string>('');
  /** Editable buy rate (MMK per kyat) — drives payout */
  const [purBuyPriceInput, setPurBuyPriceInput] = useState<number>(() => getBuyPriceForPurity('PE15A'));

  const isPurThai = purPurity === 'THAI_GOLD';
  const fxBuy = shopSettings?.baht_to_mmk_buy || 755;

  // Purchase Net = Gross − Gem (no wastage)
  const purNetKpy = calculateNetFromParts(
    { kyat: purGrossKyat, pae: purGrossPae, yway: purGrossYway },
    { kyat: purGemKyat, pae: purGemPae, yway: purGemYway },
    0,
    0
  );
  const purNetGrams = kpyToGrams(purNetKpy, kyatToGrams);

  const purBuyRateMmk = Number(purBuyPriceInput) || 0;
  const purBuyRateBaht = mmkToBaht(purBuyRateMmk, fxBuy); // MMK → Baht = buy rate

  const purNetYway = kpyToYway(purNetKpy.kyat, purNetKpy.pae, purNetKpy.yway);
  const purCalcPayoutMmk = Math.round((purNetYway / 128) * purBuyRateMmk);
  const purCalcPayoutBaht = Number(mmkToBaht(purCalcPayoutMmk, fxBuy).toFixed(2));
  const purTotalPayout =
    purManualAmount === '' ? purCalcPayoutMmk : Math.max(0, Number(purManualAmount) || 0);
  const purTotalPayoutBaht = Number(mmkToBaht(purTotalPayout, fxBuy).toFixed(2));

  useEffect(() => {
    setPurBuyPriceInput(getBuyPriceForPurity(purPurity));
    setPurManualAmount('');
  }, [purPurity]);

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

  const applyPurGemFromGrams = (grams: number) => {
    setPurGemGrams(grams);
    const kpy = gramsToKpy(grams, kyatToGrams);
    setPurGemKyat(kpy.kyat);
    setPurGemPae(kpy.pae);
    setPurGemYway(kpy.yway);
  };

  const applyPurGemFromKpy = (kyat: number, pae: number, yway: number) => {
    setPurGemKyat(kyat);
    setPurGemPae(pae);
    setPurGemYway(yway);
    setPurGemGrams(kpyToGrams({ kyat, pae, yway }, kyatToGrams));
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
          category: purCategory || 'OLD_GOLD',
          weight: { kyat: purGrossKyat, pae: purGrossPae, yway: purGrossYway },
          gemstone_weight: { kyat: purGemKyat, pae: purGemPae, yway: purGemYway },
          net_weight: purNetKpy,
          purity: purPurity,
          gold_price_snapshot: purBuyRateMmk,
          gold_amount: purTotalPayout,
          craftsmanship_fee: 0,
          stone_price: 0,
          subtotal: purTotalPayout,
          item_type: isPurThai ? 'THAI_GOLD' : 'MYANMAR_GOLD',
          thai_weight_unit: isPurThai ? Number(purNetGrams.toFixed(3)) : undefined,
        },
      ],
      gold_price_snapshot: purBuyRateMmk,
      craftsmanship_total: 0,
      stone_total: 0,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: purTotalPayout,
      paid_amount: purTotalPayout,
      remaining_amount: 0,
      payment_method: purPaymentMethod as any,
      notes: isPurThai
        ? `${purNotes} · Baht ${purTotalPayoutBaht} ฿ (MMK→Baht @ buy ${fxBuy})`
        : purNotes,
      add_to_stock: false,
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
  const [excTradeCategory, setExcTradeCategory] = useState('NECKLACE');
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
          category: excTradeCategory || 'OLD_GOLD',
          weight: { kyat: excGrossKyat, pae: excGrossPae, yway: excGrossYway },
          net_weight: excTradeNet,
          purity: excTradePurity,
          gold_price_snapshot: excBuyRate,
          craftsmanship_fee: 0,
          subtotal: excTradeCredit,
          item_type: excTradePurity === 'THAI_GOLD' ? 'THAI_GOLD' : 'MYANMAR_GOLD',
          thai_weight_unit:
            excTradePurity === 'THAI_GOLD'
              ? Number(kpyToGrams(excTradeNet, kyatToGrams).toFixed(3))
              : undefined,
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

  // -------------------------------------------------------------
  // SHOP_OUT STATE (ဆိုင်ထုတ်)
  // -------------------------------------------------------------
  const [outCart, setOutCart] = useState<InventoryItem[]>([]);
  const [outSearch, setOutSearch] = useState('');
  const [outNote, setOutNote] = useState('');
  const [outSaving, setOutSaving] = useState(false);

  const outStockItems = useMemo(
    () => inventory.filter((i) => i.status === 'IN_STOCK'),
    [inventory]
  );
  const outFiltered = useMemo(() => {
    const q = outSearch.trim().toLowerCase();
    const taken = new Set(outCart.map((c) => c.id));
    return outStockItems.filter((i) => {
      if (taken.has(i.id)) return false;
      if (!q) return true;
      return (
        i.barcode.toLowerCase().includes(q) ||
        i.name_mm.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q)
      );
    });
  }, [outStockItems, outSearch, outCart]);

  const addOutItem = (item: InventoryItem) => {
    setOutCart((prev) => (prev.some((c) => c.id === item.id) ? prev : [...prev, item]));
  };

  const removeOutItem = (id: string) =>
    setOutCart((prev) => prev.filter((c) => c.id !== id));

  const handleCompleteShopOut = async () => {
    if (outCart.length === 0) {
      void dialog.alert(language === 'MM' ? 'ပစ္စည်း ရွေးထည့်ပါ' : 'Add items first');
      return;
    }
    const note = outNote.trim();
    if (!note) {
      void dialog.alert(language === 'MM' ? 'မှတ်ချက် ရေးပါ' : 'Please enter a note');
      return;
    }
    setOutSaving(true);
    try {
      const txn = await createTransaction({
        invoice_no: generateInvoiceNo('OUT'),
        customer_id: '',
        customer_name: 'ဆိုင်ထုတ်',
        customer_phone: '',
        transaction_type: 'SHOP_OUT',
        items: outCart.map((inv) => ({
          id: `out-${inv.id}-${Date.now()}`,
          transaction_id: '',
          item_id: inv.id,
          item_name: inv.name_mm || inv.name,
          category: inv.category,
          weight: {
            kyat: inv.weight_kyat,
            pae: inv.weight_pae,
            yway: inv.weight_yway,
          },
          gemstone_weight: {
            kyat: inv.gemstone_weight_kyat || 0,
            pae: inv.gemstone_weight_pae || 0,
            yway: inv.gemstone_weight_yway || 0,
          },
          net_weight: {
            kyat: inv.net_weight_kyat,
            pae: inv.net_weight_pae,
            yway: inv.net_weight_yway,
          },
          purity: inv.purity,
          gold_price_snapshot: getLivePriceForPurity(inv.purity),
          gold_amount: 0,
          craftsmanship_fee: 0,
          stone_price: 0,
          subtotal: 0,
          item_type: inv.item_type,
          thai_weight_unit: inv.thai_weight_unit,
          line_role: note,
        })),
        gold_price_snapshot:
          goldPrices.find((p) => p.gold_type === 'MEELIN')?.price_per_kyat || 0,
        craftsmanship_total: 0,
        stone_total: 0,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        remaining_amount: 0,
        payment_method: 'CASH',
        notes: note,
      } as any);
      setOutCart([]);
      setOutSearch('');
      setOutNote('');
      setSelectedVoucher(txn);
    } catch (err) {
      void dialog.alert(err instanceof Error ? err.message : 'Shop-out failed');
    } finally {
      setOutSaving(false);
    }
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
            <button
              type="button"
              onClick={() => setActiveSubTab('SHOP_OUT')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-1.5 ${
                activeSubTab === 'SHOP_OUT'
                  ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <PackageMinus className="w-4 h-4" />
              <span>{language === 'MM' ? 'ဆိုင်ထုတ်' : 'Shop Out'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {activeSubTab === 'SALE' && <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />}
            {activeSubTab === 'PURCHASE' && <ArrowDownLeft className="w-5 h-5 text-blue-600" />}
            {activeSubTab === 'EXCHANGE' && <ArrowLeftRight className="w-5 h-5 text-emerald-600" />}
            {activeSubTab === 'SHOP_OUT' && <PackageMinus className="w-5 h-5 text-rose-600" />}
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {activeSubTab === 'SALE'
                ? language === 'MM'
                  ? 'အရောင်းဘောင်ချာ'
                  : 'Sales Voucher'
                : activeSubTab === 'PURCHASE'
                  ? language === 'MM'
                    ? 'အဝယ်ဘောင်ချာ'
                    : 'Purchase Voucher'
                  : activeSubTab === 'EXCHANGE'
                    ? language === 'MM'
                      ? 'အလဲအလှယ်'
                      : 'Exchange'
                    : language === 'MM'
                      ? 'ဆိုင်ထုတ်'
                      : 'Shop Out'}
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
                    chip.id === 'THAI_GOLD'
                      ? inStockItems.filter(isThaiItem).length
                      : inStockItems.filter((i) => !isThaiItem(i)).length;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setStockCategory(chip.id);
                        if (chip.id === 'MYANMAR_GOLD') {
                          // မြန်မာရွှေ — MMK သာ၊ Baht ရွေးခွင့် မလို
                          if (thaiSaleCurrency === 'BAHT') applyThaiSaleCurrency('MMK');
                          else setThaiSaleCurrency('MMK');
                        }
                      }}
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
                {stockItemCount} {language === 'MM' ? 'ခု' : 'items'}
                {cartItems.length > 0
                  ? ` · ${cartItems.length} ${language === 'MM' ? 'ဘောင်ချာထဲ' : 'in cart'}`
                  : ''}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 max-h-[62vh]">
              {stockItemCount === 0 ? (
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
                            {group.items.length} {language === 'MM' ? 'ခု' : 'pcs'}
                          </span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                        </div>
                      )}
                      {stockView === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {group.items.map((item) => {
                            const inCart = cartIds.has(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                disabled={inCart}
                                onClick={() => addItemFromInventory(item.id)}
                                className={`text-left rounded-2xl border p-3.5 transition ${
                                  inCart
                                    ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 opacity-70'
                                    : 'border-gray-200 dark:border-gray-800 bg-[#FAF8F2]/50 dark:bg-[#141414] hover:border-[#D4AF37]/50 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <span className="font-mono text-[10px] font-bold text-gray-500 truncate">
                                    {item.barcode}
                                  </span>
                                  {inCart ? (
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
                                    {isThaiItem(item) ? (
                                      (() => {
                                        const p = thaiDisplayPrices(item, shopSettings);
                                        return (
                                          <span className="block space-y-0.5">
                                            <span className="block">{formatMMK(p.mmk)}</span>
                                            <span className="block text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                              {formatBaht(p.baht)}
                                            </span>
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      formatMMK(item.selling_price_estimated)
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {group.items.map((item) => {
                            const inCart = cartIds.has(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                disabled={inCart}
                                onClick={() => addItemFromInventory(item.id)}
                                className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 transition ${
                                  inCart
                                    ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 opacity-70'
                                    : 'border-gray-200 dark:border-gray-800 hover:border-[#D4AF37]/40'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold text-gray-500 shrink-0">
                                      {item.barcode}
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
                                    {isThaiItem(item) ? (
                                      (() => {
                                        const p = thaiDisplayPrices(item, shopSettings);
                                        return (
                                          <>
                                            <div>{formatMMK(p.mmk)}</div>
                                            <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                              {formatBaht(p.baht)}
                                            </div>
                                          </>
                                        );
                                      })()
                                    ) : (
                                      formatMMK(item.selling_price_estimated)
                                    )}
                                  </div>
                                  {inCart ? (
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
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const c = customers.find((cust) => cust.id === e.target.value);
                    if (c) setSelectedCustomer(c);
                  }}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] font-medium"
                >
                  {customers.length === 0 && (
                    <option value="">
                      {language === 'MM' ? 'ဖောက်သည် မရှိသေးပါ' : 'No customers yet'}
                    </option>
                  )}
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {showThaiCurrencyToggle && (
                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                  <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                    {language === 'MM' ? 'ထိုင်းရွှေ ငွေကြေး' : 'Thai gold currency'}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyThaiSaleCurrency('MMK')}
                      className={`py-2 rounded-lg text-xs font-extrabold border transition ${
                        thaiSaleCurrency === 'MMK'
                          ? 'bg-[#D4AF37] text-white border-[#C5A059]'
                          : 'bg-white dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600'
                      }`}
                    >
                      MMK
                    </button>
                    <button
                      type="button"
                      onClick={() => applyThaiSaleCurrency('BAHT')}
                      className={`py-2 rounded-lg text-xs font-extrabold border transition ${
                        thaiSaleCurrency === 'BAHT'
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-white dark:bg-[#121212] border-gray-200 dark:border-gray-700 text-gray-600'
                      }`}
                    >
                      Baht (฿)
                    </button>
                  </div>
                  <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80">
                    {thaiSaleCurrency === 'BAHT'
                      ? language === 'MM'
                        ? 'Baht ဖြင့် တွက်ချက် / ပြသမည်'
                        : 'Prices calculated & shown in Baht'
                      : language === 'MM'
                        ? 'Header FX ဖော်မြူလာဖြင့် MMK တွက်မည်'
                        : 'MMK via Header FX formula (rate/100000)'}
                  </p>
                </div>
              )}

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
                          <NumberInput
                            value={Number(item.gold_amount || 0)}
                            onChange={(v) => updateCartLine(item.id, { gold_amount: v })}
                            className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400">လက်ခ</label>
                          <NumberInput
                            value={Number(item.craftsmanship_fee || 0)}
                            onChange={(v) => updateCartLine(item.id, { craftsmanship_fee: v })}
                            className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </div>
                        {!isThaiItem(item) && (
                          <>
                            <div>
                              <label className="text-[10px] text-gray-400">ကျောက်ဖိုး</label>
                              <NumberInput
                                value={Number(item.stone_price || 0)}
                                onChange={(v) => updateCartLine(item.id, { stone_price: v })}
                                className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">အလျော့တွက်</label>
                              <NumberInput
                                value={Number(item.wastage_amount || 0)}
                                onChange={(v) => updateCartLine(item.id, { wastage_amount: v })}
                                className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-right font-mono font-bold text-gray-900 dark:text-amber-300">
                        {formatSaleMoney(item.subtotal)}
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
                  <div className="text-right font-mono font-bold">{formatSaleMoney(totalSaleAmount)}</div>
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
                        <td className="px-2 py-1.5 text-right font-mono font-bold">{formatSaleMoney(totalGoldAmount)}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'လက်ခ' : 'Craft fee'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold">{formatSaleMoney(totalCraftsmanshipCart)}</td>
                      </tr>
                      {!thaiSaleMode && (
                        <>
                          <tr>
                            <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'ကျောက်ဖိုး' : 'Stone price'}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold">{formatSaleMoney(totalStoneCart)}</td>
                          </tr>
                          <tr>
                            <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'အလျော့တွက်' : 'Wastage'}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-600">
                              −{formatSaleMoney(totalWastageCart)}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td className="px-2 py-1.5 text-gray-600">{language === 'MM' ? 'လျော့ငွေ' : 'Discount'}</td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step={saleInBaht ? 1 : 5000}
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                            className="w-24 ml-auto block px-2 py-1 text-right font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#121212]"
                          />
                        </td>
                      </tr>
                      <tr className="bg-amber-50/60 dark:bg-amber-950/20">
                        <td className="px-2 py-2 font-extrabold text-gray-900 dark:text-amber-300">
                          {language === 'MM' ? 'ကျသင့်ငွေ' : 'Net payable'}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-extrabold text-gray-900 dark:text-amber-300">
                          {formatSaleMoney(totalSaleAmount)}
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
                      {formatSaleMoney(remainingCreditAmount)}
                    </div>
                  </div>
                </div>

                {remainingCreditAmount > 0 && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    {language === 'MM'
                      ? 'လက်ငင်းငွေရှင်းသာ — ကျသင့်ငွေ အပြည့် လက်ခံငွေ ထည့်ပါ (အရစ်ကျ / အကြွေး မရပါ)'
                      : 'Cash sale only — enter full payment (no installment / credit)'}
                  </p>
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
                ? 'ကျောက်ချိန် နုတ်ပြီး ရိုက်ထည့်သော အဝယ်ပေါက်ဈေးအတိုင်း တန်ဖိုးရှင်းတွက်သည်'
                : 'Net = Gross − Gem; payout from editable buyback rate'}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  {language === 'MM' ? 'ပစ္စည်းအမျိုးအစား:' : 'Category:'}
                </label>
                <select
                  value={purCategory}
                  onChange={(e) => setPurCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] dark:text-white font-bold"
                >
                  {productCategories.map((c) => (
                    <option key={c.id || c.code} value={c.code}>
                      {language === 'MM' ? c.name_mm : c.name_en || c.name_mm}
                    </option>
                  ))}
                </select>
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
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                <span>{language === 'MM' ? '၁။ အထည်ချိန် (Gross Weight)' : '1. Gross Weight'}</span>
                <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
              </div>
              <div className="flex flex-wrap items-end gap-y-2">
                <div className="w-[7.5rem]">
                  <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                  <NumberInput
                    min={0}
                    step={0.001}
                    value={purGrossGrams}
                    onChange={applyPurGrossFromGrams}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                  />
                </div>
                <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                <div className="hidden sm:block w-px self-stretch bg-gray-300 dark:bg-gray-600 my-1" />
                <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                <div className="flex flex-wrap gap-1.5">
                  <div className="w-[4.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                    <NumberInput
                      min={0}
                      value={purGrossKyat}
                      onChange={(v) => applyPurGrossFromKpy(v, purGrossPae, purGrossYway)}
                      className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                  <div className="w-[4.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                    <NumberInput
                      min={0}
                      max={15}
                      value={purGrossPae}
                      onChange={(v) => applyPurGrossFromKpy(purGrossKyat, v, purGrossYway)}
                      className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                  <div className="w-[4.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                    <NumberInput
                      min={0}
                      step={0.1}
                      value={purGrossYway}
                      onChange={(v) => applyPurGrossFromKpy(purGrossKyat, purGrossPae, v)}
                      className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                </div>
              </div>

              {/* နုတ်ပယ်ချက် = ကျောက်ချိန် သာ */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <div className="text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center justify-between">
                  <span>{language === 'MM' ? '၂။ နုတ်ပယ်ချက် — ကျောက်ချိန်' : '2. Deduction — Gemstone'}</span>
                  <span className="text-gray-400 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                </div>
                <div className="flex flex-wrap items-end gap-y-2">
                  <div className="w-[7.5rem]">
                    <label className="text-[11px] text-gray-500 block mb-0.5">Gram</label>
                    <NumberInput
                      min={0}
                      step={0.001}
                      value={purGemGrams}
                      onChange={applyPurGemFromGrams}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D4AF37]/50 bg-white dark:bg-[#1A1A1A]"
                    />
                  </div>
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="hidden sm:block w-px self-stretch bg-gray-300 dark:bg-gray-600 my-1" />
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="flex flex-wrap gap-1.5">
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ကျပ်</label>
                      <NumberInput
                        min={0}
                        value={purGemKyat}
                        onChange={(v) => applyPurGemFromKpy(v, purGemPae, purGemYway)}
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ပဲ</label>
                      <NumberInput
                        min={0}
                        value={purGemPae}
                        onChange={(v) => applyPurGemFromKpy(purGemKyat, v, purGemYway)}
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-gray-500 block mb-0.5">ရွေး</label>
                      <NumberInput
                        min={0}
                        step={0.1}
                        value={purGemYway}
                        onChange={(v) => applyPurGemFromKpy(purGemKyat, purGemPae, v)}
                        className="w-full px-1.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Net weight + editable buy rate */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center justify-between">
                  <span>{language === 'MM' ? 'အဝယ် ရွှေချိန်စင် (Net)' : 'Net buyback weight'}</span>
                  <span className="text-blue-400/80 font-normal">Gram · ကျပ် / ပဲ / ရွေး</span>
                </div>
                <div className="flex flex-wrap items-end gap-y-2">
                  <div className="w-[7.5rem]">
                    <label className="text-[11px] text-blue-500/80 block mb-0.5">Gram</label>
                    <input
                      type="text"
                      readOnly
                      value={purNetGrams.toFixed(3)}
                      className="w-full px-2.5 py-1.5 text-xs font-extrabold rounded-lg border border-blue-300 dark:border-blue-800 bg-white/80 dark:bg-[#1A1A1A] text-blue-900 dark:text-blue-200 font-mono"
                    />
                  </div>
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="hidden sm:block w-px self-stretch bg-blue-300 dark:bg-blue-700 my-1" />
                  <div className="hidden sm:block w-8 shrink-0" aria-hidden />
                  <div className="flex flex-wrap gap-1.5">
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-blue-500/80 block mb-0.5">ကျပ်</label>
                      <input
                        type="text"
                        readOnly
                        value={purNetKpy.kyat}
                        className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-blue-300 dark:border-blue-800 bg-white/80 dark:bg-[#1A1A1A] font-mono"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-blue-500/80 block mb-0.5">ပဲ</label>
                      <input
                        type="text"
                        readOnly
                        value={purNetKpy.pae}
                        className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-blue-300 dark:border-blue-800 bg-white/80 dark:bg-[#1A1A1A] font-mono"
                      />
                    </div>
                    <div className="w-[4.5rem]">
                      <label className="text-[11px] text-blue-500/80 block mb-0.5">ရွေး</label>
                      <input
                        type="text"
                        readOnly
                        value={purNetKpy.yway}
                        className="w-full px-1.5 py-1.5 text-xs font-extrabold rounded-lg border border-blue-300 dark:border-blue-800 bg-white/80 dark:bg-[#1A1A1A] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
                  <label className="text-xs font-bold text-blue-800 dark:text-blue-300 block mb-1.5">
                    {language === 'MM' ? 'ယနေ့အဝယ်ပေါက်ဈေး (ကျပ်တန်)' : 'Buyback rate (per kyat)'}
                  </label>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[10rem] flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">MMK</label>
                      <NumberInput
                        min={0}
                        step={1000}
                        value={purBuyPriceInput}
                        onChange={(v) => {
                          setPurBuyPriceInput(v);
                          setPurManualAmount('');
                        }}
                        className="w-full px-3 py-2 text-sm font-extrabold font-mono rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-[#121212]"
                      />
                    </div>
                    {isPurThai && (
                      <div className="min-w-[8rem]">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Baht (ဝယ်ဈေး)</label>
                        <input
                          type="text"
                          readOnly
                          value={formatBaht(purBuyRateBaht)}
                          className="w-full px-3 py-2 text-sm font-extrabold font-mono rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/80 dark:bg-[#121212] text-blue-800 dark:text-blue-300"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {language === 'MM'
                      ? 'ဤဈေးဖြင့်သာ ဝယ်တွက်မည် — ရိုက်ပြင်နိုင်သည်'
                      : 'Payout uses this rate — editable'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payout & Payment Method */}
            <div className="p-4 rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/30 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1 w-full space-y-2">
                  <span className="text-xs text-[#B8860B] dark:text-[#E5C158] font-bold block">
                    {language === 'MM' ? 'ထုတ်ပေးငွေ (manual ရိုက်နိုင်):' : 'Payout amount (editable):'}
                  </span>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="min-w-[12rem] flex-1">
                      <label className="text-[10px] text-gray-500 block mb-0.5">MMK</label>
                      <input
                        type="number"
                        value={purManualAmount === '' ? purCalcPayoutMmk : Number(purManualAmount)}
                        onChange={(e) => setPurManualAmount(e.target.value)}
                        className="w-full px-3 py-2 text-xl font-extrabold font-mono rounded-xl border border-[#D4AF37]/40 bg-white dark:bg-[#121212] text-[#996515] dark:text-amber-300"
                      />
                    </div>
                    {isPurThai && (
                      <div className="min-w-[10rem]">
                        <label className="text-[10px] text-gray-500 block mb-0.5">
                          Baht (MMK→Baht · ဝယ်ဈေး)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={formatBaht(
                            purManualAmount === ''
                              ? purCalcPayoutBaht
                              : mmkToBaht(Number(purManualAmount) || 0, fxBuy)
                          )}
                          className="w-full px-3 py-2 text-xl font-extrabold font-mono rounded-xl border border-blue-300 bg-blue-50 dark:bg-[#121212] text-blue-800 dark:text-blue-300"
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 block">
                    {language === 'MM'
                      ? `တွက်ချက် = ${formatMMK(purCalcPayoutMmk)}${
                          isPurThai ? ` · ${formatBaht(purCalcPayoutBaht)}` : ''
                        }`
                      : `Calculated = ${formatMMK(purCalcPayoutMmk)}${
                          isPurThai ? ` · ${formatBaht(purCalcPayoutBaht)}` : ''
                        }`}
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
                <span>Type: {isPurThai ? 'Thai' : 'Myanmar'}</span>
                <span>Gram: {purNetGrams.toFixed(3)} g</span>
                <span>Amount: {formatMMK(purTotalPayout)}</span>
                {isPurThai && <span>{formatBaht(purTotalPayoutBaht)}</span>}
              </div>
            </div>

            <button
              onClick={handleCompletePurchase}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'MM' ? 'အဝယ်ဘောင်ချာ ထုတ်ယူပြီး ငွေရှင်းမည်' : 'Complete Buyback & Print Voucher'}</span>
            </button>

            <p className="text-[11px] text-gray-500 text-center">
              {language === 'MM'
                ? 'အဝယ်ပစ္စည်းများသည် စတော့ထဲ မဝင်ဘဲ «အဟောင်းထည်» စာရင်းတွင် ပြမည်'
                : 'Purchased items are not added to inventory — they appear under Old Gold'}
            </p>

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
            <div className="grid grid-cols-2 gap-2">
              <select
                value={excTradeCategory}
                onChange={(e) => setExcTradeCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A]"
              >
                {productCategories.map((c) => (
                  <option key={c.id || c.code} value={c.code}>
                    {language === 'MM' ? c.name_mm : c.name_en || c.name_mm}
                  </option>
                ))}
              </select>
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
            </div>
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

      {/* ------------------------------------------------------------- */}
      {/* 4. SHOP_OUT — remove stock with note (ဆိုင်ထုတ်) */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'SHOP_OUT' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[70vh]">
          <section className="xl:col-span-6 flex flex-col rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden min-w-0">
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <PackageMinus className="w-4 h-4 text-rose-600 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                    {language === 'MM' ? 'ဆိုင်ရှိ ပစ္စည်းများ' : 'In-stock items'}
                  </h3>
                  <p className="text-[10px] text-gray-500 leading-tight">
                    {language === 'MM'
                      ? 'နှိပ်ပြီး ညာဘက်သို့ ထည့်မည်'
                      : 'Click to add →'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {outStockItems.length} {language === 'MM' ? 'ထည်' : ''}
              </span>
            </div>

            <div className="px-2.5 py-2 border-b border-gray-100 dark:border-gray-900">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={outSearch}
                  onChange={(e) => setOutSearch(e.target.value)}
                  placeholder={
                    language === 'MM'
                      ? 'ဘားကုဒ် / အမည်…'
                      : 'Barcode / name…'
                  }
                  className="w-full pl-8 pr-2 py-1.5 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] dark:text-white font-medium focus:ring-2 focus:ring-rose-400 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[58vh]">
              {outFiltered.length === 0 ? (
                <p className="text-center text-[11px] text-gray-400 py-8">
                  {language === 'MM' ? 'ပစ္စည်း မရှိပါ' : 'No items'}
                </p>
              ) : (
                outFiltered.map((item) => {
                  const thai = isThaiItem(item);
                  const cat = masterCategories.find((c) => c.code === item.category);
                  const catName =
                    language === 'MM'
                      ? cat?.name_mm || item.category
                      : cat?.name_en || item.category;
                  const grossLabel = formatKPYMyanmar({
                    kyat: item.weight_kyat,
                    pae: item.weight_pae,
                    yway: item.weight_yway,
                  });
                  const netLabel = thai
                    ? `${Number(item.thai_weight_unit || 0).toFixed(2)} g`
                    : formatKPYMyanmar({
                        kyat: item.net_weight_kyat,
                        pae: item.net_weight_pae,
                        yway: item.net_weight_yway,
                      });
                  const craftTotal =
                    Number(item.craftsmanship_fee || 0) +
                    Number(item.craftsmanship_profit_fee || 0);
                  const stoneTotal =
                    Number(item.stone_price || 0) + Number(item.stone_profit_price || 0);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addOutItem(item)}
                      className="w-full text-left px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-rose-300 dark:hover:border-rose-800 bg-white dark:bg-[#121212] transition"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[11px] leading-snug text-gray-900 dark:text-white line-clamp-2">
                            {language === 'MM' ? item.name_mm || item.name : item.name}
                          </div>
                          <div className="text-[9px] font-mono text-gray-400 mt-0.5 truncate">
                            {item.barcode}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded ${
                            thai
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {thai
                            ? language === 'MM'
                              ? 'ထိုင်း'
                              : 'Thai'
                            : language === 'MM'
                              ? 'မြန်မာ'
                              : 'MM'}
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[9px] leading-tight">
                        <div className="text-gray-500 truncate">
                          <span className="text-gray-400">
                            {language === 'MM' ? 'အမျိုးအစား' : 'Cat'}
                          </span>{' '}
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {catName}
                          </span>
                        </div>
                        <div className="text-gray-500 truncate text-right">
                          <span className="text-gray-400">
                            {language === 'MM' ? 'ရည်' : 'Purity'}
                          </span>{' '}
                          <span className="font-semibold text-[#996515] dark:text-amber-300">
                            {PURITY_LABELS[item.purity]?.mm || item.purity}
                          </span>
                        </div>
                        {!thai && (
                          <div className="text-gray-500 col-span-2 font-mono">
                            <span className="text-gray-400">
                              {language === 'MM' ? 'အထည်' : 'Gross'}
                            </span>{' '}
                            {grossLabel}
                          </div>
                        )}
                        <div className="text-gray-500 col-span-2 font-mono">
                          <span className="text-gray-400">
                            {language === 'MM' ? 'ရွှေချိန်' : 'Net'}
                          </span>{' '}
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {netLabel}
                          </span>
                        </div>
                        {craftTotal > 0 && (
                          <div className="text-gray-500 font-mono">
                            <span className="text-gray-400">
                              {language === 'MM' ? 'လက်ခ' : 'Craft'}
                            </span>{' '}
                            {formatMMK(craftTotal)}
                          </div>
                        )}
                        {stoneTotal > 0 && (
                          <div className="text-gray-500 font-mono text-right">
                            <span className="text-gray-400">
                              {language === 'MM' ? 'ကျောက်' : 'Stone'}
                            </span>{' '}
                            {formatMMK(stoneTotal)}
                          </div>
                        )}
                        <div className="col-span-2 font-mono font-bold text-[10px] text-rose-700 dark:text-rose-300 pt-0.5 border-t border-gray-100 dark:border-gray-800 mt-0.5">
                          <span className="font-semibold text-gray-400 mr-1">
                            {language === 'MM' ? 'ခန့်မှန်း' : 'Est.'}
                          </span>
                          {formatMMK(Number(item.selling_price_estimated || 0))}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="xl:col-span-6 flex flex-col rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                {language === 'MM' ? 'ဆိုင်ထုတ် စာရင်း' : 'Shop-out list'}
              </h3>
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                {outCart.length} {language === 'MM' ? 'ခု' : 'items'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 max-h-[40vh]">
              {outCart.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-10">
                  {language === 'MM'
                    ? 'ဘယ်ဘက်မှ ပစ္စည်းများ ရွေးထည့်ပါ'
                    : 'Pick items on the left'}
                </p>
              ) : (
                outCart.map((inv) => {
                  const thai = isThaiItem(inv);
                  const cat = masterCategories.find((c) => c.code === inv.category);
                  const catName =
                    language === 'MM'
                      ? cat?.name_mm || inv.category
                      : cat?.name_en || inv.category;
                  return (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#121212]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-gray-900 dark:text-white truncate">
                            {language === 'MM' ? inv.name_mm || inv.name : inv.name}
                          </div>
                          <div className="text-[10px] font-mono text-gray-400">{inv.barcode}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOutItem(inv.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                        <span>
                          {catName} · {PURITY_LABELS[inv.purity]?.mm || inv.purity}
                        </span>
                        <span className="font-mono">
                          {thai
                            ? `${Number(inv.thai_weight_unit || 0).toFixed(2)} g · ထိုင်း`
                            : `${formatKPYMyanmar({
                                kyat: inv.net_weight_kyat,
                                pae: inv.net_weight_pae,
                                yway: inv.net_weight_yway,
                              })} · မြန်မာ`}
                        </span>
                        <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                          {formatMMK(Number(inv.selling_price_estimated || 0))}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block mb-1.5">
                  {language === 'MM' ? 'မှတ်ချက် *' : 'Note *'}
                </label>
                <textarea
                  value={outNote}
                  onChange={(e) => setOutNote(e.target.value)}
                  rows={3}
                  placeholder={
                    language === 'MM'
                      ? 'ပစ္စည်းအားလုံး ထည့်ပြီးမှ အကြောင်းရင်း ရေးပါ…'
                      : 'After adding all items, write the reason…'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-[#121212] resize-none focus:ring-2 focus:ring-rose-400 focus:outline-hidden"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCompleteShopOut()}
                disabled={outCart.length === 0 || outSaving}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {outSaving
                  ? language === 'MM'
                    ? 'သိမ်းနေသည်…'
                    : 'Saving…'
                  : language === 'MM'
                    ? 'ဆိုင်ထုတ် သိမ်းမည်'
                    : 'Confirm Shop Out'}
              </button>
            </div>
          </section>
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
                disabled={savingCustomer}
                onClick={() => {
                  void (async () => {
                    const name = draftCustomerName.trim();
                    if (!name) return;
                    setSavingCustomer(true);
                    try {
                      const created = await addCustomer(
                        name,
                        draftCustomerPhone.trim() || 'N/A',
                        'Walk-in'
                      );
                      setSelectedCustomer(created);
                      setDraftCustomerName('');
                      setDraftCustomerPhone('');
                      setShowNewCustomerModal(false);
                    } catch (err) {
                      void dialog.alert(
                        language === 'MM'
                          ? `ဖောက်သည် သိမ်းမရပါ: ${err instanceof Error ? err.message : String(err)}`
                          : `Could not save customer: ${err instanceof Error ? err.message : String(err)}`
                      );
                    } finally {
                      setSavingCustomer(false);
                    }
                  })();
                }}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold disabled:opacity-50"
              >
                {savingCustomer
                  ? language === 'MM'
                    ? 'သိမ်းနေသည်…'
                    : 'Saving…'
                  : language === 'MM'
                    ? 'သိမ်းမည်'
                    : 'Save'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
};
