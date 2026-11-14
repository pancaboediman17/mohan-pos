import { useEffect, useState } from "react";
import {
    AlertCircle,
    CalendarDays,
    Check,
    Clock3,
    Download,
    FileText,
    Pencil,
    Plus,
    Printer,
    RefreshCw,
    Search,
    Upload,
    Users,
    Wallet,
    X,
} from "lucide-react";
import api from "../services/api";
import { PayrollSlipPrintDocument } from "./TransactionDocuments";

const today = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
};

const currentPeriod = () => today().slice(0, 7);

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));

const dateLabel = (value) => {
    if (!value) return "-";
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const leaveTypes = {
    annual: "Cuti tahunan",
    sick: "Sakit",
    unpaid: "Cuti tanpa gaji",
    other: "Lainnya",
};

const attendanceStatuses = {
    present: "Hadir",
    late: "Terlambat",
    absent: "Tidak hadir",
    leave: "Cuti",
    sick: "Sakit",
    permit: "Izin",
};

const payrollStatuses = {
    draft: "Draft",
    approved: "Disetujui",
    paid: "Dibayar",
};

const emptyEmployee = {
    employee_code: "",
    name: "",
    email: "",
    phone: "",
    branch_id: "",
    department: "",
    position: "",
    employment_type: "permanent",
    hire_date: "",
    base_salary: "0",
    is_active: true,
    notes: "",
};

const emptyLeave = {
    employee_id: "",
    leave_type: "annual",
    start_date: today(),
    end_date: today(),
    reason: "",
};

function getErrorMessage(error, fallback) {
    const errors = error.response?.data?.errors;
    if (errors) return Object.values(errors).flat().join(" ");
    return error.response?.data?.message || fallback;
}

function StatusPill({ value, labels }) {
    const approved = ["approved", "paid", "active", "present"].includes(value);
    const rejected = ["rejected", "inactive", "absent"].includes(value);
    const style = approved
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        : rejected
          ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
          : "border-amber-500/20 bg-amber-500/10 text-amber-300";

    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>
            {labels[value] || value}
        </span>
    );
}

function Field({ label, children, className = "" }) {
    return (
        <label className={`form-field ${className}`}>
            <span>{label}</span>
            {children}
        </label>
    );
}

