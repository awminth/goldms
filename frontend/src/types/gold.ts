export type GoldPurity =
  | 'MEELIN' // မီးလင်း (base)
  | 'K24' // 24K — same formula as မီးလင်း
  | 'PE15A' // 15A
  | 'PE15B' // 15B
  | 'PE14A' // 14A
  | 'PE13A' // 13A
  | 'PE12A' // 12A
  | 'K18' // 18K — same formula as 12A
  | 'THAI_GOLD'; // ထိုင်းရွှေ

export type ItemType = 'MYANMAR_GOLD' | 'THAI_GOLD' | 'WHITE_GOLD' | 'GEMS_JEWELRY';

export type ProductCategory =
  | 'NECKLACE'
  | 'RING'
  | 'BRACELET'
  | 'EARRING'
  | 'PENDANT'
  | 'BANGLE'
  | 'GOLD_BAR'
  | 'ANKLET';

export interface WeightKPY {
  kyat: number;
  pae: number;
  yway: number;
}

export interface DailyGoldPrice {
  id: string;
  gold_type: GoldPurity;
  name_mm: string;
  name_en: string;
  price_per_kyat: number;
  buy_price_per_kyat?: number;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  barcode: string;
  category: string;
  name: string;
  name_mm: string;
  weight_kyat: number;
  weight_pae: number;
  weight_yway: number;
  gemstone_weight_kyat?: number;
  gemstone_weight_pae?: number;
  gemstone_weight_yway?: number;
  /** Legacy total wastage (also = craft + profit) */
  deduction_pae?: number;
  deduction_yway?: number;
  craft_deduction_pae?: number;
  craft_deduction_yway?: number;
  profit_deduction_pae?: number;
  profit_deduction_yway?: number;
  net_weight_kyat: number;
  net_weight_pae: number;
  net_weight_yway: number;
  purity: GoldPurity;
  item_type: ItemType;
  craftsmanship_fee: number;
  /** အမြတ်လက်ခ (Thai / Myanmar; stored MMK) */
  craftsmanship_profit_fee?: number;
  stone_price?: number;
  /** ကျောက်ဖိုးအမြတ် (stored MMK) */
  stone_profit_price?: number;
  selling_price_estimated: number;
  status: 'IN_STOCK' | 'SOLD' | 'RESERVED' | 'UNDER_PAWN' | 'SHOP_OUT' | 'WITH_GOLDSMITH';
  thai_weight_unit?: number;
  created_at: string;
  image_url?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  outstanding_balance: number;
}

export type TransactionType = 'SALE' | 'PURCHASE' | 'ORDER' | 'EXCHANGE' | 'PAWN' | 'SHOP_OUT';

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_id?: string;
  item_name: string;
  category: string;
  weight: WeightKPY;
  gemstone_weight?: WeightKPY;
  net_weight: WeightKPY;
  purity: GoldPurity;
  gold_price_snapshot: number;
  gold_amount?: number;
  craftsmanship_fee: number;
  stone_price?: number;
  /** MMK wastage/deduction on sale line (POS editable) */
  wastage_amount?: number;
  subtotal: number;
  item_type: ItemType;
  thai_weight_unit?: number;
  line_role?: 'NEW_ITEM' | 'TRADE_IN' | string;
}

export interface Transaction {
  id: string;
  invoice_no: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  transaction_type: TransactionType;
  items: TransactionItem[];
  gold_price_snapshot: number;
  craftsmanship_total: number;
  stone_total?: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  interest_rate?: number;
  credit_due_date?: string;
  is_installment?: boolean;
  payment_method: 'CASH' | 'KPAY' | 'WAVEPAY' | 'BANK_TRANSFER' | 'CARD';
  notes?: string;
  created_at: string;
}

export interface CustomOrder {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  item_type: string;
  description: string;
  purity: GoldPurity;
  target_weight: WeightKPY;
  craftsmanship_fee: number;
  deposit_amount: number;
  estimated_total_price: number;
  remaining_balance: number;
  order_date: string;
  due_date: string;
  status: 'PENDING' | 'IN_PRODUCTION' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';
  gold_rate_snapshot: number;
  created_at: string;
}

export type GoldsmithSourceType = 'INVENTORY' | 'ORDER' | 'OLD_GOLD';
export type GoldsmithJobStatus = 'SENT' | 'RETURNED' | 'HANDED_OVER';

