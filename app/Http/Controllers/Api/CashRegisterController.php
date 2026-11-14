<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegisterShift;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashRegisterController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
        ]);
        $user = $request->user();
        $date = Carbon::parse($validated['date'] ?? today()->toDateString());
        $from = $date->copy()->startOfDay();
        $to = $date->copy()->endOfDay();

        $payments = Payment::query()
            ->where('received_by', $user->id)
            ->whereBetween('paid_at', [$from, $to])
            ->whereHas('order', fn ($query) => $query
                ->when(
                    $user->branch_id && ! $user->hasGlobalBranchAccess(),
                    fn ($orderQuery) => $orderQuery->where('branch_id', $user->branch_id),
                ));

        $paymentMethods = (clone $payments)
            ->selectRaw('method, COUNT(*) as payment_count, SUM(amount) as amount')
            ->groupBy('method')
            ->orderBy('method')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->method,
                'payment_count' => (int) $row->payment_count,
                'amount' => (float) $row->amount,
            ])
            ->values();

        $orders = Order::query()
            ->where('created_by', $user->id)
            ->whereBetween('created_at', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->when(
                $user->branch_id && ! $user->hasGlobalBranchAccess(),
                fn ($query) => $query->where('branch_id', $user->branch_id),
            );

        $currentShift = CashRegisterShift::query()
            ->where('active_user_id', $user->id)
            ->first();

        $shifts = CashRegisterShift::query()
            ->where('user_id', $user->id)
            ->whereBetween('opened_at', [$from, $to])
            ->with('branch:id,name')
            ->orderBy('opened_at')
            ->get()
            ->map(fn (CashRegisterShift $shift) => $this->shiftSummary($shift));

        return response()->json([
            'data' => [
                'date' => $date->toDateString(),
                'current_shift' => $currentShift
                    ? $this->shiftSummary($currentShift->load('branch:id,name'))
                    : null,
                'daily_report' => [
                    'order_count' => (clone $orders)->count(),
                    'order_value' => (float) (clone $orders)->sum('total'),
                    'payment_count' => (clone $payments)->count(),
                    'payments_received' => (float) (clone $payments)->sum('amount'),
                    'cash_received' => (float) (clone $payments)->where('method', 'cash')->sum('amount'),
                    'payment_methods' => $paymentMethods,
                    'recent_payments' => (clone $payments)
                        ->with(['order:id,order_number,customer_id', 'order.customer:id,name'])
                        ->latest('paid_at')
                        ->limit(20)
                        ->get(['id', 'payment_number', 'order_id', 'amount', 'method', 'paid_at']),
                ],
                'shifts' => $shifts,
            ],
        ]);
    }

    public function open(Request $request)
    {
        $validated = $request->validate([
            'opening_cash' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'opening_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $user = $request->user();

        $shift = DB::transaction(function () use ($validated, $user) {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if (CashRegisterShift::query()->where('active_user_id', $user->id)->exists()) {
                abort(409, 'Sesi kasir masih terbuka. Tutup sesi tersebut sebelum membuka sesi baru.');
            }

            return CashRegisterShift::create([
                'user_id' => $user->id,
                'active_user_id' => $user->id,
                'branch_id' => $user->branch_id,
                'opening_cash' => $validated['opening_cash'],
                'opening_notes' => $validated['opening_notes'] ?? null,
                'status' => 'open',
                'opened_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Kasir berhasil dibuka.',
            'data' => $this->shiftSummary($shift),
        ], 201);
    }

    public function close(Request $request)
    {
        $validated = $request->validate([
            'closing_cash' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'closing_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $user = $request->user();

        $shift = DB::transaction(function () use ($validated, $user) {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $shift = CashRegisterShift::query()
                ->where('active_user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if (! $shift) {
                throw ValidationException::withMessages([
                    'shift' => ['Tidak ada sesi kasir yang sedang terbuka.'],
                ]);
            }

            $totals = $this->paymentTotals($shift);
            $expectedCash = round((float) $shift->opening_cash + $totals['cash_received'], 2);
            $countedCash = round((float) $validated['closing_cash'], 2);

            $shift->update([
                'active_user_id' => null,
                'closing_cash' => $countedCash,
                'cash_received' => $totals['cash_received'],
                'total_received' => $totals['total_received'],
                'cash_variance' => round($countedCash - $expectedCash, 2),
                'closing_notes' => $validated['closing_notes'] ?? null,
                'status' => 'closed',
                'closed_at' => now(),
            ]);

            return $shift->fresh();
        });

        return response()->json([
            'message' => 'Kasir berhasil ditutup.',
            'data' => $this->shiftSummary($shift),
        ]);
    }

    private function shiftSummary(CashRegisterShift $shift): array
    {
        $totals = $this->paymentTotals($shift);
        $expectedCash = round((float) $shift->opening_cash + $totals['cash_received'], 2);

        return [
            'id' => $shift->id,
            'branch' => $shift->branch?->name,
            'status' => $shift->status,
            'opening_cash' => (float) $shift->opening_cash,
            'cash_received' => $totals['cash_received'],
            'total_received' => $totals['total_received'],
            'expected_cash' => $shift->closing_cash === null
                ? $expectedCash
                : round((float) $shift->opening_cash + (float) $shift->cash_received, 2),
            'closing_cash' => $shift->closing_cash === null ? null : (float) $shift->closing_cash,
            'cash_variance' => $shift->cash_variance === null ? null : (float) $shift->cash_variance,
            'payment_count' => $totals['payment_count'],
            'payment_methods' => $totals['payment_methods'],
            'opening_notes' => $shift->opening_notes,
            'closing_notes' => $shift->closing_notes,
            'opened_at' => $shift->opened_at,
            'closed_at' => $shift->closed_at,
        ];
    }

    private function paymentTotals(CashRegisterShift $shift): array
    {
        $rows = $shift->payments()
            ->selectRaw('method, COUNT(*) as payment_count, SUM(amount) as amount')
            ->groupBy('method')
            ->get();
        $paymentMethods = $rows->map(fn ($row) => [
            'method' => $row->method,
            'payment_count' => (int) $row->payment_count,
            'amount' => (float) $row->amount,
        ])->values()->all();

        return [
            'payment_count' => (int) $rows->sum('payment_count'),
            'cash_received' => (float) ($rows->firstWhere('method', 'cash')?->amount ?? 0),
            'total_received' => (float) $rows->sum('amount'),
            'payment_methods' => $paymentMethods,
        ];
    }
}