function PayrollEditor({ payroll, draft, setDraft, onClose, onSave, saving, error }) {
    const updateItem = (index, key, value) => {
        setDraft((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [key]: value } : item,
            ),
        }));
    };

    const addItem = () => {
        setDraft((current) => ({
            ...current,
            items: [...current.items, { type: "allowance", label: "", amount: "" }],
        }));
    };

    const removeItem = (index) => {
        setDraft((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <section className="panel max-h-[92vh] w-full max-w-3xl overflow-y-auto">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="panel-title">Komponen penggajian</h3>
                        <p className="panel-subtitle mt-1">
                            {payroll.employee.name} · Periode {payroll.period}
                        </p>
                    </div>
                    <button type="button" className="secondary-button" onClick={onClose} aria-label="Tutup">
                        <X size={16} />
                    </button>
                </div>

                {error && <p className="mb-4 text-sm text-rose-300" role="alert">{error}</p>}

                <form onSubmit={onSave} className="space-y-5">
                    <Field label="Gaji pokok">
                        <input
                            className="form-input"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={draft.base_salary}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    base_salary: event.target.value,
                                }))
                            }
                        />
                    </Field>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="font-semibold text-white">Tunjangan, bonus, dan potongan</h4>
                                <p className="mt-1 text-xs text-slate-500">
                                    Nilai dimasukkan HR dan tidak menghitung pajak/BPJS otomatis.
                                </p>
                            </div>
                            <button type="button" className="secondary-button" onClick={addItem}>
                                <Plus size={15} /> Tambah
                            </button>
                        </div>

                        {draft.items.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
                                Belum ada komponen tambahan.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {draft.items.map((item, index) => (
                                    <div key={index} className="grid gap-3 rounded-xl border border-slate-800 p-3 sm:grid-cols-[1fr_1.5fr_1fr_auto]">
                                        <select
                                            className="form-input"
                                            value={item.type}
                                            onChange={(event) => updateItem(index, "type", event.target.value)}
                                            aria-label="Jenis komponen"
                                        >
                                            <option value="allowance">Tunjangan</option>
                                            <option value="bonus">Bonus</option>
                                            <option value="deduction">Potongan</option>
                                        </select>
                                        <input
                                            className="form-input"
                                            value={item.label}
                                            onChange={(event) => updateItem(index, "label", event.target.value)}
                                            placeholder="Nama komponen"
                                            maxLength={120}
                                            required
                                        />
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={item.amount}
                                            onChange={(event) => updateItem(index, "amount", event.target.value)}
                                            placeholder="Nominal"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="secondary-button justify-center text-rose-300"
                                            onClick={() => removeItem(index)}
                                            aria-label="Hapus komponen"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                        <button type="button" className="secondary-button" onClick={onClose}>Batal</button>
                        <button type="submit" className="primary-button" disabled={saving}>
                            <Check size={16} />
                            {saving ? "Menyimpan..." : "Simpan Draft"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default function HRManagement({ canManage = false }) {
    const [activeTab, setActiveTab] = useState("employees");
    const [overview, setOverview] = useState({});
    const [branches, setBranches] = useState([]);
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [branchFilter, setBranchFilter] = useState("");
    const [employees, setEmployees] = useState([]);
    const [employeePagination, setEmployeePagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });
    const [employeePage, setEmployeePage] = useState(1);
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [employeeStatus, setEmployeeStatus] = useState("");
    const [attendanceDate, setAttendanceDate] = useState(today());
    const [attendanceRows, setAttendanceRows] = useState([]);
    const [attendanceImportFile, setAttendanceImportFile] = useState(null);
    const [attendanceImportPreview, setAttendanceImportPreview] = useState(null);
    const [attendanceImporting, setAttendanceImporting] = useState(false);
    const [leaves, setLeaves] = useState([]);
    const [leaveStatus, setLeaveStatus] = useState("pending");
    const [period, setPeriod] = useState(currentPeriod());
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingRow, setSavingRow] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [employeeModal, setEmployeeModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
    const [leaveModal, setLeaveModal] = useState(false);
    const [leaveForm, setLeaveForm] = useState(emptyLeave);
    const [editingPayroll, setEditingPayroll] = useState(null);
    const [payrollDraft, setPayrollDraft] = useState({ base_salary: "", items: [] });
    const [slip, setSlip] = useState(null);

    const loadOptions = async () => {
        try {
            const [optionsResponse, overviewResponse] = await Promise.all([
                api.get("/api/v1/hr/options"),
                api.get("/api/v1/hr/overview"),
            ]);
            setBranches(optionsResponse.data?.data?.branches || []);
            setEmployeeOptions(optionsResponse.data?.data?.employees || []);
            setOverview(overviewResponse.data?.data || {});
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Data HR gagal dimuat."));
        }
    };

    const loadEmployees = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/hr/employees", {
                params: {
                    page: employeePage,
                    search: employeeSearch.trim() || undefined,
                    status: employeeStatus || undefined,
                    branch_id: branchFilter || undefined,
                },
            });
            const result = response.data?.data;
            setEmployees(result?.data || []);
            setEmployeePagination({
                current_page: result?.current_page || 1,
                last_page: result?.last_page || 1,
                total: result?.total || 0,
            });
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Data karyawan gagal dimuat."));
        } finally {
            setLoading(false);
        }
    };

    const loadAttendance = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/hr/attendance", {
                params: {
                    date: attendanceDate,
                    branch_id: branchFilter || undefined,
                },
            });
            const rows = response.data?.data?.employees || [];
            setAttendanceRows(rows.map((item) => ({
                ...item,
                attendance: {
                    check_in: item.attendance?.check_in?.slice(0, 5) || "",
                    check_out: item.attendance?.check_out?.slice(0, 5) || "",
                    status: item.attendance?.status || "",
                    notes: item.attendance?.notes || "",
                    source: item.attendance?.source || "manual",
                    imported_at: item.attendance?.imported_at || null,
                },
            })));
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Data absensi gagal dimuat."));
        } finally {
            setLoading(false);
        }
    };

    const loadLeaves = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/hr/leaves", {
                params: {
                    status: leaveStatus || undefined,
                    branch_id: branchFilter || undefined,
                },
            });
            setLeaves(response.data?.data?.data || []);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Data cuti gagal dimuat."));
        } finally {
            setLoading(false);
        }
    };

    const loadPayroll = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/hr/payroll", {
                params: { period, branch_id: branchFilter || undefined },
            });
            setPayrolls(response.data?.data?.data || []);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Data payroll gagal dimuat."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canManage) loadOptions();
    }, [canManage]);

    useEffect(() => {
        if (!canManage) return;
        if (activeTab === "employees") loadEmployees();
        if (activeTab === "attendance") loadAttendance();
        if (activeTab === "leaves") loadLeaves();
        if (activeTab === "payroll") loadPayroll();
    }, [
        canManage,
        activeTab,
        employeePage,
        employeeSearch,
        employeeStatus,
        attendanceDate,
        leaveStatus,
        period,
        branchFilter,
    ]);

    useEffect(() => {
        if (!slip) return undefined;
        const afterPrint = () => setSlip(null);
        window.addEventListener("afterprint", afterPrint);
        const timer = window.setTimeout(() => window.print(), 250);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("afterprint", afterPrint);
        };
    }, [slip]);

    const updateAttendance = (employeeId, field, value) => {
        setAttendanceRows((current) =>
            current.map((row) =>
                row.id === employeeId
                    ? { ...row, attendance: { ...row.attendance, [field]: value } }
                    : row,
            ),
        );
    };

    const openEmployeeModal = (employee = null) => {
        setError("");
        setEditingEmployee(employee);
        setEmployeeForm(employee ? {
            employee_code: employee.employee_code || "",
            name: employee.name || "",
            email: employee.email || "",
            phone: employee.phone || "",
            branch_id: employee.branch_id || "",
            department: employee.department || "",
            position: employee.position || "",
            employment_type: employee.employment_type || "permanent",
            hire_date: employee.hire_date?.slice(0, 10) || "",
            base_salary: employee.base_salary || "0",
            is_active: Boolean(employee.is_active),
            notes: employee.notes || "",
        } : {
            ...emptyEmployee,
            branch_id: branches.length === 1 ? String(branches[0].id) : "",
        });
        setEmployeeModal(true);
    };

    const saveEmployee = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const payload = {
                ...employeeForm,
                branch_id: employeeForm.branch_id || null,
                hire_date: employeeForm.hire_date || null,
            };
            if (editingEmployee) {
                await api.put(`/api/v1/hr/employees/${editingEmployee.id}`, payload);
                setSuccess("Data karyawan berhasil diperbarui.");
            } else {
                await api.post("/api/v1/hr/employees", payload);
                setSuccess("Karyawan berhasil ditambahkan.");
            }
            setEmployeeModal(false);
            setEditingEmployee(null);
            await Promise.all([loadEmployees(), loadOptions()]);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Data karyawan gagal disimpan."));
        } finally {
            setSaving(false);
        }
    };

    const saveAttendance = async (employee) => {
        const values = employee.attendance;
        if (!values.status) {
            setError(`Pilih status absensi untuk ${employee.name}.`);
            return;
        }
        setSavingRow(employee.id);
        setError("");
        setSuccess("");
        try {
            await api.post("/api/v1/hr/attendance", {
                employee_id: employee.id,
                attendance_date: attendanceDate,
                check_in: values.check_in || null,
                check_out: values.check_out || null,
                status: values.status,
                notes: values.notes || null,
            });
            setSuccess(`Absensi ${employee.name} berhasil disimpan.`);
            await loadAttendance();
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Absensi gagal disimpan."));
        } finally {
            setSavingRow(null);
        }
    };

    const downloadAttendanceTemplate = async () => {
        setError("");
        try {
            const response = await api.get("/api/v1/hr/attendance/template", {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement("a");
            link.href = url;
            link.download = "template-absensi.csv";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Template CSV gagal diunduh."));
        }
    };

    const attendanceImportFormData = () => {
        const formData = new FormData();
        formData.append("file", attendanceImportFile);
        if (branchFilter) formData.append("branch_id", branchFilter);
        return formData;
    };

    const previewAttendanceCsv = async () => {
        if (!attendanceImportFile) {
            setError("Pilih file CSV absensi terlebih dahulu.");
            return;
        }
        setAttendanceImporting(true);
        setError("");
        setSuccess("");
        try {
            const response = await api.post(
                "/api/v1/hr/attendance/import/preview",
                attendanceImportFormData(),
                { headers: { "Content-Type": "multipart/form-data" } },
            );
            setAttendanceImportPreview(response.data?.data || null);
        } catch (requestError) {
            setAttendanceImportPreview(null);
            setError(getErrorMessage(requestError, "Pratinjau CSV gagal dibuat."));
        } finally {
            setAttendanceImporting(false);
        }
    };

    const importAttendanceCsv = async () => {
        if (!attendanceImportFile || !attendanceImportPreview?.ready) return;
        setAttendanceImporting(true);
        setError("");
        setSuccess("");
        try {
            const response = await api.post(
                "/api/v1/hr/attendance/import",
                attendanceImportFormData(),
                { headers: { "Content-Type": "multipart/form-data" } },
            );
            setSuccess(response.data?.message || "Impor absensi berhasil.");
            setAttendanceImportPreview(null);
            await loadAttendance();
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Impor absensi gagal."));
        } finally {
            setAttendanceImporting(false);
        }
    };

    const saveLeave = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            await api.post("/api/v1/hr/leaves", leaveForm);
            setLeaveModal(false);
            setLeaveForm({ ...emptyLeave });
            setSuccess("Pengajuan cuti berhasil dicatat untuk ditinjau.");
            await Promise.all([loadLeaves(), loadOptions()]);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Pengajuan cuti gagal disimpan."));
        } finally {
            setSaving(false);
        }
    };

    const reviewLeave = async (leave, status) => {
        const action = status === "approved" ? "menyetujui" : "menolak";
        if (!window.confirm(`Yakin ${action} pengajuan cuti ${leave.employee.name}?`)) return;
        setSavingRow(leave.id);
        setError("");
        setSuccess("");
        try {
            await api.patch(`/api/v1/hr/leaves/${leave.id}/review`, { status });
            setSuccess(`Pengajuan cuti berhasil ${status === "approved" ? "disetujui" : "ditolak"}.`);
            await Promise.all([loadLeaves(), loadOptions()]);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Keputusan cuti gagal disimpan."));
        } finally {
            setSavingRow(null);
        }
    };

    const generatePayroll = async () => {
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const response = await api.post("/api/v1/hr/payroll/generate", {
                period,
                branch_id: branchFilter || null,
            });
            setSuccess(response.data?.message || "Draft payroll berhasil dibuat.");
            await Promise.all([loadPayroll(), loadOptions()]);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Payroll gagal dibuat."));
        } finally {
            setSaving(false);
        }
    };

    const openPayrollEditor = (payroll) => {
        setError("");
        setEditingPayroll(payroll);
        setPayrollDraft({
            base_salary: payroll.base_salary,
            items: payroll.items.map((item) => ({
                type: item.type,
                label: item.label,
                amount: item.amount,
            })),
        });
    };

    const savePayrollDraft = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            await api.put(`/api/v1/hr/payroll/${editingPayroll.id}`, payrollDraft);
            setEditingPayroll(null);
            setSuccess("Komponen payroll berhasil disimpan.");
            await loadPayroll();
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Komponen payroll gagal disimpan."));
        } finally {
            setSaving(false);
        }
    };

    const changePayrollStatus = async (payroll, action) => {
        const message = action === "approve"
            ? `Setujui payroll ${payroll.employee.name} untuk ${payroll.period}?`
            : `Tandai payroll ${payroll.employee.name} untuk ${payroll.period} sudah dibayar?`;
        if (!window.confirm(message)) return;
        setSavingRow(payroll.id);
        setError("");
        setSuccess("");
        try {
            const endpoint = action === "approve" ? "approve" : "mark-paid";
            await api.post(`/api/v1/hr/payroll/${payroll.id}/${endpoint}`);
            setSuccess(action === "approve" ? "Payroll berhasil disetujui." : "Payroll ditandai sudah dibayar.");
            await Promise.all([loadPayroll(), loadOptions()]);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Status payroll gagal diperbarui."));
        } finally {
            setSavingRow(null);
        }
    };

    const tabs = [
        { id: "employees", label: "Karyawan", icon: Users },
        { id: "attendance", label: "Absensi", icon: Clock3 },
        { id: "leaves", label: "Cuti", icon: CalendarDays },
        { id: "payroll", label: "Payroll & Bonus", icon: Wallet },
    ];

    if (!canManage) {
        return (
            <div className="panel text-sm text-rose-300" role="alert">
                Anda tidak memiliki izin untuk mengakses data HR.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="welcome-row">
                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                        Human Resources
                    </p>
                    <h2 className="text-2xl font-bold text-white">HR & Karyawan</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Kelola data karyawan, absensi, cuti, dan penggajian.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {branches.length > 1 && (
                        <select
                            className="dark-select"
                            value={branchFilter}
                            onChange={(event) => {
                                setBranchFilter(event.target.value);
                                setAttendanceImportPreview(null);
                            }}
                            aria-label="Filter cabang HR"
                        >
                            <option value="">Semua cabang</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                    )}
                    <button type="button" className="secondary-button" onClick={loadOptions} aria-label="Muat ulang ringkasan HR">
                        <RefreshCw size={15} />
                    </button>
                </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Karyawan aktif</p>
                        <Users size={20} className="text-blue-400" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white">{overview.active_employees ?? "—"}</p>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Cuti menunggu</p>
                        <CalendarDays size={20} className="text-amber-400" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white">{overview.pending_leaves ?? "—"}</p>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Draft payroll bulan ini</p>
                        <FileText size={20} className="text-violet-400" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white">{overview.draft_payrolls ?? "—"}</p>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Payroll disetujui/dibayar</p>
                        <Wallet size={20} className="text-emerald-400" />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white">{overview.approved_payrolls ?? "—"}</p>
                </div>
            </div>

            {(error || success) && (
                <div
                    className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${
                        error
                            ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    }`}
                    role={error ? "alert" : "status"}
                >
                    {error ? <AlertCircle size={17} /> : <Check size={17} />}
                    <span>{error || success}</span>
                </div>
            )}

            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setError("");
                                setSuccess("");
                                setActiveTab(tab.id);
                            }}
                            className={`menu-link ${activeTab === tab.id ? "active" : ""}`}
                        >
                            <Icon size={17} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {activeTab === "employees" && (
                <section className="panel overflow-hidden">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="panel-title">Data karyawan</h3>
                            <p className="panel-subtitle mt-1">{employeePagination.total} karyawan</p>
                        </div>
                        <button type="button" className="primary-button" onClick={() => openEmployeeModal()}>
                            <Plus size={16} /> Tambah karyawan
                        </button>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-3">
                        <div className="relative min-w-56 flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                className="form-input pl-10"
                                value={employeeSearch}
                                onChange={(event) => {
                                    setEmployeePage(1);
                                    setEmployeeSearch(event.target.value);
                                }}
                                placeholder="Cari nama, kode, jabatan..."
                                aria-label="Cari karyawan"
                            />
                        </div>
                        <select className="dark-select" value={employeeStatus} onChange={(event) => setEmployeeStatus(event.target.value)}>
                            <option value="">Semua status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead><tr><th>Karyawan</th><th>Departemen / Jabatan</th><th>Cabang</th><th>Gaji pokok</th><th>Status</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="6" className="py-10 text-center text-slate-400">Memuat data...</td></tr>
                                ) : employees.length ? employees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td><strong className="text-white">{employee.name}</strong><small className="mt-1 block text-slate-500">{employee.employee_code}</small></td>
                                        <td>{employee.department || "-"}<small className="mt-1 block text-slate-500">{employee.position || "-"}</small></td>
                                        <td>{employee.branch?.name || "Pusat"}</td>
                                        <td>{money(employee.base_salary)}</td>
                                        <td><StatusPill value={employee.is_active ? "active" : "inactive"} labels={{ active: "Aktif", inactive: "Nonaktif" }} /></td>
                                        <td>
                                            <button type="button" className="secondary-button" onClick={() => openEmployeeModal(employee)} aria-label={`Edit ${employee.name}`}>
                                                <Pencil size={15} /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" className="py-10 text-center text-slate-400">Belum ada data karyawan.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                        <span>Halaman {employeePagination.current_page} dari {employeePagination.last_page}</span>
                        <div className="flex gap-2">
                            <button type="button" className="secondary-button" disabled={employeePage <= 1} onClick={() => setEmployeePage((page) => page - 1)}>Sebelumnya</button>
                            <button type="button" className="secondary-button" disabled={employeePage >= employeePagination.last_page} onClick={() => setEmployeePage((page) => page + 1)}>Berikutnya</button>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === "attendance" && (
                <section className="panel overflow-hidden">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="panel-title">Absensi harian</h3>
                            <p className="panel-subtitle mt-1">Pencatatan dan koreksi dilakukan oleh HR.</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                            <button type="button" className="secondary-button" onClick={downloadAttendanceTemplate}>
                                <Download size={15} /> Template CSV
                            </button>
                            <Field label="Tanggal">
                                <input className="form-input" type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} />
                            </Field>
                        </div>
                    </div>
                    <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="flex flex-wrap items-end gap-3">
                            <Field label="Impor absensi dari CSV" className="min-w-64 flex-1">
                                <input
                                    className="form-input"
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={(event) => {
                                        setAttendanceImportFile(event.target.files?.[0] || null);
                                        setAttendanceImportPreview(null);
                                        setError("");
                                    }}
                                />
                            </Field>
                            <button
                                type="button"
                                className="secondary-button"
                                disabled={!attendanceImportFile || attendanceImporting}
                                onClick={previewAttendanceCsv}
                            >
                                <Upload size={15} />
                                {attendanceImporting ? "Memeriksa..." : "Pratinjau"}
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Kolom wajib: employee_code, attendance_date, status. Tanggal gunakan YYYY-MM-DD atau DD/MM/YYYY.
                            Status: present, late, absent, leave, sick, permit. Baris duplikat dilewati dan tidak menimpa data lama.
                        </p>
                        {attendanceImportPreview && (
                            <div className="mt-4 space-y-3">
                                <div className="grid gap-2 text-sm sm:grid-cols-4">
                                    <div className="rounded-lg bg-slate-900 p-3">Baris: <strong>{attendanceImportPreview.total_rows}</strong></div>
                                    <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-200">Siap impor: <strong>{attendanceImportPreview.ready}</strong></div>
                                    <div className="rounded-lg bg-amber-500/10 p-3 text-amber-200">Duplikat: <strong>{attendanceImportPreview.duplicates}</strong></div>
                                    <div className="rounded-lg bg-rose-500/10 p-3 text-rose-200">Tidak valid: <strong>{attendanceImportPreview.invalid}</strong></div>
                                </div>
                                {attendanceImportPreview.rows.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="data-table min-w-[600px]">
                                            <thead><tr><th>Baris</th><th>Kode karyawan</th><th>Tanggal</th><th>Hasil</th><th>Catatan validasi</th></tr></thead>
                                            <tbody>
                                                {attendanceImportPreview.rows.map((row) => (
                                                    <tr key={row.line}>
                                                        <td>{row.line}</td>
                                                        <td>{row.employee_code || "—"}</td>
                                                        <td>{row.attendance_date || "—"}</td>
                                                        <td>{row.errors.length ? (row.duplicate ? "Duplikat" : "Tidak valid") : "Siap impor"}</td>
                                                        <td className="whitespace-normal text-xs">{row.errors.join(" ") || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {attendanceImportPreview.rows_truncated && (
                                            <p className="mt-2 text-xs text-slate-500">Pratinjau dibatasi 100 baris; ringkasan menghitung seluruh file.</p>
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-xs text-slate-400">
                                        Impor hanya menambahkan absensi baru. Jika ada baris tidak valid, seluruh proses dibatalkan.
                                    </p>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        disabled={attendanceImporting || attendanceImportPreview.invalid > 0 || attendanceImportPreview.ready === 0}
                                        onClick={importAttendanceCsv}
                                    >
                                        <Upload size={15} />
                                        {attendanceImporting ? "Mengimpor..." : "Impor absensi"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-[900px]">
                            <thead><tr><th>Karyawan</th><th>Status</th><th>Masuk</th><th>Pulang</th><th>Catatan</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="6" className="py-10 text-center text-slate-400">Memuat absensi...</td></tr>
                                ) : attendanceRows.length ? attendanceRows.map((employee) => (
                                    <tr key={employee.id}>
                                        <td>
                                            <strong className="text-white">{employee.name}</strong>
                                            <small className="mt-1 block text-slate-500">{employee.employee_code} · {employee.branch?.name || "Pusat"}</small>
                                            {employee.attendance.source === "csv" && (
                                                <small className="mt-1 block text-sky-300">Sumber CSV · {dateLabel(employee.attendance.imported_at)}</small>
                                            )}
                                        </td>
                                        <td>
                                            <select className="form-input min-w-36" value={employee.attendance.status} onChange={(event) => updateAttendance(employee.id, "status", event.target.value)}>
                                                <option value="">Belum dicatat</option>
                                                {Object.entries(attendanceStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                            </select>
                                        </td>
                                        <td><input className="form-input w-32" type="time" value={employee.attendance.check_in} onChange={(event) => updateAttendance(employee.id, "check_in", event.target.value)} aria-label={`Jam masuk ${employee.name}`} /></td>
                                        <td><input className="form-input w-32" type="time" value={employee.attendance.check_out} onChange={(event) => updateAttendance(employee.id, "check_out", event.target.value)} aria-label={`Jam pulang ${employee.name}`} /></td>
                                        <td><input className="form-input min-w-40" value={employee.attendance.notes} maxLength={2000} onChange={(event) => updateAttendance(employee.id, "notes", event.target.value)} placeholder="Catatan" /></td>
                                        <td><button type="button" className="primary-button" disabled={savingRow === employee.id} onClick={() => saveAttendance(employee)}><Check size={15} />{savingRow === employee.id ? "..." : "Simpan"}</button></td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" className="py-10 text-center text-slate-400">Belum ada karyawan aktif untuk dicatat.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === "leaves" && (
                <section className="panel overflow-hidden">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="panel-title">Pengajuan cuti & izin</h3>
                            <p className="panel-subtitle mt-1">HR mencatat permohonan dan menyimpan keputusan.</p>
                        </div>
                        <div className="flex gap-2">
                            <select className="dark-select" value={leaveStatus} onChange={(event) => setLeaveStatus(event.target.value)}>
                                <option value="pending">Menunggu</option>
                                <option value="approved">Disetujui</option>
                                <option value="rejected">Ditolak</option>
                                <option value="">Semua</option>
                            </select>
                            <button type="button" className="primary-button" onClick={() => { setError(""); setLeaveForm({ ...emptyLeave }); setLeaveModal(true); }}>
                                <Plus size={16} /> Catat cuti
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-[760px]">
                            <thead><tr><th>Karyawan</th><th>Jenis</th><th>Periode</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="6" className="py-10 text-center text-slate-400">Memuat data cuti...</td></tr>
                                ) : leaves.length ? leaves.map((leave) => (
                                    <tr key={leave.id}>
                                        <td><strong className="text-white">{leave.employee?.name}</strong><small className="mt-1 block text-slate-500">{leave.employee?.employee_code}</small></td>
                                        <td>{leaveTypes[leave.leave_type] || leave.leave_type}</td>
                                        <td>{dateLabel(leave.start_date)} – {dateLabel(leave.end_date)}</td>
                                        <td className="max-w-64 whitespace-normal">{leave.reason}</td>
                                        <td><StatusPill value={leave.status} labels={{ pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" }} /></td>
                                        <td>
                                            {leave.status === "pending" ? (
                                                <div className="flex gap-2">
                                                    <button type="button" className="secondary-button text-emerald-300" disabled={savingRow === leave.id} onClick={() => reviewLeave(leave, "approved")} aria-label="Setujui cuti"><Check size={15} /></button>
                                                    <button type="button" className="secondary-button text-rose-300" disabled={savingRow === leave.id} onClick={() => reviewLeave(leave, "rejected")} aria-label="Tolak cuti"><X size={15} /></button>
                                                </div>
                                            ) : <span className="text-xs text-slate-500">{leave.reviewer?.name || "—"}</span>}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" className="py-10 text-center text-slate-400">Tidak ada pengajuan pada filter ini.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === "payroll" && (
                <section className="panel overflow-hidden">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="panel-title">Payroll bulanan & bonus</h3>
                            <p className="panel-subtitle mt-1">Komponen gaji diinput HR; pajak dan BPJS tidak dihitung otomatis.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Field label="Periode">
                                <input className="form-input" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
                            </Field>
                            <button type="button" className="primary-button self-end" disabled={saving} onClick={generatePayroll}>
                                <Plus size={16} />{saving ? "Memproses..." : "Buat draft payroll"}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-[1000px]">
                            <thead><tr><th>Karyawan</th><th>Gaji pokok</th><th>Penghasilan</th><th>Potongan</th><th>Gaji bersih</th><th>Status</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="py-10 text-center text-slate-400">Memuat payroll...</td></tr>
                                ) : payrolls.length ? payrolls.map((payroll) => (
                                    <tr key={payroll.id}>
                                        <td><strong className="text-white">{payroll.employee?.name}</strong><small className="mt-1 block text-slate-500">{payroll.employee?.employee_code} · {payroll.employee?.branch?.name || "Pusat"}</small></td>
                                        <td>{money(payroll.base_salary)}</td>
                                        <td>{money(payroll.total_earnings)}</td>
                                        <td>{money(payroll.total_deductions)}</td>
                                        <td className="font-semibold text-white">{money(payroll.net_pay)}</td>
                                        <td><StatusPill value={payroll.status} labels={payrollStatuses} /></td>
                                        <td>
                                            <div className="flex flex-wrap gap-2">
                                                {payroll.status === "draft" && (
                                                    <>
                                                        <button type="button" className="secondary-button" onClick={() => openPayrollEditor(payroll)} aria-label="Edit komponen payroll"><Pencil size={15} /></button>
                                                        <button type="button" className="primary-button" disabled={savingRow === payroll.id} onClick={() => changePayrollStatus(payroll, "approve")}><Check size={15} /> Setujui</button>
                                                    </>
                                                )}
                                                {payroll.status === "approved" && (
                                                    <button type="button" className="primary-button" disabled={savingRow === payroll.id} onClick={() => changePayrollStatus(payroll, "paid")}>Tandai dibayar</button>
                                                )}
                                                {payroll.status !== "draft" && (
                                                    <button type="button" className="secondary-button" onClick={() => setSlip(payroll)}><Printer size={15} /> Slip</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="7" className="py-10 text-center text-slate-400">Belum ada payroll untuk periode ini. Buat draft untuk seluruh karyawan aktif.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {employeeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <section className="panel max-h-[92vh] w-full max-w-3xl overflow-y-auto">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="panel-title">{editingEmployee ? "Edit karyawan" : "Tambah karyawan"}</h3>
                                <p className="panel-subtitle mt-1">Data gaji dan informasi personal hanya terlihat oleh HR.</p>
                            </div>
                            <button type="button" className="secondary-button" onClick={() => setEmployeeModal(false)} aria-label="Tutup"><X size={16} /></button>
                        </div>
                        <form onSubmit={saveEmployee} className="grid gap-4 sm:grid-cols-2">
                            <Field label="Kode karyawan *"><input className="form-input" required maxLength={40} value={employeeForm.employee_code} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_code: event.target.value })} /></Field>
                            <Field label="Nama lengkap *"><input className="form-input" required maxLength={255} value={employeeForm.name} onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })} /></Field>
                            <Field label="Departemen"><input className="form-input" maxLength={120} value={employeeForm.department} onChange={(event) => setEmployeeForm({ ...employeeForm, department: event.target.value })} /></Field>
                            <Field label="Jabatan"><input className="form-input" maxLength={120} value={employeeForm.position} onChange={(event) => setEmployeeForm({ ...employeeForm, position: event.target.value })} /></Field>
                            <Field label="Cabang">
                                <select className="form-input" value={employeeForm.branch_id} onChange={(event) => setEmployeeForm({ ...employeeForm, branch_id: event.target.value })}>
                                    <option value="">Pusat / tidak ditentukan</option>
                                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Tipe kerja">
                                <select className="form-input" value={employeeForm.employment_type} onChange={(event) => setEmployeeForm({ ...employeeForm, employment_type: event.target.value })}>
                                    <option value="permanent">Tetap</option>
                                    <option value="contract">Kontrak</option>
                                    <option value="part_time">Paruh waktu</option>
                                    <option value="intern">Magang</option>
                                </select>
                            </Field>
                            <Field label="Gaji pokok bulanan *"><input className="form-input" type="number" min="0" step="0.01" required value={employeeForm.base_salary} onChange={(event) => setEmployeeForm({ ...employeeForm, base_salary: event.target.value })} /></Field>
                            <Field label="Tanggal mulai kerja"><input className="form-input" type="date" value={employeeForm.hire_date} onChange={(event) => setEmployeeForm({ ...employeeForm, hire_date: event.target.value })} /></Field>
                            <Field label="Email"><input className="form-input" type="email" maxLength={255} value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} /></Field>
                            <Field label="Telepon"><input className="form-input" maxLength={40} value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })} /></Field>
                            <Field label="Catatan" className="sm:col-span-2"><textarea className="form-input min-h-20" maxLength={2000} value={employeeForm.notes} onChange={(event) => setEmployeeForm({ ...employeeForm, notes: event.target.value })} /></Field>
                            <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
                                <input type="checkbox" checked={employeeForm.is_active} onChange={(event) => setEmployeeForm({ ...employeeForm, is_active: event.target.checked })} />
                                Karyawan aktif
                            </label>
                            {error && <p className="text-sm text-rose-300 sm:col-span-2" role="alert">{error}</p>}
                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 sm:col-span-2">
                                <button type="button" className="secondary-button" onClick={() => setEmployeeModal(false)}>Batal</button>
                                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan..." : "Simpan karyawan"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {leaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <section className="panel w-full max-w-xl">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h3 className="panel-title">Catat pengajuan cuti</h3>
                                <p className="panel-subtitle mt-1">Pengajuan akan berstatus menunggu persetujuan.</p>
                            </div>
                            <button type="button" className="secondary-button" onClick={() => setLeaveModal(false)} aria-label="Tutup"><X size={16} /></button>
                        </div>
                        <form onSubmit={saveLeave} className="space-y-4">
                            <Field label="Karyawan *">
                                <select className="form-input" required value={leaveForm.employee_id} onChange={(event) => setLeaveForm({ ...leaveForm, employee_id: event.target.value })}>
                                    <option value="">Pilih karyawan</option>
                                    {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} · {employee.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Jenis cuti *">
                                <select className="form-input" value={leaveForm.leave_type} onChange={(event) => setLeaveForm({ ...leaveForm, leave_type: event.target.value })}>
                                    {Object.entries(leaveTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Mulai *"><input className="form-input" type="date" required value={leaveForm.start_date} onChange={(event) => setLeaveForm({ ...leaveForm, start_date: event.target.value })} /></Field>
                                <Field label="Selesai *"><input className="form-input" type="date" required value={leaveForm.end_date} onChange={(event) => setLeaveForm({ ...leaveForm, end_date: event.target.value })} /></Field>
                            </div>
                            <Field label="Alasan *"><textarea className="form-input min-h-24" required maxLength={2000} value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} /></Field>
                            {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                                <button type="button" className="secondary-button" onClick={() => setLeaveModal(false)}>Batal</button>
                                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Menyimpan..." : "Simpan pengajuan"}</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {editingPayroll && (
                <PayrollEditor
                    payroll={editingPayroll}
                    draft={payrollDraft}
                    setDraft={setPayrollDraft}
                    onClose={() => setEditingPayroll(null)}
                    onSave={savePayrollDraft}
                    saving={saving}
                    error={error}
                />
            )}

            {slip && <PayrollSlipPrintDocument payroll={slip} />}
        </div>
    );
}