export interface GoldsmithJob {
  id: string;
  job_no: string;
  source_type: GoldsmithSourceType;
  status: GoldsmithJobStatus;
  inventory_item_id?: string;
  order_id?: string;
  sale_transaction_id?: string;
  returned_inventory_id?: string;
  item_name: string;
  category: string;
  purity: GoldPurity | string;
  item_type: ItemType | string;
  weight: WeightKPY;
  thai_weight_unit?: number;
  source_grams: number;
  source_purity?: string;
  source_category?: string;
  craft_fee: number;
  fee_paid: boolean;
  fee_paid_at?: string;
  /** Expected date goldsmith should return the piece */
  return_due_date?: string;
  notes?: string;
  sent_at: string;
  returned_at?: string;
  handed_over_at?: string;
  created_at: string;
  /** Joined labels for UI */
  order_no?: string;
  customer_name?: string;
  inventory_barcode?: string;
}

export interface PawnRecord {
  id: string;
  pawn_ticket_no: string;
  vno?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  item_name: string;
  item_type?: string;
  gold_kind?: string;
  weight: WeightKPY;
  weight_grams?: number;
  purity: GoldPurity;
  evaluated_value: number;
  loan_amount: number;
  loan_amount_baht?: number;
  monthly_interest_rate: number;
  loss_months?: number;
  start_date: string;
  due_date: string;
  last_interest_date?: string;
  next_interest_date?: string;
  status: 'ACTIVE' | 'REDEEMED' | 'OVERDUE' | 'CONFISCATED';
  accrued_interest: number;
  interest_paid_kyat?: number;
  interest_paid_baht?: number;
  redeem_date?: string;
  redeem_months?: number;
  redeem_days?: number;
  redeem_interest_kyat?: number;
  redeem_interest_baht?: number;
  discount_kyat?: number;
  discount_baht?: number;
  redeem_total_kyat?: number;
  redeem_total_baht?: number;
  notes?: string;
  customer_signature?: string;
  owner_signature?: string;
}

export interface PawnInterestPayment {
  id: string;
  pawn_id: string;
  voucher_no: string;
  payment_date: string;
  months_paid: number;
  days_paid?: number;
  interest_kyat: number;
  interest_baht: number;
  interest_rate: number;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  item_name?: string;
  item_type?: string;
  gold_kind?: string;
  purity?: string;
  weight?: WeightKPY;
  weight_grams?: number;
  loan_amount?: number;
  loan_amount_baht?: number;
  vno?: string;
  pawn_ticket_no?: string;
  due_date?: string;
  last_interest_date?: string;
  next_interest_date?: string;
  created_at?: string;
}

export interface FinancialLedger {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category:
    | 'GOLD_SALE'
    | 'GOLD_PURCHASE'
    | 'CUSTOM_ORDER'
    | 'PAWN_INTEREST'
    | 'STAFF_SALARY'
    | 'UTILITIES'
    | 'RENT'
    | 'OTHER_INCOME'
    | 'OTHER_EXPENSE'
    | string;
  amount: number;
  description: string;
  reference_no?: string;
  date: string;
}

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type CategoryGroup = 'PRODUCT' | 'GOLD_CLASS' | 'OTHER';

export interface ShopSettings {
  /** 1 ကျပ် = N grams (Myanmar) */
  kyat_to_grams: number;
  /**
   * Header Baht FX “buy” rate (scale /100000).
   * Used for: item MMK→Baht, Thai gold Baht→MMK.
   */
  baht_to_mmk_buy: number;
  /**
   * Header Baht FX “sell” rate (scale /100000).
   * Used for: item Baht→MMK, Meelin MMK→Baht display.
   */
  baht_to_mmk_sell: number;
  /** ထိုင်းရွှေ price entered in Baht (Header); MMK derived via buy rate */
  thai_gold_baht: number;
}

export interface MasterCategory {
  id: string;
  code: string;
  name_mm: string;
  name_en: string;
  category_group: CategoryGroup;
  description?: string;
  sort_order: number;
  is_active: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionModule {
  id: string;
  module_key: string;
  name_mm: string;
  name_en: string;
  sort_order: number;
}

export interface RolePermission {
  id: string;
  role: UserRole;
  module_key: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  name_mm?: string;
  name_en?: string;
}

export interface StaffUser {
  id: string;
  username: string;
  name: string;
  nameMM: string;
  role: UserRole;
  phone?: string;
  avatarColor: string;
  is_active?: boolean;
  permissions?: RolePermission[];
}
