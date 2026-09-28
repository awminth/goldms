import React, { useEffect, useMemo, useState } from 'react';
import { useGoldShop } from '../context/GoldShopContext';
import { useDialog } from '../context/DialogContext';
import {
  MasterCategory,
  CategoryGroup,
  PermissionModule,
  RolePermission,
  StaffUser,
  UserRole,
  Customer,
} from '../types/gold';
import {
  Settings2,
  Tags,
  Users,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Check,
  Search,
  Power,
  Scale,
  Contact,
} from 'lucide-react';
import { formatMMK, KYAT_TO_GRAMS, gramsToKpy } from '../utils/goldCalculations';
import { useClientPagination } from '../hooks/useClientPagination';
import { PaginationBar } from './PaginationBar';
import { ModalOverlay } from './ModalOverlay';

type SetupTab = 'categories' | 'item-types' | 'users' | 'customers' | 'permissions' | 'unit-conversion';
type SetupSection = 'categories' | 'item-types' | 'settings';

const ROLES: UserRole[] = ['OWNER', 'MANAGER', 'CASHIER'];

interface SetupViewProps {
  section?: SetupSection;
  initialTab?: SetupTab;
}

export const SetupView: React.FC<SetupViewProps> = ({
  section = 'categories',
  initialTab,
}) => {
  const {
    language,
    masterCategories,
    staffUsers,
    customers,
    permissionModules,
    rolePermissions,
    shopSettings,
    currentUser,
    can,
    createMasterCategory,
    updateMasterCategory,
    deleteMasterCategory,
    createStaffUser,
    updateStaffUser,
    deleteStaffUser,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    saveRolePermissions,
    updateShopSettings,
  } = useGoldShop();

  const defaultTab: SetupTab =
    initialTab ||
    (section === 'item-types'
      ? 'item-types'
      : section === 'settings'
        ? 'users'
        : 'categories');

  const [tab, setTab] = useState<SetupTab>(defaultTab);

  useEffect(() => {
    setTab(defaultTab);
  }, [section, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const title =
    section === 'categories'
      ? language === 'MM'
        ? 'Categories (ရွှေပဲရည်)'
        : 'Categories'
      : section === 'item-types'
        ? language === 'MM'
          ? 'ပစ္စည်းအမျိုးအစား'
          : 'Item Types'
        : language === 'MM'
          ? 'Setup စီမံခန့်ခွဲမှု'
          : 'Setup';

  const subtitle =
    section === 'categories'
      ? language === 'MM'
        ? 'မီးလင်း၊ 24K၊ 15A၊ 15B၊ 14A၊ 13A၊ 12A၊ 18K၊ ထိုင်းရွှေ'
        : 'Meelin, 24K, 15A, 15B, 14A, 13A, 12A, 18K, Thai Gold'
      : section === 'item-types'
        ? language === 'MM'
          ? 'လက်စွပ်၊ ဆွဲကြိုး စသည့် ပစ္စည်းအမျိုးအစားများကို စီမံပါ'
          : 'Manage jewelry item types (rings, necklaces, etc.)'
        : language === 'MM'
          ? 'ဖောက်သည်၊ အသုံးပြုသူ၊ ယူနစ်နှင့် CRUD ခွင့်ပြုချက်'
          : 'Customers, staff, unit conversion, and permissions';

  const showSettingsTabs = section === 'settings';
  const settingsTabs = [
    {
      id: 'customers' as SetupTab,
      mm: 'ဖောက်သည်',
      en: 'Customers',
      icon: Contact,
      visible: can('customers', 'read'),
    },
    {
      id: 'users' as SetupTab,
      mm: 'အသုံးပြုသူအကောင့်',
      en: 'User Accounts',
      icon: Users,
      visible: can('staff', 'read'),
    },
    {
      id: 'unit-conversion' as SetupTab,
      mm: 'ယူနစ်ပြောင်းလဲမှု',
      en: 'Unit Conversion',
      icon: Scale,
      visible: can('unit_conversion', 'read') || can('master', 'read'),
    },
    {
      id: 'permissions' as SetupTab,
      mm: 'ခွင့်ပြုချက် (CRUD)',
      en: 'Permissions',
      icon: ShieldCheck,
      visible: can('permissions', 'read'),
    },
  ].filter((t) => t.visible);

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {section === 'settings' ? (
            <Settings2 className="w-5 h-5 text-[#D4AF37]" />
          ) : (
            <Tags className="w-5 h-5 text-[#D4AF37]" />
          )}
          {title}
        </h2>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>

      {showSettingsTabs && settingsTabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {settingsTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                  active
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white border-transparent'
                    : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {language === 'MM' ? t.mm : t.en}
              </button>
            );
          })}
        </div>
      )}

      {section === 'categories' && can('master', 'read') && (
        <CategoriesPanel
          language={language}
          lockedGroup="GOLD_CLASS"
          titleMM="ရွှေပဲရည် Categories"
          titleEN="Gold Purity Categories"
          addLabelMM="Category အသစ်"
          addLabelEN="Add Category"
          categories={masterCategories.filter((c) => c.category_group === 'GOLD_CLASS')}
          canCreate={can('master', 'create')}
          canUpdate={can('master', 'update')}
          canDelete={can('master', 'delete')}
          onCreate={createMasterCategory}
          onUpdate={updateMasterCategory}
          onDelete={deleteMasterCategory}
        />
      )}

      {section === 'item-types' && can('master', 'read') && (
        <CategoriesPanel
          language={language}
          lockedGroup="PRODUCT"
          titleMM="ပစ္စည်းအမျိုးအစား"
          titleEN="Item Types"
          addLabelMM="ပစ္စည်းအမျိုးအစား အသစ်"
          addLabelEN="Add Item Type"
          categories={masterCategories.filter(
            (c) => (c.category_group || 'PRODUCT') === 'PRODUCT' || c.category_group === 'OTHER'
          )}
          canCreate={can('master', 'create')}
          canUpdate={can('master', 'update')}
          canDelete={can('master', 'delete')}
          onCreate={createMasterCategory}
          onUpdate={updateMasterCategory}
          onDelete={deleteMasterCategory}
        />
      )}

      {section === 'settings' && tab === 'customers' && can('customers', 'read') && (
        <CustomersPanel
          language={language}
          customers={customers}
          canCreate={can('customers', 'create')}
          canUpdate={can('customers', 'update')}
          canDelete={can('customers', 'delete')}
          onCreate={async (name, phone, address, nrc) => {
            await addCustomer(name, phone, address, nrc);
          }}
          onUpdate={updateCustomer}
          onDelete={deleteCustomer}
        />
      )}

      {section === 'settings' && tab === 'users' && can('staff', 'read') && (
        <UsersPanel
          language={language}
          staff={staffUsers}
          currentUserId={currentUser?.id}
          canCreate={can('staff', 'create')}
          canUpdate={can('staff', 'update')}
          canDelete={can('staff', 'delete')}
          onCreate={createStaffUser}
          onUpdate={updateStaffUser}
          onDelete={deleteStaffUser}
        />
      )}

      {section === 'settings' &&
        tab === 'unit-conversion' &&
        (can('unit_conversion', 'read') || can('master', 'read')) && (
        <UnitConversionPanel
          language={language}
          settings={shopSettings}
          canUpdate={can('unit_conversion', 'update') || can('master', 'update')}
          onSave={updateShopSettings}
        />
      )}

      {section === 'settings' && tab === 'permissions' && can('permissions', 'read') && (
        <PermissionsPanel
          language={language}
          modules={permissionModules}
          rolePermissions={rolePermissions}
          canUpdate={can('permissions', 'update')}
          onSave={saveRolePermissions}
        />
      )}
    </div>
  );
};

