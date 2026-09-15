import { Router } from 'express';
import { authController, healthController, shopController } from '../controllers/shop.controller.js';

const router = Router();

router.get('/health', healthController.check);

router.post('/auth/login', authController.login);
router.get('/auth/staff', authController.listStaff);
router.post('/auth/staff', authController.createStaff);
router.put('/auth/staff/:id', authController.updateStaff);
router.delete('/auth/staff/:id', authController.deleteStaff);

router.get('/auth/modules', authController.listModules);
router.get('/auth/permissions', authController.listAllPermissions);
router.get('/auth/permissions/:role', authController.listPermissionsByRole);
router.put('/auth/permissions', authController.updatePermissions);

router.get('/bootstrap', shopController.bootstrap);
router.post('/reset-demo', shopController.resetDemo);

router.get('/settings', shopController.getSettings);
router.put('/settings', shopController.updateSettings);

router.get('/master/categories', shopController.listCategories);
router.post('/master/categories', shopController.addCategory);
router.put('/master/categories/:id', shopController.updateCategory);
router.delete('/master/categories/:id', shopController.deleteCategory);

router.get('/prices', shopController.listPrices);
router.put('/prices', shopController.updatePrice);

router.get('/customers', shopController.listCustomers);
router.post('/customers', shopController.addCustomer);
router.put('/customers/:id', shopController.updateCustomer);
router.delete('/customers/:id', shopController.deleteCustomer);

router.get('/inventory', shopController.listInventory);
router.post('/inventory', shopController.addInventory);
router.post('/inventory/barcode', shopController.allocateBarcode);
router.post('/inventory/revalue', shopController.revalueInventory);
router.put('/inventory/:id', shopController.updateInventory);
router.delete('/inventory/:id', shopController.deleteInventory);

router.get('/transactions', shopController.listTransactions);
router.post('/transactions', shopController.createTransaction);
router.delete('/transactions/:id', shopController.deleteTransaction);

router.get('/orders', shopController.listOrders);
router.post('/orders', shopController.addOrder);
router.patch('/orders/:id/status', shopController.updateOrderStatus);

router.get('/pawns', shopController.listPawns);
router.get('/pawns/interest-payments', shopController.listPawnInterestPayments);
router.post('/pawns', shopController.addPawn);
router.put('/pawns/:id', shopController.updatePawn);
router.delete('/pawns/:id', shopController.deletePawn);
router.post('/pawns/:id/interest', shopController.payPawnInterest);
router.post('/pawns/:id/redeem', shopController.redeemPawn);

router.get('/ledger', shopController.listLedger);
router.post('/ledger', shopController.addLedger);
router.put('/ledger/:id', shopController.updateLedger);
router.delete('/ledger/:id', shopController.deleteLedger);

router.get('/tracking', shopController.listTracking);
router.post('/tracking', shopController.addTracking);
router.post('/tracking/:id/settle', shopController.settleTracking);

router.post('/calc/valuation', shopController.calcValuation);
router.post('/calc/thai', shopController.calcThai);

router.get('/reports/outstanding-credit', shopController.reportOutstanding);
router.get('/reports/delayed', shopController.reportDelayed);
router.get('/reports/summary', shopController.reportSummary);

export default router;
