<?php

use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\BusinessProfileController;
use App\Http\Controllers\Api\CashierDashboardController;
use App\Http\Controllers\Api\CashRegisterController;
use App\Http\Controllers\Api\ChatMessageController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\FinishingTypeController;
use App\Http\Controllers\Api\HRController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\OrderCustomerFileController;
use App\Http\Controllers\Api\OrderShipmentController;
use App\Http\Controllers\Api\OrderItemDesignController;
use App\Http\Controllers\Api\MarketplaceOrderImportController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductionMachineController;
use App\Http\Controllers\Api\QuoteApprovalController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Login
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1');

    Route::middleware('throttle:10,1')->group(function () {
        Route::get('/public/business-profile', [BusinessProfileController::class, 'publicShow']);
        Route::get('/public/quotes/{token}', [QuoteApprovalController::class, 'show']);
        Route::post('/public/quotes/{token}/decision', [QuoteApprovalController::class, 'decide']);
        Route::get('/public/designs/{token}', [OrderItemDesignController::class, 'showPublic']);
        Route::get('/public/designs/{token}/file', [OrderItemDesignController::class, 'file']);
        Route::post('/public/designs/{token}/decision', [OrderItemDesignController::class, 'decide']);
        Route::get('/public/orders/{token}/upload', [OrderCustomerFileController::class, 'showPublic']);
        Route::post('/public/orders/{token}/files', [OrderCustomerFileController::class, 'storePublic']);
    });

    // Route yang memerlukan login
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        Route::get('/cashier-dashboard', CashierDashboardController::class)
            ->middleware('can:dashboard.view');
        Route::get('/cash-register', [CashRegisterController::class, 'index'])
            ->middleware('can:payments.view');
        Route::post('/cash-register/open', [CashRegisterController::class, 'open'])
            ->middleware('can:payments.create');
        Route::post('/cash-register/close', [CashRegisterController::class, 'close'])
            ->middleware('can:payments.create');
        Route::get('/admin-dashboard', AdminDashboardController::class)
            ->middleware('can:dashboard.view');
        Route::get('/reports', [ReportController::class, 'index'])
            ->middleware('can:reports.view');
        Route::get('/reports/export', [ReportController::class, 'export'])
            ->middleware('can:reports.view');
        Route::get('/notifications', [NotificationController::class, 'index'])
            ->middleware(['can:dashboard.view', 'throttle:30,1']);
        Route::get('/chat/messages', [ChatMessageController::class, 'index'])
            ->middleware(['can:chat.access', 'throttle:60,1']);
        Route::post('/chat/messages', [ChatMessageController::class, 'store'])
            ->middleware(['can:chat.access', 'throttle:30,1']);
        Route::get('/chat/contacts', [ChatMessageController::class, 'contacts'])
            ->middleware(['can:chat.access', 'throttle:30,1']);
        Route::get('/chat/unread', [ChatMessageController::class, 'unread'])
            ->middleware(['can:chat.access', 'throttle:60,1']);
        Route::post('/chat/read', [ChatMessageController::class, 'markRead'])
            ->middleware(['can:chat.access', 'throttle:60,1']);
        Route::post('/chat/presence', [ChatMessageController::class, 'presence'])
            ->middleware(['can:chat.access', 'throttle:60,1']);
        Route::get('/business-profile', [BusinessProfileController::class, 'show'])
            ->middleware('can:settings.manage');
        Route::put('/business-profile', [BusinessProfileController::class, 'update'])
            ->middleware('can:settings.manage');

        Route::prefix('hr')->middleware('can:hr.manage')->group(function () {
            Route::get('/options', [HRController::class, 'options']);
            Route::get('/overview', [HRController::class, 'overview']);

            Route::get('/employees', [HRController::class, 'employees']);
            Route::post('/employees', [HRController::class, 'storeEmployee']);
            Route::put('/employees/{employee}', [HRController::class, 'updateEmployee']);

            Route::get('/attendance', [HRController::class, 'attendance']);
            Route::post('/attendance', [HRController::class, 'saveAttendance']);
            Route::get('/attendance/template', [HRController::class, 'attendanceCsvTemplate']);
            Route::post('/attendance/import/preview', [HRController::class, 'previewAttendanceImport'])
                ->middleware('throttle:10,1');
            Route::post('/attendance/import', [HRController::class, 'importAttendanceCsv'])
                ->middleware('throttle:10,1');

            Route::get('/leaves', [HRController::class, 'leaves']);
            Route::post('/leaves', [HRController::class, 'storeLeave']);
            Route::patch('/leaves/{leave}/review', [HRController::class, 'reviewLeave']);

            Route::get('/payroll', [HRController::class, 'payroll']);
            Route::post('/payroll/generate', [HRController::class, 'generatePayroll']);
            Route::put('/payroll/{payroll}', [HRController::class, 'updatePayroll']);
            Route::post('/payroll/{payroll}/approve', [HRController::class, 'approvePayroll']);
            Route::post('/payroll/{payroll}/mark-paid', [HRController::class, 'markPayrollPaid']);
        });

        // Manajemen pengguna
        Route::middleware('can:users.manage')->group(function () {
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::patch('/users/{user}', [UserController::class, 'update']);
        });

        // CUSTOMER - READ
        Route::middleware('can:customers.view')->group(function () {
            Route::get('/customers', [CustomerController::class, 'index']);
            Route::get('/customers/{customer}', [CustomerController::class, 'show']);
        });

        // CUSTOMER - CREATE, UPDATE, DELETE
        Route::middleware('can:customers.manage')->group(function () {
            Route::post('/customers', [CustomerController::class, 'store']);
            Route::put('/customers/{customer}', [CustomerController::class, 'update']);
            Route::patch('/customers/{customer}', [CustomerController::class, 'update']);
            Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
        });

        // PRODUCTS - READ
        Route::middleware('can:products.view')->group(function () {
            Route::get('/products', [ProductController::class, 'index']);
            Route::get('/products/{product}', [ProductController::class, 'show']);

            Route::get('/product-categories', [ProductCategoryController::class, 'index']);
            Route::get('/units', [UnitController::class, 'index']);
        });

        // PRODUCTS - CREATE, UPDATE, DELETE
        Route::middleware('can:products.manage')->group(function () {
            Route::post('/products', [ProductController::class, 'store']);
            Route::put('/products/{product}', [ProductController::class, 'update']);
            Route::patch('/products/{product}', [ProductController::class, 'update']);
            Route::delete('/products/{product}', [ProductController::class, 'destroy']);

            Route::post('/product-categories', [ProductCategoryController::class, 'store']);
            Route::put('/product-categories/{category}', [ProductCategoryController::class, 'update']);
            Route::delete('/product-categories/{category}', [ProductCategoryController::class, 'destroy']);

            Route::post('/units', [UnitController::class, 'store']);
            Route::put('/units/{unit}', [UnitController::class, 'update']);
            Route::delete('/units/{unit}', [UnitController::class, 'destroy']);
        });

        Route::middleware('can:branches.view')->group(function () {
            Route::get('/branches', [BranchController::class, 'index']);
        });

        Route::middleware('can:branches.manage')->group(function () {
            Route::post('/branches', [BranchController::class, 'store']);
            Route::put('/branches/{branch}', [BranchController::class, 'update']);
            Route::patch('/branches/{branch}', [BranchController::class, 'update']);
            Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);
        });

        Route::middleware('can:suppliers.view')->get('/suppliers', [SupplierController::class, 'index']);
        Route::middleware('can:suppliers.manage')->group(function () {
            Route::post('/suppliers', [SupplierController::class, 'store']);
            Route::put('/suppliers/{supplier}', [SupplierController::class, 'update']);
            Route::patch('/suppliers/{supplier}', [SupplierController::class, 'update']);
            Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy']);
        });

        Route::middleware('can:production.view')->get('/production-machines', [ProductionMachineController::class, 'index']);
        Route::middleware('can:production.manage')->group(function () {
            Route::post('/production-machines', [ProductionMachineController::class, 'store']);
            Route::put('/production-machines/{productionMachine}', [ProductionMachineController::class, 'update']);
            Route::patch('/production-machines/{productionMachine}', [ProductionMachineController::class, 'update']);
            Route::delete('/production-machines/{productionMachine}', [ProductionMachineController::class, 'destroy']);
            Route::post('/finishing-types', [FinishingTypeController::class, 'store']);
            Route::put('/finishing-types/{finishingType}', [FinishingTypeController::class, 'update']);
            Route::patch('/finishing-types/{finishingType}', [FinishingTypeController::class, 'update']);
            Route::delete('/finishing-types/{finishingType}', [FinishingTypeController::class, 'destroy']);
        });
        Route::middleware('can:production.view')->get('/finishing-types', [FinishingTypeController::class, 'index']);
        Route::middleware('can:orders.create')->get('/order-finishing-types', [FinishingTypeController::class, 'orderOptions']);

        // ORDERS
        Route::middleware('can:orders.view')->group(function () {
            Route::get('/orders', [OrderController::class, 'index']);
            Route::get('/orders/{order}', [OrderController::class, 'show']);
        });

        Route::middleware('can:orders.create')->group(function () {
            Route::post('/orders', [OrderController::class, 'store']);
            Route::get('/marketplace/orders/template', [MarketplaceOrderImportController::class, 'template']);
            Route::post('/marketplace/orders/import/preview', [MarketplaceOrderImportController::class, 'preview'])
                ->middleware('throttle:10,1');
            Route::post('/marketplace/orders/import', [MarketplaceOrderImportController::class, 'import'])
                ->middleware('throttle:10,1');
        });
        Route::post('/orders/{order}/approval-link', [OrderController::class, 'approvalLink'])
            ->middleware('can:orders.edit');
        Route::post('/orders/{order}/confirm-completion', [OrderController::class, 'confirmCompletion'])
            ->middleware('can:orders.edit');
        Route::post('/orders/{order}/customer-upload-link', [OrderCustomerFileController::class, 'createUploadLink'])
            ->middleware('can:orders.edit');
        Route::get('/orders/{order}/customer-files/{customerFile}/file', [OrderCustomerFileController::class, 'file']);
        Route::post('/orders/{order}/confirm-marketplace', [QuoteApprovalController::class, 'confirmMarketplace'])
            ->middleware('can:orders.edit');
        Route::put('/orders/{order}/shipment', [OrderShipmentController::class, 'update'])
            ->middleware('can:orders.edit');

        Route::middleware('can:production.view')->get('/work-orders', [WorkOrderController::class, 'index']);
        Route::middleware('can:production.manage')->patch('/work-orders/{workOrder}', [WorkOrderController::class, 'update']);
        Route::middleware('can:inventory.consume')->post('/work-orders/{workOrder}/materials', [InventoryController::class, 'consumeWorkOrder']);
        Route::middleware('can:designs.manage')->group(function () {
            Route::post('/order-items/{orderItem}/designs', [OrderItemDesignController::class, 'store']);
            Route::post('/order-items/{orderItem}/design-link', [OrderItemDesignController::class, 'reissueLink']);
        });

        Route::middleware('can:inventory.view')->group(function () {
            Route::get('/inventory/branches', [InventoryController::class, 'branches']);
            Route::get('/inventory/units', [InventoryController::class, 'units']);
            Route::get('/inventory/materials', [InventoryController::class, 'materials']);
            Route::get('/inventory/movements', [InventoryController::class, 'movements']);
        });
        Route::middleware('can:inventory.manage')->group(function () {
            Route::post('/inventory/materials', [InventoryController::class, 'storeMaterial']);
            Route::patch('/inventory/materials/{material}', [InventoryController::class, 'updateMaterial']);
            Route::post('/inventory/movements', [InventoryController::class, 'storeMovement']);
        });

        // PAYMENTS
        Route::middleware('can:payments.view')->group(function () {
            Route::get('/payments', [PaymentController::class, 'index']);
        });

        Route::middleware('can:payments.create')->group(function () {
            Route::post('/payments', [PaymentController::class, 'store']);
        });

    });
});