function UnitConversionPanel({
  language,
  settings,
  canUpdate,
  onSave,
}: {
  language: 'MM' | 'EN';
  settings: { kyat_to_grams: number };
  canUpdate: boolean;
  onSave: (data: { kyat_to_grams: number }) => Promise<void>;
}) {
  const [kyatG, setKyatG] = useState(String(settings.kyat_to_grams || KYAT_TO_GRAMS));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setKyatG(String(settings.kyat_to_grams || KYAT_TO_GRAMS));
  }, [settings]);

  const exampleGrams = Number(kyatG) || KYAT_TO_GRAMS;
  const exampleKpy = gramsToKpy(exampleGrams, exampleGrams);

  const handleSave = async () => {
    const g = Number(kyatG);
    if (!Number.isFinite(g) || g <= 0) {
      setMsg(language === 'MM' ? 'တန်ဖိုးမှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid positive value');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await onSave({ kyat_to_grams: g });
      setMsg(language === 'MM' ? 'သိမ်းဆည်းပြီးပါပြီ' : 'Saved');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5 max-w-xl">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-[#D4AF37]" />
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">
          {language === 'MM' ? 'ယူနစ်ပြောင်းလဲမှု' : 'Unit Conversion'}
        </h3>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200">
          {language === 'MM' ? 'Gram ↔ ကျပ် / ပဲ / ရွေး' : 'Gram ↔ Kyat / Pae / Yway'}
        </h4>
        <p className="text-xs text-gray-500">
          {language === 'MM'
            ? '၁ ကျပ် = ဘယ်နှစ်ဂရမ်။ Inventory Gram ရိုက်ရင် ဤနှုန်းဖြင့် ပြောင်းပေးပါမည်။'
            : 'Grams per 1 kyat used for inventory conversion.'}
        </p>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block font-semibold">
            {language === 'MM' ? '၁ ကျပ် = ? ဂရမ်' : '1 Kyat = ? grams'}
          </label>
          <input
            type="number"
            min={0.001}
            step={0.001}
            value={kyatG}
            disabled={!canUpdate}
            onChange={(e) => setKyatG(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-sm font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
          />
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#141414] rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800">
          {language === 'MM' ? 'ဥပမာ:' : 'Example:'}{' '}
          <span className="font-mono font-bold">
            {exampleGrams} g = {exampleKpy.kyat} ကျပ် {exampleKpy.pae} ပဲ {exampleKpy.yway} ရွေး
          </span>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {language === 'MM'
            ? 'ဘတ်ဈေး (ဝယ်/ရောင်း) နှင့် ထိုင်းရွှေ ဘတ်တန်ဖိုးကို Header ပေါက်ဈေးတွင် ပြင်ပါ။'
            : 'Baht buy/sell rates and Thai gold Baht price are edited in the Header rates bar.'}
        </p>
      </div>

      {canUpdate && (
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-4 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {language === 'MM' ? 'သိမ်းမည်' : 'Save'}
        </button>
      )}
      {msg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>}
    </div>
  );
}

function CategoriesPanel({
  language,
  categories,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onUpdate,
  onDelete,
  lockedGroup,
  titleMM,
  titleEN,
  addLabelMM,
  addLabelEN,
}: {
  language: string;
  categories: MasterCategory[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: (data: Omit<MasterCategory, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<MasterCategory>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  lockedGroup: CategoryGroup;
  titleMM: string;
  titleEN: string;
  addLabelMM: string;
  addLabelEN: string;
}) {
  const dialog = useDialog();
  const blank = {
    code: '',
    name_mm: '',
    name_en: '',
    category_group: lockedGroup,
    description: '',
    sort_order: 0,
    is_active: true,
  };

  const [editing, setEditing] = useState<MasterCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OFF'>('ALL');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const groupLabel = (g: CategoryGroup) => {
    if (language === 'MM') {
      if (g === 'PRODUCT') return 'ပစ္စည်းအမျိုးအစား';
      if (g === 'GOLD_CLASS') return 'ရွှေပဲရည်';
      return 'အခြား';
    }
    if (g === 'PRODUCT') return 'Item Type';
    if (g === 'GOLD_CLASS') return 'Gold Purity';
    return 'Other';
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (statusFilter === 'ACTIVE' && !c.is_active) return false;
      if (statusFilter === 'OFF' && c.is_active) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name_mm.toLowerCase().includes(q) ||
        c.name_en.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    });
  }, [categories, search, statusFilter]);

  const pager = useClientPagination(filtered, [filtered.length, search, statusFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...blank,
      sort_order: (categories.length + 1) * 10,
      category_group: lockedGroup,
    });
    setShowForm(true);
    setNotice(null);
  };

  const openEdit = (c: MasterCategory) => {
    setEditing(c);
    setForm({
      code: c.code,
      name_mm: c.name_mm,
      name_en: c.name_en,
      category_group: lockedGroup,
      description: c.description || '',
      sort_order: c.sort_order,
      is_active: c.is_active,
    });
    setShowForm(true);
    setNotice(null);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name_mm.trim()) {
      setNotice(language === 'MM' ? 'CODE နှင့် မြန်မာအမည် လိုအပ်သည်' : 'Code and Myanmar name are required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase().replace(/\s+/g, '_'),
        name_mm: form.name_mm.trim(),
        name_en: (form.name_en || form.name_mm).trim(),
        category_group: lockedGroup,
        description: form.description.trim(),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (editing) await onUpdate(editing.id, payload);
      else await onCreate(payload);
      setEditing(null);
      setShowForm(false);
      setForm({ ...blank, category_group: lockedGroup });
      setNotice(language === 'MM' ? 'သိမ်းဆည်းပြီးပါပြီ' : 'Saved');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: MasterCategory) => {
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'Category ဖျက်မည်' : 'Delete category',
      message:
        language === 'MM'
          ? `"${c.code}" ကို ဖျက်မလား? အသုံးပြုနေပါက ပိတ် (deactivate) လုပ်ပါမည်။`
          : `Delete "${c.code}"? If in use it will be deactivated instead.`,
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(c.id);
      setNotice(
        language === 'MM'
          ? 'ဖျက်ပြီး / အသုံးပြုနေပါက ပိတ်ထားပါသည်'
          : 'Deleted (or deactivated if in use)'
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c: MasterCategory) => {
    if (!canUpdate) return;
    setBusy(true);
    try {
      await onUpdate(c.id, { is_active: !c.is_active });
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    all: categories.length,
    active: categories.filter((c) => c.is_active).length,
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {language === 'MM' ? titleMM : titleEN}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {language === 'MM'
              ? `စုစုပေါင်း ${counts.all} · အသက်ဝင် ${counts.active}`
              : `Total ${counts.all} · Active ${counts.active}`}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="px-3 py-1.5 rounded-xl bg-[#D4AF37] text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'MM' ? addLabelMM : addLabelEN}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'MM' ? 'ရှာဖွေရန် (code / အမည်)...' : 'Search code / name...'}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'OFF')}
          className="px-2.5 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
        >
          <option value="ALL">{language === 'MM' ? 'အခြေအနေအားလုံး' : 'All status'}</option>
          <option value="ACTIVE">{language === 'MM' ? 'အသက်ဝင်' : 'Active'}</option>
          <option value="OFF">{language === 'MM' ? 'ပိတ်ထား' : 'Off'}</option>
        </select>
      </div>

      {notice && (
        <div className="text-[11px] px-3 py-2 rounded-xl bg-[#FAF8F2] dark:bg-[#201D17] border border-[#D4AF37]/25 text-[#996515] dark:text-amber-300">
          {notice}
        </div>
      )}

      {showForm && (canCreate || canUpdate) && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-800 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Tags className="w-4 h-4 text-[#D4AF37]" />
                {editing
                  ? language === 'MM'
                    ? `Category ပြင်ဆင်ရန် — ${editing.code}`
                    : `Edit Category — ${editing.code}`
                  : language === 'MM'
                    ? 'Category အသစ်ထည့်ရန်'
                    : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setShowForm(false);
                  setForm(blank);
                }}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {language === 'MM' ? 'ကုဒ် (Code) *' : 'Code *'}
                </label>
                <input
                  placeholder={language === 'MM' ? 'ဥပမာ — PE15A' : 'E.g. PE15A'}
                  value={form.code}
                  disabled={!!editing}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {language === 'MM' ? 'အမျိုးအစား' : 'Type'}
                </label>
                <div className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1A1A1A] font-semibold text-gray-700 dark:text-gray-200">
                  {groupLabel(lockedGroup)}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {language === 'MM' ? 'အမည် (မြန်မာ) *' : 'Name (Myanmar) *'}
                </label>
                <input
                  value={form.name_mm}
                  onChange={(e) => setForm({ ...form, name_mm: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {language === 'MM' ? 'အမည် (အင်္ဂလိပ်)' : 'Name (English)'}
                </label>
                <input
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {language === 'MM' ? 'အစဉ် (Sort)' : 'Sort'}
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="text-xs flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  {language === 'MM' ? 'အသက်ဝင် (Active)' : 'Active'}
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {language === 'MM' ? 'ဖော်ပြချက်' : 'Description'}
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={
                    language === 'MM'
                      ? 'ဥပမာ — ထည့်ရွှေ / 14K အမျိုးအစား'
                      : 'e.g. Deposit gold / 14K class'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setShowForm(false);
                  setForm(blank);
                }}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {language === 'MM' ? 'သိမ်းမည်' : 'Save'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="font-semibold">{language === 'MM' ? 'ကုဒ်' : 'Code'}</th>
              <th className="font-semibold">{language === 'MM' ? 'အမည်' : 'Name'}</th>
              <th className="font-semibold">{language === 'MM' ? 'အမျိုးအစား' : 'Type'}</th>
              <th className="font-semibold text-right">{language === 'MM' ? 'အစဉ်' : 'Sort'}</th>
              <th className="font-semibold text-right">{language === 'MM' ? 'အသုံး' : 'Used'}</th>
              <th className="font-semibold">{language === 'MM' ? 'အခြေအနေ' : 'Status'}</th>
              <th className="font-semibold">{language === 'MM' ? 'ဖော်ပြချက်' : 'Description'}</th>
              <th className="font-semibold text-right" />
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.length === 0 && (
              <tr>
                <td colSpan={8} className="!bg-transparent py-8 text-center text-gray-400">
                  {language === 'MM' ? 'စာရင်းမရှိသေးပါ' : 'No records found'}
                </td>
              </tr>
            )}
            {pager.pageItems.map((c) => (
              <tr key={c.id}>
                <td className="font-mono font-bold text-gray-900 dark:text-white">{c.code}</td>
                <td>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {language === 'MM' ? c.name_mm : c.name_en || c.name_mm}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {language === 'MM' ? c.name_en : c.name_mm}
                  </div>
                </td>
                <td>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      lockedGroup === 'GOLD_CLASS'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : lockedGroup === 'OTHER'
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    }`}
                  >
                    {groupLabel(lockedGroup)}
                  </span>
                </td>
                <td className="text-right font-mono">{c.sort_order}</td>
                <td className="text-right font-mono text-gray-600 dark:text-gray-300">{c.usage_count ?? 0}</td>
                <td>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.is_active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {c.is_active
                      ? language === 'MM'
                        ? 'အသက်ဝင်'
                        : 'ACTIVE'
                      : language === 'MM'
                        ? 'ပိတ်'
                        : 'OFF'}
                  </span>
                </td>
                <td className="text-gray-500 max-w-[200px] truncate">{c.description || '—'}</td>
                <td className="text-right whitespace-nowrap space-x-0.5">
                  {canUpdate && (
                    <button
                      type="button"
                      title={
                        c.is_active
                          ? language === 'MM'
                            ? 'ပိတ်မည်'
                            : 'Deactivate'
                          : language === 'MM'
                            ? 'ဖွင့်မည်'
                            : 'Activate'
                      }
                      onClick={() => void toggleActive(c)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 inline-flex"
                    >
                      <Power
                        className={`w-3.5 h-3.5 ${
                          c.is_active ? 'text-emerald-600' : 'text-gray-400'
                        }`}
                      />
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 inline-flex"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#D4AF37]" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(c)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 inline-flex"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar
          language={language === 'MM' ? 'MM' : 'EN'}
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          from={pager.from}
          to={pager.to}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      </div>
    </div>
  );
}

function CustomersPanel({
  language,
  customers,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onUpdate,
  onDelete,
}: {
  language: string;
  customers: Customer[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: (name: string, phone: string, address: string, nrc?: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Customer>) => Promise<Customer>;
  onDelete: (id: string) => Promise<void>;
}) {
  const dialog = useDialog();
  const blank = { name: '', phone: '', nrc: '', address: '' };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.nrc || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  const pager = useClientPagination(filtered, [query, customers.length]);

  const openNew = () => {
    setEditingId(null);
    setForm(blank);
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, nrc: c.nrc || '', address: c.address || '' });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(blank);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await onUpdate(editingId, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          nrc: form.nrc.trim(),
          address: form.address.trim(),
        });
      } else {
        await onCreate(
          form.name.trim(),
          form.phone.trim() || 'N/A',
          form.address.trim(),
          form.nrc.trim()
        );
      }
      closeForm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-wrap gap-2 items-center justify-between">
        <div className="relative min-w-[220px] flex-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === 'MM' ? 'အမည် / ဖုန်း ရှာရန်…' : 'Search name / phone…'}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212]"
          />
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'MM' ? 'ဖောက်သည် အသစ်' : 'Add Customer'}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-[#141414] text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">{language === 'MM' ? 'အမည်' : 'Name'}</th>
                <th className="text-left px-4 py-3">{language === 'MM' ? 'ဖုန်း' : 'Phone'}</th>
                <th className="text-left px-4 py-3">NRC</th>
                <th className="text-left px-4 py-3">{language === 'MM' ? 'လိပ်စာ' : 'Address'}</th>
                <th className="text-right px-4 py-3">{language === 'MM' ? 'လက်ကျန်' : 'Balance'}</th>
                <th className="text-center px-4 py-3 w-28">{language === 'MM' ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    {language === 'MM' ? 'ဖောက်သည်မရှိပါ' : 'No customers'}
                  </td>
                </tr>
              ) : (
                pager.pageItems.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-gray-900">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-4 py-2.5 font-mono">{c.phone}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600">{c.nrc || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-[220px] truncate">{c.address}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#996515]">
                      {formatMMK(c.outstanding_balance || 0)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                const ok = await dialog.confirm({
                                  title: language === 'MM' ? 'ဖောက်သည် ဖျက်မည်' : 'Delete customer',
                                  message:
                                    language === 'MM'
                                      ? `${c.name} ကို ဖျက်မလား?`
                                      : `Delete ${c.name}?`,
                                  confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
                                  cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
                                  danger: true,
                                });
                                if (ok) await onDelete(c.id);
                              })();
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-900">
          <PaginationBar
            language={language === 'MM' ? 'MM' : 'EN'}
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            from={pager.from}
            to={pager.to}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
        </div>
      </div>

      {showForm && (
        <ModalOverlay onBackdropClick={closeForm}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingId
                  ? language === 'MM'
                    ? 'ဖောက်သည် ပြင်မည်'
                    : 'Edit Customer'
                  : language === 'MM'
                    ? 'ဖောက်သည် အသစ်'
                    : 'New Customer'}
              </h3>
              <button type="button" onClick={closeForm} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[11px] font-bold text-gray-500">
              {language === 'MM' ? 'အမည်' : 'Name'}
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-sm"
              />
            </label>
            <label className="block text-[11px] font-bold text-gray-500">
              {language === 'MM' ? 'ဖုန်း' : 'Phone'}
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-sm"
              />
            </label>
            <label className="block text-[11px] font-bold text-gray-500">
              NRC / မှတ်ပုံတင်
              <input
                value={form.nrc}
                onChange={(e) => setForm((f) => ({ ...f, nrc: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-sm font-mono"
              />
            </label>
            <label className="block text-[11px] font-bold text-gray-500">
              {language === 'MM' ? 'လိပ်စာ' : 'Address'}
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700"
              >
                {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy || !form.name.trim()}
                onClick={() => void handleSave()}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] text-white disabled:opacity-50 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {language === 'MM' ? 'သိမ်းမည်' : 'Save'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function UsersPanel({
  language,
  staff,
  currentUserId,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onUpdate,
  onDelete,
}: {
  language: string;
  staff: StaffUser[];
  currentUserId?: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const dialog = useDialog();
  const blank = {
    username: '',
    name: '',
    name_mm: '',
    role: 'CASHIER' as UserRole,
    phone: '',
    password: '1234',
    is_active: true,
  };
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(blank);
    setShowForm(true);
  };

  const openEdit = (u: StaffUser) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      name: u.name,
      name_mm: u.nameMM,
      role: u.role,
      phone: u.phone || '',
      password: '',
      is_active: u.is_active !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(blank);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.username || !form.name) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username,
        name: form.name,
        name_mm: form.name_mm || form.name,
        role: form.role,
        phone: form.phone,
        is_active: form.is_active,
      };
      if (form.password) payload.password = form.password;
      if (editingId) await onUpdate(editingId, payload);
      else {
        if (!form.password) payload.password = '1234';
        await onCreate(payload);
      }
      closeForm();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (u: StaffUser) => {
    if (u.id === currentUserId) {
      await dialog.alert({
        title: language === 'MM' ? 'မရပါ' : 'Not allowed',
        message:
          language === 'MM'
            ? 'လက်ရှိ login အကောင့်ကို ဖျက်မရပါ'
            : 'Cannot delete the logged-in account',
      });
      return;
    }
    const ok = await dialog.confirm({
      title: language === 'MM' ? 'အကောင့် ဖျက်မည်' : 'Delete account',
      message:
        language === 'MM'
          ? `${u.username} အကောင့်ကို ဖျက်မလား?`
          : `Delete account ${u.username}?`,
      confirmLabel: language === 'MM' ? 'ဖျက်မည်' : 'Delete',
      cancelLabel: language === 'MM' ? 'မလုပ်ပါ' : 'Cancel',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(u.id);
    } catch (err) {
      await dialog.alert({
        title: language === 'MM' ? 'မအောင်မြင်ပါ' : 'Failed',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const pager = useClientPagination(staff, [staff.length]);

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">{language === 'MM' ? 'အသုံးပြုသူအကောင့်များ' : 'Staff User Accounts'}</h3>
        {canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="px-3 py-1.5 rounded-xl bg-[#D4AF37] text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {language === 'MM' ? 'အကောင့်အသစ်' : 'New User'}
          </button>
        )}
      </div>

      {showForm && (canCreate || canUpdate) && (
        <ModalOverlay>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-800 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4AF37]" />
                {editingId
                  ? language === 'MM'
                    ? 'အသုံးပြုသူ ပြင်ဆင်ရန်'
                    : 'Edit User'
                  : language === 'MM'
                    ? 'အကောင့်အသစ် ဖန်တီးရန်'
                    : 'Create New User'}
              </h3>
              <button type="button" onClick={closeForm} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">Username *</label>
                <input
                  value={form.username}
                  disabled={!!editingId}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                    {language === 'MM' ? 'အမည် *' : 'Name *'}
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                    {language === 'MM' ? 'အမည် (မြန်မာ)' : 'Name MM'}
                  </label>
                  <input
                    value={form.name_mm}
                    onChange={(e) => setForm({ ...form, name_mm: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-bold"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                    {language === 'MM' ? 'ဖုန်း' : 'Phone'}
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block font-semibold">
                  {editingId
                    ? language === 'MM'
                      ? 'Password အသစ် (ချန်လျှင် မပြောင်း)'
                      : 'New password (leave blank to keep)'
                    : 'PIN / Password'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
                />
              </div>
              <label className="text-xs flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                  {language === 'MM' ? 'အသက်ဝင် (Active)' : 'Active'}
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={closeForm}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                {language === 'MM' ? 'ပယ်ဖျက်' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-white text-xs font-bold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                {editingId
                  ? language === 'MM'
                    ? 'သိမ်းမည်'
                    : 'Save'
                  : language === 'MM'
                    ? 'ဖန်တီးမည်'
                    : 'Create'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
              <th className="py-2">Username</th>
              <th className="py-2">{language === 'MM' ? 'အမည်' : 'Name'}</th>
              <th className="py-2">{language === 'MM' ? 'ရာထူး' : 'Role'}</th>
              <th className="py-2">{language === 'MM' ? 'ဖုန်း' : 'Phone'}</th>
              <th className="py-2">{language === 'MM' ? 'အခြေအနေ' : 'Status'}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 dark:border-gray-900">
                <td className="py-2 font-mono font-bold">{u.username}</td>
                <td className="py-2">
                  <div className="font-medium">
                    {language === 'MM' ? u.nameMM || u.name : u.name || u.nameMM}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {language === 'MM' ? u.name : u.nameMM}
                  </div>
                </td>
                <td className="py-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">{u.role}</span>
                </td>
                <td className="py-2 font-mono">{u.phone || '—'}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active !== false
                      ? language === 'MM'
                        ? 'အသက်ဝင်'
                        : 'ACTIVE'
                      : language === 'MM'
                        ? 'ပိတ်'
                        : 'DISABLED'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && u.id !== currentUserId && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(u)}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar
          language={language === 'MM' ? 'MM' : 'EN'}
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          from={pager.from}
          to={pager.to}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      </div>
    </div>
  );
}

function PermissionsPanel({
  language,
  modules,
  rolePermissions,
  canUpdate,
  onSave,
}: {
  language: string;
  modules: PermissionModule[];
  rolePermissions: RolePermission[];
  canUpdate: boolean;
  onSave: (
    role: UserRole,
    rows: Array<{
      module_key: string;
      can_create: boolean;
      can_read: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>
  ) => Promise<void>;
}) {
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [draft, setDraft] = useState<
    Record<string, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>
  >({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: typeof draft = {};
    for (const m of modules) {
      const row = rolePermissions.find((p) => p.role === role && p.module_key === m.module_key);
      next[m.module_key] = {
        can_create: !!row?.can_create,
        can_read: !!row?.can_read,
        can_update: !!row?.can_update,
        can_delete: !!row?.can_delete,
      };
    }
    setDraft(next);
  }, [role, modules, rolePermissions]);

  const rows = useMemo(() => modules, [modules]);

  const toggle = (moduleKey: string, action: keyof (typeof draft)[string]) => {
    if (!canUpdate) return;
    setDraft((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey]?.[action] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(
        role,
        Object.entries(draft).map(([module_key, flags]) => ({ module_key, ...flags }))
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm">{language === 'MM' ? 'Role အလိုက် Function CRUD' : 'Per-function CRUD by Role'}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {language === 'MM'
              ? 'Module တစ်ခုချင်း Create / Read / Update / Delete သတ်မှတ်ပါ'
              : 'Toggle Create, Read, Update, Delete for each module'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212]"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {canUpdate && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {language === 'MM' ? 'ခွင့်ပြုချက် သိမ်းမည်' : 'Save Permissions'}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-hidden">
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
              <th className="py-2 pr-3 w-[40%]">{language === 'MM' ? 'Function / Module' : 'Function'}</th>
              {(['can_create', 'can_read', 'can_update', 'can_delete'] as const).map((a) => (
                <th key={a} className="py-2 text-center w-[15%]">
                  {a.replace('can_', '').toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const flags = draft[m.module_key] || {
                can_create: false,
                can_read: false,
                can_update: false,
                can_delete: false,
              };
              return (
                <tr key={m.module_key} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {language === 'MM' ? m.name_mm : m.name_en}
                    </div>
                    <div className="font-mono text-[10px] text-gray-400">{m.module_key}</div>
                  </td>
                  {(['can_create', 'can_read', 'can_update', 'can_delete'] as const).map((action) => (
                    <td key={action} className="py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!canUpdate || role === 'OWNER'}
                        checked={role === 'OWNER' ? true : !!flags[action]}
                        onChange={() => toggle(m.module_key, action)}
                        className="w-4 h-4 accent-[#D4AF37]"
                        title={role === 'OWNER' ? 'OWNER always has full access' : undefined}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {role === 'OWNER' && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          {language === 'MM'
            ? 'OWNER role သည် function အားလုံးကို အပြည့်အဝ ရရှိသည် (ပြင်၍မရ)'
            : 'OWNER always has full CRUD on every module (locked).'}
        </p>
      )}
    </div>
  );
}
