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
router.put('/orders/:id', shopController.updateOrder);
router.patch('/orders/:id/status', shopController.updateOrderStatus);

router.get('/goldsmith-jobs', shopController.listGoldsmithJobs);
router.get('/goldsmith-jobs/old-gold-available', shopController.oldGoldAvailable);
router.post('/goldsmith-jobs', shopController.createGoldsmithJob);
router.post('/goldsmith-jobs/:id/return', shopController.returnGoldsmithJob);
router.post('/goldsmith-jobs/:id/handoff', shopController.handoffGoldsmithJob);
router.post('/goldsmith-jobs/:id/cancel', shopController.cancelGoldsmithJob);

router.get('/old-gold/merchant-returns', shopController.listMerchantReturns);
router.post('/old-gold/merchant-returns', shopController.createMerchantReturn);
router.put('/old-gold/merchant-returns/:id', shopController.updateMerchantReturn);
router.delete('/old-gold/merchant-returns/:id', shopController.deleteMerchantReturn);

router.get('/old-gold/shop-transfers', shopController.listShopTransfers);
router.post('/old-gold/shop-transfers', shopController.createShopTransfer);
router.put('/old-gold/shop-transfers/:id', shopController.updateShopTransfer);
router.delete('/old-gold/shop-transfers/:id', shopController.deleteShopTransfer);

router.get('/old-gold/melts', shopController.listMelts);
router.post('/old-gold/melts', shopController.createMelt);
router.put('/old-gold/melts/:id', shopController.updateMelt);
router.delete('/old-gold/melts/:id', shopController.deleteMelt);

router.get('/old-gold/other-outflows', shopController.listOtherOutflows);
router.post('/old-gold/other-outflows', shopController.createOtherOutflow);
router.put('/old-gold/other-outflows/:id', shopController.updateOtherOutflow);
router.delete('/old-gold/other-outflows/:id', shopController.deleteOtherOutflow);

router.get('/pawns', shopController.listPawns);
router.get('/pawns/interest-payments', shopController.listPawnInterestPayments);
router.delete('/pawns/interest-payments/:id', shopController.deletePawnInterestPayment);
router.post('/pawns/bulk', shopController.addPawnsBulk);
router.post('/pawns', shopController.addPawn);
router.put('/pawns/:id', shopController.updatePawn);
router.delete('/pawns/:id', shopController.deletePawn);
router.post('/pawns/:id/interest', shopController.payPawnInterest);
router.post('/pawns/:id/redeem', shopController.redeemPawn);
router.delete('/pawns/:id/redeem', shopController.deletePawnRedeem);
router.post('/pawns/:id/confiscate', shopController.confiscatePawn);

router.get('/ledger', shopController.listLedger);
router.post('/ledger', shopController.addLedger);
router.put('/ledger/:id', shopController.updateLedger);
router.delete('/ledger/:id', shopController.deleteLedger);

router.get('/credit-debts', shopController.listCreditDebts);
router.post('/credit-debts', shopController.addCreditDebt);
router.get('/credit-debts/:id', shopController.getCreditDebt);
router.put('/credit-debts/:id', shopController.updateCreditDebt);
router.delete('/credit-debts/:id', shopController.deleteCreditDebt);
router.post('/credit-debts/:id/payments', shopController.addCreditDebtPayment);
router.delete('/credit-debts/:id/payments/:paymentId', shopController.deleteCreditDebtPayment);

router.post('/calc/valuation', shopController.calcValuation);
router.post('/calc/thai', shopController.calcThai);

router.get('/reports/summary', shopController.reportSummary);
router.get('/reports/financial', shopController.reportFinancial);
router.get('/reports/sales-performance', shopController.reportSalesPerformance);

export default router;
