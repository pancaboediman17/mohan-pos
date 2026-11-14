<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class HRManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_hr_can_manage_employees_and_record_daily_attendance(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'HR-JKT', 'name' => 'Jakarta']);
        $hr = User::factory()->create(['branch_id' => $branch->id]);
        $hr->assignRole('HR');

        $employeeResponse = $this->actingAs($hr)->postJson('/api/v1/hr/employees', [
            'employee_code' => 'EMP-001',
            'name' => 'Sari Karyawan',
            'department' => 'Operasional',
            'position' => 'Operator',
            'employment_type' => 'permanent',
            'base_salary' => 5000000,
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.branch_id', $branch->id);

        $employeeId = $employeeResponse->json('data.id');
        $date = now()->toDateString();

        $this->postJson('/api/v1/hr/attendance', [
            'employee_id' => $employeeId,
            'attendance_date' => $date,
            'check_in' => '08:05',
            'check_out' => '17:00',
            'status' => 'late',
        ])->assertOk();

        $attendanceEditor = User::factory()->create(['branch_id' => $branch->id]);
        $attendanceEditor->assignRole('HR');

        $this->actingAs($attendanceEditor)->postJson('/api/v1/hr/attendance', [
            'employee_id' => $employeeId,
            'attendance_date' => $date,
            'check_in' => '08:00',
            'check_out' => '17:00',
            'status' => 'present',
        ])->assertOk();

        $this->assertDatabaseCount('employee_attendances', 1);
        $attendance = EmployeeAttendance::query()
            ->where('employee_id', $employeeId)
            ->whereDate('attendance_date', $date)
            ->firstOrFail();
        $this->assertSame('present', $attendance->status);
        $this->assertSame($hr->id, $attendance->created_by);
        $this->assertSame($attendanceEditor->id, $attendance->updated_by);

        $this->getJson('/api/v1/hr/attendance?date='.$date)
            ->assertOk()
            ->assertJsonPath('data.employees.0.attendance.status', 'present');
    }

    public function test_hr_can_generate_approve_and_mark_payroll_paid_and_cannot_edit_approved_payroll(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $hr = User::factory()->create();
        $hr->assignRole('HR');
        $employee = Employee::create([
            'employee_code' => 'EMP-002',
            'name' => 'Budi Payroll',
            'employment_type' => 'permanent',
            'base_salary' => 5000000,
            'is_active' => true,
        ]);
        $period = now()->format('Y-m');

        $this->actingAs($hr)
            ->postJson('/api/v1/hr/payroll/generate', ['period' => $period])
            ->assertOk()
            ->assertJsonPath('data.created', 1);

        $payrollResponse = $this->getJson('/api/v1/hr/payroll?period='.$period)
            ->assertOk()
            ->assertJsonPath('data.data.0.employee.id', $employee->id);
        $payrollId = $payrollResponse->json('data.data.0.id');

        $this->putJson('/api/v1/hr/payroll/'.$payrollId, [
            'base_salary' => 5000000,
            'items' => [
                ['type' => 'allowance', 'label' => 'Tunjangan transport', 'amount' => 500000],
                ['type' => 'bonus', 'label' => 'Bonus kinerja', 'amount' => 250000],
                ['type' => 'deduction', 'label' => 'Potongan', 'amount' => 100000],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.total_earnings', '5750000.00')
            ->assertJsonPath('data.total_deductions', '100000.00')
            ->assertJsonPath('data.net_pay', '5650000.00');

        $this->postJson('/api/v1/hr/payroll/'.$payrollId.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->putJson('/api/v1/hr/payroll/'.$payrollId, [
            'base_salary' => 5000000,
            'items' => [],
        ])->assertUnprocessable();

        $this->postJson('/api/v1/hr/payroll/'.$payrollId.'/mark-paid')
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->assertDatabaseHas('employee_payrolls', [
            'id' => $payrollId,
            'status' => 'paid',
            'approved_by' => $hr->id,
            'paid_by' => $hr->id,
        ]);
    }

    public function test_hr_can_record_leave_and_decide_it_only_once(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $hr = User::factory()->create();
        $hr->assignRole('HR');
        $employee = Employee::create([
            'employee_code' => 'EMP-003',
            'name' => 'Dina Cuti',
            'employment_type' => 'permanent',
            'base_salary' => 4000000,
            'is_active' => true,
        ]);

        $leaveResponse = $this->actingAs($hr)->postJson('/api/v1/hr/leaves', [
            'employee_id' => $employee->id,
            'leave_type' => 'annual',
            'start_date' => now()->addDays(3)->toDateString(),
            'end_date' => now()->addDays(4)->toDateString(),
            'reason' => 'Keperluan keluarga',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');
        $leaveId = $leaveResponse->json('data.id');

        $this->patchJson('/api/v1/hr/leaves/'.$leaveId.'/review', [
            'status' => 'approved',
            'review_note' => 'Disetujui.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->patchJson('/api/v1/hr/leaves/'.$leaveId.'/review', [
            'status' => 'rejected',
        ])->assertUnprocessable();
    }

    public function test_hr_data_is_not_available_to_non_hr_users_and_is_branch_scoped(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'HR-A', 'name' => 'Cabang A']);
        $otherBranch = Branch::create(['code' => 'HR-B', 'name' => 'Cabang B']);
        $employee = Employee::create([
            'employee_code' => 'EMP-A',
            'name' => 'Karyawan A',
            'branch_id' => $branch->id,
            'employment_type' => 'permanent',
            'base_salary' => 3000000,
            'is_active' => true,
        ]);
        $otherEmployee = Employee::create([
            'employee_code' => 'EMP-B',
            'name' => 'Karyawan B',
            'branch_id' => $otherBranch->id,
            'employment_type' => 'permanent',
            'base_salary' => 3000000,
            'is_active' => true,
        ]);
        $hr = User::factory()->create(['branch_id' => $branch->id]);
        $hr->assignRole('HR');
        $admin = User::factory()->create();
        $admin->assignRole('Admin');

        $this->actingAs($hr)
            ->getJson('/api/v1/hr/employees')
            ->assertOk()
            ->assertJsonFragment(['id' => $employee->id])
            ->assertJsonMissing(['id' => $otherEmployee->id]);

        $this->putJson('/api/v1/hr/employees/'.$otherEmployee->id, [
            'employee_code' => 'EMP-B',
            'name' => 'Karyawan B',
            'branch_id' => $otherBranch->id,
            'employment_type' => 'permanent',
            'base_salary' => 3000000,
            'is_active' => true,
        ])->assertNotFound();

        $this->actingAs($admin)
            ->getJson('/api/v1/hr/employees')
            ->assertForbidden();
    }

    public function test_hr_can_preview_and_import_attendance_csv_without_overwriting_existing_rows(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'CSV-HR', 'name' => 'Cabang CSV']);
        $hr = User::factory()->create(['branch_id' => $branch->id]);
        $hr->assignRole('HR');
        $employee = Employee::create([
            'employee_code' => 'EMP-CSV',
            'name' => 'Karyawan CSV',
            'employment_type' => 'permanent',
            'base_salary' => 3000000,
            'is_active' => true,
            'branch_id' => $branch->id,
        ]);
        $existingDate = now()->subDay()->toDateString();
        $newDate = now()->toDateString();
        EmployeeAttendance::create([
            'employee_id' => $employee->id,
            'attendance_date' => $existingDate,
            'status' => 'late',
            'notes' => 'Data manual dipertahankan',
            'created_by' => $hr->id,
            'updated_by' => $hr->id,
        ]);
        $csv = implode("\n", [
            'employee_code,attendance_date,check_in,check_out,status,notes',
            "EMP-CSV,{$existingDate},08:15,17:00,late,Data lama",
            "EMP-CSV,{$newDate},08:00,17:00,present,",
            "EMP-CSV,{$newDate},08:05,17:00,late,Duplikat dalam file",
        ]);

        $this->actingAs($hr)
            ->get('/api/v1/hr/attendance/template')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->assertSeeText('employee_code,attendance_date,check_in,check_out,status,notes');

        $this->actingAs($hr)
            ->post('/api/v1/hr/attendance/import/preview', [
                'file' => UploadedFile::fake()->createWithContent('attendance.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.total_rows', 3)
            ->assertJsonPath('data.ready', 1)
            ->assertJsonPath('data.duplicates', 2)
            ->assertJsonPath('data.invalid', 0);

        $this->actingAs($hr)
            ->post('/api/v1/hr/attendance/import', [
                'file' => UploadedFile::fake()->createWithContent('attendance.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.imported', 1)
            ->assertJsonPath('data.skipped', 2);

        $this->assertDatabaseCount('employee_attendances', 2);
        $existing = EmployeeAttendance::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $existingDate)
            ->firstOrFail();
        $this->assertSame('Data manual dipertahankan', $existing->notes);
        $this->assertSame('manual', $existing->source);

        $imported = EmployeeAttendance::query()
            ->where('employee_id', $employee->id)
            ->whereDate('attendance_date', $newDate)
            ->firstOrFail();
        $this->assertSame('present', $imported->status);
        $this->assertSame('csv', $imported->source);
        $this->assertSame($hr->id, $imported->created_by);
        $this->assertSame($hr->id, $imported->updated_by);
        $this->assertNotNull($imported->imported_at);
    }

    public function test_invalid_or_out_of_branch_attendance_rows_cancel_the_whole_import(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'CSV-A', 'name' => 'Cabang A']);
        $otherBranch = Branch::create(['code' => 'CSV-B', 'name' => 'Cabang B']);
        $hr = User::factory()->create(['branch_id' => $branch->id]);
        $hr->assignRole('HR');
        $employee = Employee::create([
            'employee_code' => 'EMP-VALID',
            'name' => 'Karyawan Valid',
            'branch_id' => $branch->id,
            'employment_type' => 'permanent',
            'base_salary' => 3000000,
            'is_active' => true,
        ]);
        Employee::create([
            'employee_code' => 'EMP-OTHER-BRANCH',
            'name' => 'Karyawan Cabang Lain',
            'branch_id' => $otherBranch->id,
            'employment_type' => 'permanent',
            'base_salary' => 3000000,
            'is_active' => true,
        ]);
        $date = now()->format('d/m/Y');
        $csv = implode("\n", [
            'employee_code;attendance_date;check_in;check_out;status;notes',
            "EMP-VALID;{$date};08:00;17:00;present;",
            "EMP-OTHER-BRANCH;{$date};08:00;17:00;present;",
        ]);

        $this->actingAs($hr)
            ->post('/api/v1/hr/attendance/import/preview', [
                'file' => UploadedFile::fake()->createWithContent('attendance.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.ready', 1)
            ->assertJsonPath('data.invalid', 1);

        $this->actingAs($hr)
            ->post('/api/v1/hr/attendance/import', [
                'file' => UploadedFile::fake()->createWithContent('attendance.csv', $csv),
            ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertDatabaseCount('employee_attendances', 0);
    }
}
