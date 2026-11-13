<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\ProductionMachineController;
use App\Http\Controllers\Api\FinishingTypeController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;

Route::prefix('v1')->group(function () {

    // Login
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1');

    // Route yang memerlukan login
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

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

        // ORDERS
        Route::middleware('can:orders.view')->group(function () {
            Route::get('/orders', [OrderController::class, 'index']);
            Route::get('/orders/{order}', [OrderController::class, 'show']);
        });

        Route::middleware('can:orders.create')->group(function () {
            Route::post('/orders', [OrderController::class, 'store']);
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

