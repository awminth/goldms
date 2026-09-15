import type { Pool } from 'mysql2/promise';
import { tableHasRows } from './tables.js';

export async function seedDatabase(pool: Pool): Promise<void> {
  if (await tableHasRows(pool, 'staff_users')) {
    console.log('Seed skipped (data already present).');
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO staff_users (id, username, name, name_mm, role, phone, password, avatar_color) VALUES
      (1, 'admin', 'Daw Aye Aye', 'ဒေါ်အေးအေး (ဆိုင်ရှင် / Owner)', 'OWNER', '09-977889900', '1234', 'from-amber-500 to-yellow-600'),
      (2, 'manager', 'U Myo Thant', 'ဦးမျိုးသန့် (မန်နေဂျာ / Manager)', 'MANAGER', '09-798887766', '1234', 'from-emerald-500 to-teal-600'),
      (3, 'cashier', 'Ma Hnin Yu', 'မနှင်းယု (ငွေကိုင် / Cashier)', 'CASHIER', '09-420011223', '1234', 'from-blue-500 to-indigo-600')`
    );

    await conn.query(`
      INSERT INTO daily_gold_prices (id, gold_type, name_mm, name_en, price_per_kyat, buy_price_per_kyat) VALUES
      (1, 'MEELIN', 'မီးလင်း', 'Meelin', 5750000, 5700000),
      (2, 'K24', '24K', '24K', 5750000, 5700000),
      (3, 'PE15A', '15A', '15A', 5411765, 5364706),
      (4, 'PE15B', '15B', '15B', 5257143, 5211429),
      (5, 'PE14A', '14A', '14A', 5031250, 4987500),
      (6, 'PE13A', '13A', '13A', 4671875, 4631250),
      (7, 'PE12A', '12A', '12A', 4312500, 4275000),
      (8, 'K18', '18K', '18K', 4312500, 4275000),
      (9, 'THAI_GOLD', 'ထိုင်းရွှေ', 'Thai Gold', 5520000, 5460000)
    `);

    await conn.query(`
      INSERT INTO customers (id, name, phone, address, outstanding_balance, created_at) VALUES
      (1, 'ဒေါ်ခင်လှိုင်', '09-450012345', 'အမှတ် (၄၂)၊ လမ်းမတော်လမ်း၊ ရန်ကုန်မြို့', 450000, '2026-08-15 09:30:00'),
      (2, 'ဦးကျော်ဇင်ဝင်း', '09-795678901', 'အမှတ် (၁၅)၊ ၇၃ လမ်း၊ ချမ်းအေးသာစံ၊ မန္တလေးမြို့', 1200000, '2026-08-20 14:15:00'),
      (3, 'မသီတာအေး', '09-250889922', 'အမှတ် (၁၀၈)၊ ကုန်သည်လမ်း၊ ကျောက်တံတား၊ ရန်ကုန်မြို့', 0, '2026-09-01 11:00:00'),
      (4, 'ဒေါ်နီလာဆွေ', '09-421155990', 'အမှတ် (၇)၊ ဗိုလ်တထောင်လမ်း၊ ရန်ကုန်မြို့', 780000, '2026-09-02 16:45:00')
    `);

    await conn.query(`
      INSERT INTO inventory_items (
        id, barcode, category, name, name_mm,
        weight_kyat, weight_pae, weight_yway, deduction_pae, deduction_yway,
        net_weight_kyat, net_weight_pae, net_weight_yway,
        purity, item_type, thai_weight_unit, craftsmanship_fee, selling_price_estimated, status, created_at
      ) VALUES
      (1, 'STG-804101', 'NECKLACE', 'Dragon Rope Necklace (နဂါးလိမ် ဆွဲကြိုး)', 'နဂါးလိမ် ဆွဲကြိုး',
        1, 2, 0, 0, 4, 1, 1, 4, 'MEELIN', 'MYANMAR_GOLD', NULL, 120000, 6420000, 'IN_STOCK', '2026-09-01 10:00:00'),
      (2, 'STG-804102', 'RING', 'Floral Diamond-cut Ring (ပန်းပွင့် လက်စွပ်)', 'ပန်းပွင့် လက်စွပ် (၁၅ ပဲ)',
        0, 4, 2, 0, 2, 0, 4, 0, 'PE15A', 'MYANMAR_GOLD', NULL, 65000, 1420000, 'IN_STOCK', '2026-09-02 11:30:00'),
      /* Thai gold: thai_weight_unit = grams; qty → separate barcodes (-01, -02, …); category = THAI_GOLD */
      (3, 'STG-804103-01', 'THAI_GOLD', 'Thai Classic Pattern Bracelet (ထိုင်းရွှေ ဟန်းချိန်း)', 'ထိုင်းရွှေ ဟန်းချိန်း 1 Kyat Standard',
        1, 0, 0, 0, 0, 1, 0, 0, 'THAI_GOLD', 'THAI_GOLD', 15.2, 95000, 5615000, 'IN_STOCK', '2026-09-03 12:00:00'),
      (4, 'STG-804103-02', 'THAI_GOLD', 'Thai Classic Pattern Bracelet (ထိုင်းရွှေ ဟန်းချိန်း)', 'ထိုင်းရွှေ ဟန်းချိန်း 1 Kyat Standard',
        1, 0, 0, 0, 0, 1, 0, 0, 'THAI_GOLD', 'THAI_GOLD', 15.2, 95000, 5615000, 'IN_STOCK', '2026-09-03 12:00:00'),
      (5, 'STG-804103-03', 'THAI_GOLD', 'Thai Classic Pattern Bracelet (ထိုင်းရွှေ ဟန်းချိန်း)', 'ထိုင်းရွှေ ဟန်းချိန်း 1 Kyat Standard',
        1, 0, 0, 0, 0, 1, 0, 0, 'THAI_GOLD', 'THAI_GOLD', 15.2, 95000, 5615000, 'IN_STOCK', '2026-09-03 12:00:00'),
      (6, 'STG-804104', 'BANGLE', 'Solid Carved Bangle (ကျောက်စီ လက်ကောက်)', 'ရွှေလက်ကောက်လုံး (မီးလင်း)',
        2, 0, 0, 0, 6, 1, 15, 2, 'MEELIN', 'MYANMAR_GOLD', NULL, 180000, 11450000, 'IN_STOCK', '2026-09-04 15:20:00'),
      (7, 'STG-804105', 'EARRING', 'Ruby Stud Gold Earrings (ပတ္တမြား နားကပ်)', 'ပတ္တမြား နားကပ် (၁၄ ပဲ)',
        0, 3, 4, 0, 4, 0, 3, 0, 'PE14A', 'MYANMAR_GOLD', NULL, 70000, 1112500, 'IN_STOCK', '2026-09-05 09:10:00'),
      (8, 'STG-804106-01', 'THAI_GOLD', 'Thai Gold Heart Pendant (ထိုင်းရွှေ 0.1 ကျပ် ဆွဲသီး)', 'ထိုင်းရွှေ အသဲပုံ ဆွဲသီး (၀.၁ ကျပ်)',
        0, 1, 5.76, 0, 0, 0, 1, 5.76, 'THAI_GOLD', 'THAI_GOLD', 1.52, 45000, 597000, 'IN_STOCK', '2026-09-06 14:40:00'),
      (9, 'STG-804106-02', 'THAI_GOLD', 'Thai Gold Heart Pendant (ထိုင်းရွှေ 0.1 ကျပ် ဆွဲသီး)', 'ထိုင်းရွှေ အသဲပုံ ဆွဲသီး (၀.၁ ကျပ်)',
        0, 1, 5.76, 0, 0, 0, 1, 5.76, 'THAI_GOLD', 'THAI_GOLD', 1.52, 45000, 597000, 'IN_STOCK', '2026-09-06 14:40:00'),
      (10, 'STG-804106-03', 'THAI_GOLD', 'Thai Gold Heart Pendant (ထိုင်းရွှေ 0.1 ကျပ် ဆွဲသီး)', 'ထိုင်းရွှေ အသဲပုံ ဆွဲသီး (၀.၁ ကျပ်)',
        0, 1, 5.76, 0, 0, 0, 1, 5.76, 'THAI_GOLD', 'THAI_GOLD', 1.52, 45000, 597000, 'IN_STOCK', '2026-09-06 14:40:00'),
      (11, 'STG-804106-04', 'THAI_GOLD', 'Thai Gold Heart Pendant (ထိုင်းရွှေ 0.1 ကျပ် ဆွဲသီး)', 'ထိုင်းရွှေ အသဲပုံ ဆွဲသီး (၀.၁ ကျပ်)',
        0, 1, 5.76, 0, 0, 0, 1, 5.76, 'THAI_GOLD', 'THAI_GOLD', 1.52, 45000, 597000, 'IN_STOCK', '2026-09-06 14:40:00'),
      (12, 'STG-804106-05', 'THAI_GOLD', 'Thai Gold Heart Pendant (ထိုင်းရွှေ 0.1 ကျပ် ဆွဲသီး)', 'ထိုင်းရွှေ အသဲပုံ ဆွဲသီး (၀.၁ ကျပ်)',
        0, 1, 5.76, 0, 0, 0, 1, 5.76, 'THAI_GOLD', 'THAI_GOLD', 1.52, 45000, 597000, 'IN_STOCK', '2026-09-06 14:40:00')
    `);

    await conn.query(`
      INSERT INTO transactions (
        id, invoice_no, customer_id, customer_name, customer_phone, transaction_type,
        gold_price_snapshot, craftsmanship_total, discount_amount, tax_amount,
        total_amount, paid_amount, remaining_amount, payment_method, notes, created_at
      ) VALUES
      (1, 'INV-202609-0891', 3, 'မသီတာအေး', '09-250889922', 'SALE',
        5750000, 120000, 20000, 0, 6400000, 6400000, 0, 'KPAY',
        'KBZPay ဖြင့် ငွေအပြေချေပြီး။ ရွှေစင်အာမခံ ကတ်ပြားပါ ပေးအပ်ပြီး။', '2026-09-07 11:20:00'),
      (2, 'PUR-202609-0210', 1, 'ဒေါ်ခင်လှိုင်', '09-450012345', 'PURCHASE',
        5360000, 0, 0, 0, 3852500, 3852500, 0, 'CASH',
        'ဧည့်သည်ထံမှ အလျော့တွက် ၄ ရွေး နုတ်ပြီး ငွေသားရှင်းပေးခဲ့သည်။', '2026-09-08 15:00:00')
    `);

    await conn.query(`
      INSERT INTO transaction_items (
        id, transaction_id, item_id, item_name, category,
        weight_kyat, weight_pae, weight_yway, net_weight_kyat, net_weight_pae, net_weight_yway,
        purity, gold_price_snapshot, craftsmanship_fee, subtotal, item_type
      ) VALUES
      (1, 1, NULL, 'နဂါးလိမ် ဆွဲကြိုး (1K 1P 4Y)', 'NECKLACE',
        1, 2, 0, 1, 1, 4, 'MEELIN', 5750000, 120000, 6420000, 'MYANMAR_GOLD'),
      (2, 2, NULL, 'အဟောင်းရွှေကြိုး (ပြန်ဝယ်)', 'NECKLACE',
        0, 12, 0, 0, 11, 4, 'PE15A', 5360000, 0, 3852500, 'MYANMAR_GOLD')
    `);

    await conn.query(`
      INSERT INTO orders (
        id, order_no, customer_id, customer_name, customer_phone, item_type, description, purity,
        target_weight_kyat, target_weight_pae, target_weight_yway, craftsmanship_fee,
        deposit_amount, estimated_total_price, remaining_balance, order_date, due_date, status, gold_rate_snapshot, created_at
      ) VALUES
      (1, 'ORD-202609-301', 2, 'ဦးကျော်ဇင်ဝင်း', '09-795678901', 'BANGLE',
        'အထူ ၂ ကျပ်သား ဟန်းချိန်း ပန်းထွင်းဒီဇိုင်း (Dragon Engraving)', 'MEELIN',
        2, 0, 0, 250000, 5000000, 11750000, 6750000, '2026-08-25', '2026-09-05', 'READY_FOR_PICKUP', 5750000, '2026-08-25 10:00:00'),
      (2, 'ORD-202609-302', 4, 'ဒေါ်နီလာဆွေ', '09-421155990', 'RING',
        'နဝရတ် ကိုးပါး စီချယ် လက်စွပ် (၁၅ ပဲရည် အောင်)', 'PE15A',
        0, 8, 0, 140000, 1500000, 2850000, 1350000, '2026-09-01', '2026-09-08', 'IN_PRODUCTION', 5420000, '2026-09-01 14:30:00'),
      (3, 'ORD-202609-303', 1, 'ဒေါ်ခင်လှိုင်', '09-450012345', 'NECKLACE',
        'ထိုင်းရွှေ ၇.၆ ယူနစ် လိမ်ကြိုး လည်ဆွဲ', 'THAI_GOLD',
        1, 0, 0, 90000, 3000000, 5610000, 2610000, '2026-09-05', '2026-09-18', 'PENDING', 5520000, '2026-09-05 16:00:00')
    `);

    await conn.query(`
      INSERT INTO pawn_records (
        id, pawn_ticket_no, vno, customer_id, customer_name, customer_phone, item_name,
        item_type, gold_kind, weight_kyat, weight_pae, weight_yway, weight_grams, purity,
        evaluated_value, loan_amount, loan_amount_baht, monthly_interest_rate, loss_months,
        start_date, due_date, last_interest_date, next_interest_date, status,
        accrued_interest, interest_paid_kyat, interest_paid_baht, notes
      ) VALUES
      (1, 'PWN-8801', 'VNO-8801', 4, 'ဒေါ်နီလာဆွေ', '09-421155990', 'ရွှေလက်စွပ် အသဲပုံ (၁၅ ပဲရည်)',
        'RING', 'MYANMAR', 0, 6, 0, 7.125000, 'PE15A',
        2030000, 1400000, 0, 5.0, 3,
        '2026-07-10', '2026-10-10', '2026-08-10', '2026-09-10', 'OVERDUE',
        140000, 70000, 0, 'အတိုး တစ်လ ပေးပြီး'),
      (2, 'PWN-8802', 'VNO-8802', 2, 'ဦးကျော်ဇင်ဝင်း', '09-795678901', 'ဆွဲကြိုး အခေါက် ၁ ကျပ်သား',
        'NECKLACE', 'MYANMAR', 1, 0, 0, 16.329000, 'MEELIN',
        5750000, 4000000, 0, 5.0, 3,
        '2026-08-15', '2026-11-15', '2026-09-15', '2026-10-15', 'ACTIVE',
        200000, 200000, 0, 'အတိုး နှစ်လ ပေးပြီး'),
      (3, 'PWN-8803', 'VNO-8803', 1, 'ဒေါ်ခင်လှိုင်', '09-450012345', 'ရွှေလက်ကောက်လုံး (မီးလင်း)',
        'BANGLE', 'MYANMAR', 2, 0, 0, 32.658000, 'MEELIN',
        11450000, 8000000, 0, 5.0, 3,
        '2026-09-01', '2026-12-01', NULL, '2026-10-01', 'ACTIVE',
        0, 0, 0, NULL),
      (4, 'PWN-8804', 'VNO-8804', 3, 'မသီတာအေး', '09-250889922', 'ထိုင်းရွှေ ဟန်းချိန်း 1 Kyat',
        'BRACELET', 'THAI', 1, 0, 0, 15.200000, 'THAI_GOLD',
        5520000, 3500000, 2500, 5.0, 3,
        '2026-08-20', '2026-11-20', '2026-09-20', '2026-10-20', 'ACTIVE',
        175000, 175000, 125, 'ဘတ်ငွေပါ'),
      (5, 'PWN-8805', 'VNO-8805', 4, 'ဒေါ်နီလာဆွေ', '09-421155990', 'ပတ္တမြား နားကပ် (၁၄ ပဲ)',
        'EARRING', 'MYANMAR', 0, 3, 4, 4.082000, 'PE14A',
        1112500, 700000, 0, 5.0, 3,
        '2026-06-01', '2026-09-01', '2026-08-01', NULL, 'REDEEMED',
        105000, 105000, 0, 'ပြန်ရွေးပြီး'),
      (6, 'PWN-8806', 'VNO-8806', 2, 'ဦးကျော်ဇင်ဝင်း', '09-795678901', 'ပန်းပွင့် လက်စွပ် (၁၅ ပဲ)',
        'RING', 'MYANMAR', 0, 4, 2, 4.490000, 'PE15A',
        1420000, 900000, 0, 5.0, 3,
        '2026-09-05', '2026-12-05', NULL, '2026-10-05', 'ACTIVE',
        0, 0, 0, NULL)
    `);

    await conn.query(`
      UPDATE pawn_records SET
        redeem_date = '2026-09-05',
        redeem_months = 3,
        redeem_interest_kyat = 105000,
        redeem_interest_baht = 0,
        discount_kyat = 5000,
        discount_baht = 0,
        redeem_total_kyat = 800000,
        redeem_total_baht = 0
      WHERE id = 5
    `);

    await conn.query(`
      INSERT INTO pawn_interest_payments (
        id, pawn_id, voucher_no, payment_date, months_paid,
        interest_kyat, interest_baht, interest_rate, notes
      ) VALUES
      (1, 1, 'INT-9001', '2026-08-10', 1, 70000, 0, 5.0, 'ပထမလ အတိုး'),
      (2, 2, 'INT-9002', '2026-09-15', 1, 200000, 0, 5.0, 'ပထမလ အတိုး'),
      (3, 2, 'INT-9003', '2026-10-15', 1, 200000, 0, 5.0, 'ဒုတိယလ အတိုး'),
      (4, 4, 'INT-9004', '2026-09-20', 1, 175000, 125, 5.0, 'ကျပ်+ဘတ်'),
      (5, 5, 'INT-9005', '2026-07-01', 1, 35000, 0, 5.0, 'ရွေးမီ အတိုး'),
      (6, 5, 'INT-9006', '2026-08-01', 2, 70000, 0, 5.0, 'နောက်ဆုံး အတိုး')
    `);

    await conn.query(`
      INSERT INTO financial_ledger (id, type, category, amount, description, reference_no, date) VALUES
      (1, 'INCOME', 'GOLD_SALE', 6400000, 'အရောင်းပြေစာ INV-202609-0891 (နဂါးလိမ် ဆွဲကြိုး ရောင်းချငွေ)', 'INV-202609-0891', '2026-09-07'),
      (2, 'EXPENSE', 'GOLD_PURCHASE', 3852500, 'အဝယ်ဘောင်ချာ PUR-202609-0210 (ဒေါ်ခင်လှိုင်ထံမှ ရွှေဟောင်းဝယ်ယူငွေ)', 'PUR-202609-0210', '2026-09-08'),
      (3, 'EXPENSE', 'UTILITIES', 145000, 'ဆိုင် မီတာခနှင့် အင်တာနက် လစဉ်ကြေး ပေးသွင်းခြင်း', NULL, '2026-09-08'),
      (4, 'INCOME', 'PAWN_INTEREST', 85000, 'ပေါင်နှံပစ္စည်း လစဉ်အတိုး ရငွေ (PWN-8790)', 'PWN-8790', '2026-09-09'),
      (5, 'EXPENSE', 'EQUIPMENT_ACID', 95000, 'ရွှေအရည်ကျို အက်ဆစ် (ရွှေစမ်းရည်) နှင့် ပန်းထိမ်သုံး ပစ္စည်းများ ဝယ်ယူစရိတ်', NULL, '2026-09-09')
    `);

    await conn.commit();
    console.log('Database seeded with demo data.');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
