import { DailyGoldPrice } from '../types/gold';

const meelinSell = 5750000;
const meelinBuy = 5700000;
const now = new Date().toISOString();

/** Offline / demo fallback prices — live app loads from API */
export const INITIAL_GOLD_PRICES: DailyGoldPrice[] = [
  {
    id: 'price-1',
    gold_type: 'MEELIN',
    name_mm: 'မီးလင်း',
    name_en: 'Meelin',
    price_per_kyat: meelinSell,
    buy_price_per_kyat: meelinBuy,
    updated_at: now,
  },
  {
    id: 'price-2',
    gold_type: 'K24',
    name_mm: '24K',
    name_en: '24K',
    price_per_kyat: meelinSell,
    buy_price_per_kyat: meelinBuy,
    updated_at: now,
  },
  {
    id: 'price-3',
    gold_type: 'PE15A',
    name_mm: '15A',
    name_en: '15A',
    price_per_kyat: Math.round((meelinSell * 16) / 17),
    buy_price_per_kyat: Math.round((meelinBuy * 16) / 17),
    updated_at: now,
  },
  {
    id: 'price-4',
    gold_type: 'PE15B',
    name_mm: '15B',
    name_en: '15B',
    price_per_kyat: Math.round((meelinSell * 16) / 17.5),
    buy_price_per_kyat: Math.round((meelinBuy * 16) / 17.5),
    updated_at: now,
  },
  {
    id: 'price-5',
    gold_type: 'PE14A',
    name_mm: '14A',
    name_en: '14A',
    price_per_kyat: Math.round((meelinSell * 14) / 16),
    buy_price_per_kyat: Math.round((meelinBuy * 14) / 16),
    updated_at: now,
  },
  {
    id: 'price-6',
    gold_type: 'PE13A',
    name_mm: '13A',
    name_en: '13A',
    price_per_kyat: Math.round((meelinSell * 13) / 16),
    buy_price_per_kyat: Math.round((meelinBuy * 13) / 16),
    updated_at: now,
  },
  {
    id: 'price-7',
    gold_type: 'PE12A',
    name_mm: '12A',
    name_en: '12A',
    price_per_kyat: Math.round((meelinSell * 12) / 16),
    buy_price_per_kyat: Math.round((meelinBuy * 12) / 16),
    updated_at: now,
  },
  {
    id: 'price-8',
    gold_type: 'K18',
    name_mm: '18K',
    name_en: '18K',
    price_per_kyat: Math.round((meelinSell * 12) / 16),
    buy_price_per_kyat: Math.round((meelinBuy * 12) / 16),
    updated_at: now,
  },
  {
    id: 'price-9',
    gold_type: 'THAI_GOLD',
    name_mm: 'ထိုင်းရွှေ',
    name_en: 'Thai Gold',
    price_per_kyat: 5520000,
    buy_price_per_kyat: 5460000,
    updated_at: now,
  },
];
