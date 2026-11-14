<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\EmployeeLeaveRequest;
use App\Models\EmployeePayroll;
use App\Models\Branch;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HRController extends Controller
{
    public function options(Request $request)
    {
        $branches = Branch::query()
            ->when(
                $request->user()->branch_id && !$request->user()->hasRole('Owner'),
                fn (Builder $query) => $query->where('id', $request->user()->branch_id)
            )
            ->orderBy('name')
            ->get(['id', 'code', 'name']);
        $employees = $this->visibleEmployees($request)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'employee_code', 'name', 'branch_id']);

        return response()->json([
            'success' => true,
            'data' => ['branches' => $branches, 'employees' => $employees],
        ]);
    }

    public function overview(Request $request)
    {
        $period = now()->startOfMonth()->toDateString();

        return response()->json([
            'success' => true,
            'data' => [
                'active_employees' => $this->visibleEmployees($request)->where('is_active', true)->count(),
                'pending_leaves' => EmployeeLeaveRequest::where('status', 'pending')
                    ->whereHas('employee', fn (Builder $query) => $this->applyEmployeeScope($query, $request))
                    ->count(),
                'draft_payrolls' => EmployeePayroll::whereDate('period', $period)
                    ->where('status', 'draft')
                    ->whereHas('employee', fn (Builder $query) => $this->applyEmployeeScope($query, $request))
                    ->count(),
                'approved_payrolls' => EmployeePayroll::whereDate('period', $period)
                    ->whereIn('status', ['approved', 'paid'])
                    ->whereHas('employee', fn (Builder $query) => $this->applyEmployeeScope($query, $request))
                    ->count(),
            ],
        ]);
    }

    public function employees(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $employees = $this->visibleEmployees($request)
            ->with('branch:id,code,name')
            ->when($validated['search'] ?? null, function (Builder $query, string $search) {
                $query->where(function (Builder $query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('employee_code', 'like', "%{$search}%")
                        ->orWhere('department', 'like', "%{$search}%")
                        ->orWhere('position', 'like', "%{$search}%");
                });
            })
            ->when(
                isset($validated['status']),
                fn (Builder $query) => $query->where('is_active', $validated['status'] === 'active')
            )
            ->orderBy('name')
            ->paginate(25);

        return response()->json(['success' => true, 'data' => $employees]);
    }

    public function storeEmployee(Request $request)
    {
        $validated = $this->validateEmployee($request, creating: true);
        $validated['created_by'] = $request->user()->id;

        $employee = Employee::create($validated)->load('branch:id,code,name');

        return response()->json([
            'success' => true,
            'message' => 'Data karyawan berhasil ditambahkan.',
            'data' => $employee,
        ], 201);
    }

    public function updateEmployee(Request $request, int $employeeId)
    {
        $employee = $this->visibleEmployees($request)->findOrFail($employeeId);
        $validated = $this->validateEmployee($request, $employee);
        $employee->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Data karyawan berhasil diperbarui.',
            'data' => $employee->fresh()->load('branch:id,code,name'),
        ]);
    }

    public function attendance(Request $request)
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);
        $date = $validated['date'] ?? now()->toDateString();

        $employees = $this->visibleEmployees($request)
            ->where('is_active', true)
            ->with([
                'branch:id,code,name',
                'attendances' => fn ($query) => $query->whereDate('attendance_date', $date),
            ])
            ->orderBy('name')
            ->get()
            ->map(function (Employee $employee) {
                return [
                    'id' => $employee->id,
                    'employee_code' => $employee->employee_code,
                    'name' => $employee->name,
                    'department' => $employee->department,
                    'position' => $employee->position,
                    'branch' => $employee->branch,
                    'attendance' => $employee->attendances->first(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => ['date' => $date, 'employees' => $employees],
        ]);
    }

    public function saveAttendance(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'attendance_date' => ['required', 'date_format:Y-m-d'],
            'check_in' => ['nullable', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i'],
            'status' => ['required', Rule::in(['present', 'late', 'absent', 'leave', 'sick', 'permit'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->visibleEmployees($request)->findOrFail($validated['employee_id']);

        $attendance = EmployeeAttendance::query()
            ->where('employee_id', $validated['employee_id'])
            ->whereDate('attendance_date', $validated['attendance_date'])
            ->first();
        if (!$attendance) {
            $attendance = new EmployeeAttendance([
                'employee_id' => $validated['employee_id'],
                'attendance_date' => $validated['attendance_date'],
                'source' => 'manual',
            ]);
            $attendance->created_by = $request->user()->id;
        }
        $attendance->fill([
            'check_in' => $validated['check_in'] ?? null,
            'check_out' => $validated['check_out'] ?? null,
            'status' => $validated['status'],
            'notes' => $validated['notes'] ?? null,
            'updated_by' => $request->user()->id,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil disimpan.',
            'data' => $attendance,
        ]);
    }

    public function attendanceCsvTemplate()
    {
        $content = "\xEF\xBB\xBFemployee_code,attendance_date,check_in,check_out,status,notes\r\n";

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="template-absensi.csv"',
        ]);
    }

    public function previewAttendanceImport(Request $request)
    {
        $validated = $this->validateAttendanceImportRequest($request);
        $analysis = $this->analyzeAttendanceCsv(
            $validated['file'],
            $request,
            isset($validated['branch_id']) ? (int) $validated['branch_id'] : null,
        );

        return response()->json([
            'success' => true,
            'data' => $this->attendanceImportPreview($analysis),
        ]);
    }

    public function importAttendanceCsv(Request $request)
    {
        $validated = $this->validateAttendanceImportRequest($request);
        $analysis = $this->analyzeAttendanceCsv(
            $validated['file'],
            $request,
            isset($validated['branch_id']) ? (int) $validated['branch_id'] : null,
        );
        $preview = $this->attendanceImportPreview($analysis);

        if ($analysis['invalid'] > 0) {
            $messages = collect($analysis['rows'])
                ->filter(fn (array $row) => $row['errors'])
                ->take(10)
                ->map(fn (array $row) => 'Baris '.$row['line'].': '.implode(' ', $row['errors']))
                ->values()
                ->all();

            return response()->json([
                'success' => false,
                'message' => 'Impor dibatalkan karena ada baris yang tidak valid. Perbaiki file lalu unggah kembali.',
                'errors' => ['file' => $messages],
                'data' => $preview,
            ], 422);
        }

        $imported = DB::transaction(function () use ($analysis, $request) {
            $count = 0;
            foreach (array_chunk($analysis['import_rows'], 100) as $rows) {
                $count += DB::table('employee_attendances')->insertOrIgnore(
                    array_map(fn (array $row) => $row + [
                        'source' => 'csv',
                        'imported_at' => now(),
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ], $rows),
                );
            }

            return $count;
        });
        $skipped = $analysis['duplicates'] + count($analysis['import_rows']) - $imported;

        return response()->json([
            'success' => true,
            'message' => "{$imported} absensi diimpor; {$skipped} baris duplikat dilewati.",
            'data' => [
                'imported' => $imported,
                'skipped' => $skipped,
                'rows' => $preview['rows'],
                'rows_truncated' => $preview['rows_truncated'],
            ],
        ]);
    }

    private function validateAttendanceImportRequest(Request $request): array
    {
        return $request->validate([
            'file' => ['required', 'file', 'max:5120', 'extensions:csv,txt'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);
    }

    private function analyzeAttendanceCsv(UploadedFile $file, Request $request, ?int $branchId): array
    {
        $csv = $this->readAttendanceCsv($file);
        $normalized = [];
        $employeeCodes = [];

        foreach ($csv['rows'] as $row) {
            $data = [
                'employee_code' => trim($row['employee_code'] ?? ''),
                'attendance_date' => $this->normalizeAttendanceDate(trim($row['attendance_date'] ?? '')),
                'check_in' => $this->normalizeAttendanceTime(trim($row['check_in'] ?? '')),
                'check_out' => $this->normalizeAttendanceTime(trim($row['check_out'] ?? '')),
                'status' => strtolower(trim($row['status'] ?? '')),
                'notes' => trim($row['notes'] ?? '') ?: null,
            ];
            $validator = Validator::make($data, [
                'employee_code' => ['required', 'string', 'max:40'],
                'attendance_date' => ['required', 'date_format:Y-m-d'],
                'check_in' => ['nullable', 'date_format:H:i'],
                'check_out' => ['nullable', 'date_format:H:i'],
                'status' => ['required', Rule::in(['present', 'late', 'absent', 'leave', 'sick', 'permit'])],
                'notes' => ['nullable', 'string', 'max:2000'],
            ], [
                'employee_code.required' => 'Kode karyawan wajib diisi.',
                'attendance_date.required' => 'Tanggal absensi wajib diisi.',
                'attendance_date.date_format' => 'Tanggal harus berformat YYYY-MM-DD atau DD/MM/YYYY.',
                'check_in.date_format' => 'Jam masuk harus berformat HH:MM.',
                'check_out.date_format' => 'Jam pulang harus berformat HH:MM.',
                'status.required' => 'Status wajib diisi.',
                'status.in' => 'Status harus present, late, absent, leave, sick, atau permit.',
                'notes.max' => 'Catatan maksimal 2.000 karakter.',
            ], [
                'employee_code' => 'kode karyawan',
                'attendance_date' => 'tanggal absensi',
                'check_in' => 'jam masuk',
                'check_out' => 'jam pulang',
                'status' => 'status',
                'notes' => 'catatan',
            ]);
            $errors = $validator->errors()->all();
            if ($row['_column_error'] ?? false) {
                $errors[] = 'Jumlah kolom pada baris tidak sesuai dengan header.';
            }

            $entry = [
                'line' => $row['_line'],
                ...$data,
                'employee_id' => null,
                'duplicate' => false,
                'errors' => $errors,
            ];
            $normalized[] = $entry;

            if (!$errors) {
                $employeeCodes[] = strtoupper($data['employee_code']);
            }
        }

        $employees = $this->applyEmployeeScope(
            Employee::query(),
            $request,
            $branchId,
        )
            ->whereIn(DB::raw('UPPER(employee_code)'), array_values(array_unique($employeeCodes)))
            ->get(['id', 'employee_code']);
        $employeesByCode = $employees->keyBy(fn (Employee $employee) => strtoupper($employee->employee_code));

        $seenPairs = [];
        $validPairs = [];
        foreach ($normalized as $index => $row) {
            if ($row['errors']) {
                continue;
            }

            $employee = $employeesByCode->get(strtoupper($row['employee_code']));
            if (!$employee) {
                $normalized[$index]['errors'][] = 'Kode karyawan tidak ditemukan atau berada di luar cakupan cabang.';
                continue;
            }

            $normalized[$index]['employee_id'] = $employee->id;
            $key = $employee->id.'|'.$row['attendance_date'];
            if (isset($seenPairs[$key])) {
                $normalized[$index]['duplicate'] = true;
                $normalized[$index]['errors'][] = 'Duplikat dalam file; baris sebelumnya yang digunakan.';
                continue;
            }

            $seenPairs[$key] = true;
            $validPairs[] = [
                'index' => $index,
                'employee_id' => $employee->id,
                'attendance_date' => $row['attendance_date'],
            ];
        }

        $existingPairs = $this->existingAttendancePairs($validPairs);
        $importRows = [];
        $duplicates = 0;
        $invalid = 0;
        foreach ($normalized as $index => $row) {
            if ($row['errors']) {
                if ($row['duplicate']) {
                    $duplicates++;
                } else {
                    $invalid++;
                }
                continue;
            }

            $key = $row['employee_id'].'|'.$row['attendance_date'];
            if (isset($existingPairs[$key])) {
                $normalized[$index]['duplicate'] = true;
                $normalized[$index]['errors'][] = 'Absensi untuk karyawan dan tanggal ini sudah ada; data lama tidak ditimpa.';
                $duplicates++;
                continue;
            }

            $importRows[] = [
                'employee_id' => $row['employee_id'],
                'attendance_date' => $row['attendance_date'],
                'check_in' => $row['check_in'],
                'check_out' => $row['check_out'],
                'status' => $row['status'],
                'notes' => $row['notes'],
            ];
        }

        return [
            'rows' => $normalized,
            'import_rows' => $importRows,
            'invalid' => $invalid,
            'duplicates' => $duplicates,
        ];
    }

    private function readAttendanceCsv(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'rb');
        if ($handle === false) {
            throw ValidationException::withMessages(['file' => 'File CSV tidak dapat dibaca.']);
        }

        try {
            $firstLine = fgets($handle);
            if ($firstLine === false) {
                throw ValidationException::withMessages(['file' => 'File CSV kosong.']);
            }

            $delimiter = $this->attendanceCsvDelimiter($firstLine);
            rewind($handle);
            $headers = fgetcsv($handle, 0, $delimiter, '"', '');
            $headers = array_map(fn ($header) => $this->normalizeAttendanceCsvHeader($header), $headers ?: []);
            $required = ['employee_code', 'attendance_date', 'status'];
            if (array_diff($required, $headers)) {
                throw ValidationException::withMessages([
                    'file' => 'Header CSV wajib memuat employee_code, attendance_date, dan status. Unduh template untuk format lengkap.',
                ]);
            }
            if (count($headers) !== count(array_unique($headers))) {
                throw ValidationException::withMessages(['file' => 'Header CSV tidak boleh duplikat.']);
            }

            $rows = [];
            $recordNumber = 1;
            while (($values = fgetcsv($handle, 0, $delimiter, '"', '')) !== false) {
                $recordNumber++;
                if ($values === [null] || count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) {
                    continue;
                }
                if (count($rows) >= 5000) {
                    throw ValidationException::withMessages(['file' => 'CSV maksimal berisi 5.000 baris data.']);
                }

                $columnError = count($values) !== count($headers);
                $values = array_slice(array_pad($values, count($headers), ''), 0, count($headers));
                $rows[] = array_merge(array_combine($headers, $values), [
                    '_line' => $recordNumber,
                    '_column_error' => $columnError,
                ]);
            }

            if (!$rows) {
                throw ValidationException::withMessages(['file' => 'File CSV tidak berisi baris absensi.']);
            }

            return ['rows' => $rows];
        } finally {
            fclose($handle);
        }
    }

    private function attendanceCsvDelimiter(string $firstLine): string
    {
        foreach ([',', ';'] as $delimiter) {
            $headers = str_getcsv(rtrim($firstLine, "\r\n"), $delimiter, '"', '');
            $headers = array_map(fn ($header) => $this->normalizeAttendanceCsvHeader($header), $headers);
            if (!array_diff(['employee_code', 'attendance_date', 'status'], $headers)) {
                return $delimiter;
            }
        }

        throw ValidationException::withMessages([
            'file' => 'Header CSV tidak dikenali. Gunakan template dengan pemisah koma atau titik koma.',
        ]);
    }

    private function normalizeAttendanceCsvHeader(?string $header): string
    {
        return strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)));
    }

    private function normalizeAttendanceDate(string $value): string
    {
        foreach (['!Y-m-d', '!d/m/Y', '!d-m-Y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat($format, $value);
            $errors = \DateTimeImmutable::getLastErrors();
            if (
                $date &&
                ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0)) &&
                $date->format(substr($format, 1)) === $value
            ) {
                return $date->format('Y-m-d');
            }
        }

        return $value;
    }

    private function normalizeAttendanceTime(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        if (preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $value, $matches)) {
            return sprintf('%02d:%s', (int) $matches[1], $matches[2]);
        }

        return $value;
    }

    private function existingAttendancePairs(array $pairs): array
    {
        $existing = [];
        foreach (array_chunk($pairs, 100) as $chunk) {
            $query = EmployeeAttendance::query()->where(function (Builder $query) use ($chunk) {
                foreach ($chunk as $pair) {
                    $query->orWhere(fn (Builder $pairQuery) => $pairQuery
                        ->where('employee_id', $pair['employee_id'])
                        ->whereDate('attendance_date', $pair['attendance_date']));
                }
            });

            foreach ($query->get(['employee_id', 'attendance_date']) as $attendance) {
                $existing[$attendance->employee_id.'|'.$attendance->attendance_date->toDateString()] = true;
            }
        }

        return $existing;
    }

    private function attendanceImportPreview(array $analysis): array
    {
        return [
            'total_rows' => count($analysis['rows']),
            'ready' => count($analysis['import_rows']),
            'duplicates' => $analysis['duplicates'],
            'invalid' => $analysis['invalid'],
            'rows' => array_slice($analysis['rows'], 0, 100),
            'rows_truncated' => count($analysis['rows']) > 100,
        ];
    }

    public function leaves(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $leaves = EmployeeLeaveRequest::query()
            ->with(['employee:id,employee_code,name,branch_id', 'employee.branch:id,code,name', 'reviewer:id,name'])
            ->whereHas('employee', fn (Builder $query) => $this->applyEmployeeScope($query, $request, $validated['branch_id'] ?? null))
            ->when(
                isset($validated['status']),
                fn (Builder $query) => $query->where('status', $validated['status'])
            )
            ->latest('start_date')
            ->paginate(25);

        return response()->json(['success' => true, 'data' => $leaves]);
    }

    public function storeLeave(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'leave_type' => ['required', Rule::in(['annual', 'sick', 'unpaid', 'other'])],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        $this->visibleEmployees($request)->findOrFail($validated['employee_id']);

        $leave = EmployeeLeaveRequest::create($validated + [
            'status' => 'pending',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan cuti berhasil dicatat.',
            'data' => $leave->load('employee:id,employee_code,name'),
        ], 201);
    }

    public function reviewLeave(Request $request, int $leaveId)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'review_note' => ['nullable', 'string', 'max:2000'],
        ]);
        $leave = EmployeeLeaveRequest::query()
            ->whereHas('employee', fn (Builder $query) => $this->applyEmployeeScope($query, $request))
            ->findOrFail($leaveId);

        if ($leave->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Pengajuan cuti yang sudah diputuskan tidak dapat diubah.',
            ]);
        }

        $leave->update([
            'status' => $validated['status'],
            'review_note' => $validated['review_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Keputusan cuti berhasil disimpan.',
            'data' => $leave->fresh()->load('employee:id,employee_code,name', 'reviewer:id,name'),
        ]);
    }

    public function payroll(Request $request)
    {
        $validated = $request->validate([
            'period' => ['nullable', 'date_format:Y-m'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);
        $period = $this->periodDate($validated['period'] ?? now()->format('Y-m'));

        $payrolls = EmployeePayroll::query()
            ->with(['employee:id,employee_code,name,department,position,branch_id', 'employee.branch:id,code,name', 'items', 'approver:id,name', 'payer:id,name'])
            ->whereDate('period', $period)
            ->whereHas('employee', fn (Builder $query) => $this->applyEmployeeScope($query, $request, $validated['branch_id'] ?? null))
            ->orderBy('id')
            ->paginate(100);

        $payrolls->getCollection()->transform(fn (EmployeePayroll $payroll) => $this->serializePayroll($payroll));

        return response()->json(['success' => true, 'data' => $payrolls]);
    }

    public function generatePayroll(Request $request)
    {
        $validated = $request->validate([
            'period' => ['required', 'date_format:Y-m'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);
        $period = $this->periodDate($validated['period']);
        $employees = $this->visibleEmployees($request)
            ->where('is_active', true)
            ->when(
                isset($validated['branch_id']),
                fn (Builder $query) => $query->where('branch_id', $validated['branch_id'])
            )
            ->orderBy('id')
            ->get();

        $created = 0;
        DB::transaction(function () use ($employees, $period, $request, &$created) {
            foreach ($employees as $employee) {
                $payroll = EmployeePayroll::firstOrCreate(
                    ['employee_id' => $employee->id, 'period' => $period],
                    [
                        'base_salary' => $employee->base_salary,
                        'status' => 'draft',
                        'created_by' => $request->user()->id,
                    ],
                );

                if ($payroll->wasRecentlyCreated) {
                    $created++;
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => "{$created} draft payroll berhasil dibuat.",
            'data' => ['created' => $created, 'period' => $period->format('Y-m')],
        ]);
    }

    public function updatePayroll(Request $request, int $payrollId)
    {
        $validated = $request->validate([
            'base_salary' => ['required', 'numeric', 'min:0', 'max:9999999999999.99'],
            'items' => ['present', 'array', 'max:100'],
            'items.*.type' => ['required', Rule::in(['allowance', 'bonus', 'deduction'])],
            'items.*.label' => ['required', 'string', 'max:120'],
            'items.*.amount' => ['required', 'numeric', 'gt:0', 'max:9999999999999.99'],
        ]);

        $payroll = DB::transaction(function () use ($request, $payrollId, $validated) {
            $payroll = $this->visiblePayroll($request, $payrollId, lock: true);
            if ($payroll->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => 'Payroll yang telah disetujui tidak dapat diubah.',
                ]);
            }
            $this->ensureNonNegativeNet($validated['base_salary'], $validated['items']);
            $payroll->update(['base_salary' => $validated['base_salary']]);
            $payroll->items()->delete();
            $payroll->items()->createMany($validated['items']);
            return $payroll->fresh()->load(['employee.branch', 'items', 'approver', 'payer']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Komponen payroll berhasil disimpan.',
            'data' => $this->serializePayroll($payroll),
        ]);
    }

    public function approvePayroll(Request $request, int $payrollId)
    {
        $payroll = DB::transaction(function () use ($request, $payrollId) {
            $payroll = $this->visiblePayroll($request, $payrollId, lock: true);
            if ($payroll->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => 'Hanya draft payroll yang dapat disetujui.',
                ]);
            }
            $payroll->loadMissing('items');
            $this->ensureNonNegativeNet(
                $payroll->base_salary,
                $payroll->items->map(fn ($item) => [
                    'type' => $item->type,
                    'amount' => $item->amount,
                ])->all(),
            );
            $payroll->update([
                'status' => 'approved',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            return $payroll->fresh()->load(['employee.branch', 'items', 'approver', 'payer']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payroll berhasil disetujui.',
            'data' => $this->serializePayroll($payroll),
        ]);
    }

    public function markPayrollPaid(Request $request, int $payrollId)
    {
        $payroll = DB::transaction(function () use ($request, $payrollId) {
            $payroll = $this->visiblePayroll($request, $payrollId, lock: true);
            if ($payroll->status !== 'approved') {
                throw ValidationException::withMessages([
                    'status' => 'Hanya payroll yang sudah disetujui yang dapat ditandai lunas.',
                ]);
            }
            $payroll->update([
                'status' => 'paid',
                'paid_by' => $request->user()->id,
                'paid_at' => now(),
            ]);

            return $payroll->fresh()->load(['employee.branch', 'items', 'approver', 'payer']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Payroll berhasil ditandai lunas.',
            'data' => $this->serializePayroll($payroll),
        ]);
    }

    private function validateEmployee(Request $request, ?Employee $employee = null, bool $creating = false): array
    {
        $validated = $request->validate([
            'employee_code' => [
                'required',
                'string',
                'max:40',
                Rule::unique('employees', 'employee_code')->ignore($employee?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'department' => ['nullable', 'string', 'max:120'],
            'position' => ['nullable', 'string', 'max:120'],
            'employment_type' => ['required', Rule::in(['permanent', 'contract', 'part_time', 'intern'])],
            'hire_date' => ['nullable', 'date_format:Y-m-d'],
            'base_salary' => ['required', 'numeric', 'min:0', 'max:9999999999999.99'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        if ($user->branch_id && !$user->hasRole('Owner')) {
            if (
                array_key_exists('branch_id', $validated) &&
                (int) $validated['branch_id'] !== (int) $user->branch_id
            ) {
                abort(403, 'HR hanya dapat mengelola karyawan di cabangnya.');
            }

            if ($creating) {
                $validated['branch_id'] = $user->branch_id;
            }
        }

        return $validated;
    }

    private function visibleEmployees(Request $request): Builder
    {
        $branchId = $request->user()->branch_id;
        $query = Employee::query();

        if ($branchId && !$request->user()->hasRole('Owner')) {
            $query->where('branch_id', $branchId);
        }

        if ($request->query('branch_id')) {
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        return $query;
    }

    private function applyEmployeeScope(Builder $query, Request $request, ?int $branchId = null): Builder
    {
        if ($request->user()->branch_id && !$request->user()->hasRole('Owner')) {
            $query->where('branch_id', $request->user()->branch_id);
        }

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        return $query;
    }

    private function visiblePayroll(Request $request, int $payrollId, bool $lock = false): EmployeePayroll
    {
        $query = EmployeePayroll::query()
            ->whereHas('employee', fn (Builder $employeeQuery) => $this->applyEmployeeScope($employeeQuery, $request));

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->findOrFail($payrollId);
    }

    private function periodDate(string $period): Carbon
    {
        return Carbon::createFromFormat('!Y-m', $period)->startOfMonth();
    }

    private function ensureNonNegativeNet(string|int|float $baseSalary, array $items): void
    {
        $grossCents = $this->moneyToCents($baseSalary);
        $deductionCents = 0;

        foreach ($items as $item) {
            $amount = $this->moneyToCents($item['amount']);
            if ($item['type'] === 'deduction') {
                $deductionCents += $amount;
            } else {
                $grossCents += $amount;
            }
        }

        if ($deductionCents > $grossCents) {
            throw ValidationException::withMessages([
                'items' => 'Total potongan tidak boleh melebihi total penghasilan.',
            ]);
        }
    }

    private function moneyToCents(string|int|float $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function centsToMoney(int $amount): string
    {
        return number_format($amount / 100, 2, '.', '');
    }

    private function serializePayroll(EmployeePayroll $payroll): array
    {
        $items = $payroll->items->map(fn ($item) => [
            'id' => $item->id,
            'type' => $item->type,
            'label' => $item->label,
            'amount' => (string) $item->amount,
        ]);
        $grossCents = $this->moneyToCents($payroll->base_salary);
        $deductionCents = 0;

        foreach ($payroll->items as $item) {
            $amount = $this->moneyToCents($item->amount);
            if ($item->type === 'deduction') {
                $deductionCents += $amount;
            } else {
                $grossCents += $amount;
            }
        }

        return [
            'id' => $payroll->id,
            'employee_id' => $payroll->employee_id,
            'employee' => $payroll->employee,
            'period' => $payroll->period->format('Y-m'),
            'base_salary' => (string) $payroll->base_salary,
            'items' => $items,
            'total_earnings' => $this->centsToMoney($grossCents),
            'total_deductions' => $this->centsToMoney($deductionCents),
            'net_pay' => $this->centsToMoney($grossCents - $deductionCents),
            'status' => $payroll->status,
            'approver' => $payroll->approver,
            'approved_at' => $payroll->approved_at,
            'payer' => $payroll->payer,
            'paid_at' => $payroll->paid_at,
        ];
    }
}
