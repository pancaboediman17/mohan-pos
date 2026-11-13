import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    CreditCard,
    Wallet,
    Receipt,
    RefreshCw,
    Plus,
    Search,
    X,
    Eye,
    CalendarDays,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import api from "../services/api";

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const dateFormat = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getList = (response) => {
    const data = response.data?.data;
    return Array.isArray(data) ? data : [];
};

const methodLabels = {
    cash: "Tunai",
    transfer: "Transfer Bank",
    qris: "QRIS",
    debit: "Kartu Debit",
    credit: "Kartu Kredit",
    other: "Lainnya",
};

function Field({ label, children }) {
    return (
        <label className="form-field">
            <span>{label}</span>
            {children}
        </label>
    );
}

function PaymentStatus({ status }) {
    const config = {
        unpaid: {
            label: "Belum Dibayar",
            style: "bg-red-500/10 text-red-400 border-red-500/20",
        },
        partial: {
            label: "Dibayar Sebagian",
            style: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        },
        paid: {
            label: "Lunas",
            style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        },
    };

    const item = config[status] || {
        label: status || "-",
        style: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };

    return <span className={`status-badge ${item.style}`}>{item.label}</span>;
}

export default function Payments({ canCreate = false }) {
    const [payments, setPayments] = useState([]);
    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");
    const [search, setSearch] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);

    const [form, setForm] = useState({
        order_id: "",
        amount: "",
        method: "cash",
        reference_number: "",
        notes: "",
    });

    const loadPayments = useCallback(async (page = 1) => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get("/api/v1/payments", {
                params: { page },
            });

            setPayments(getList(response));
            setPagination({
                currentPage: response.data?.current_page || 1,
                lastPage: response.data?.last_page || 1,
                total: response.data?.total || 0,
            });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Gagal memuat riwayat pembayaran.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const loadOutstandingOrders = useCallback(async () => {
        try {
            const response = await api.get("/api/v1/orders", {
                params: {
                    payment_status: "unpaid",
                    per_page: 100,
                },
            });

            const unpaidOrders = getList(response);

            const partialResponse = await api.get("/api/v1/orders", {
                params: {
                    payment_status: "partial",
                    per_page: 100,
                },
            });

            const partialOrders = getList(partialResponse);

            const combined = [...unpaidOrders, ...partialOrders];
            const unique = Array.from(
                new Map(combined.map((order) => [order.id, order])).values(),
            );

            setOrders(
                unique.filter(
                    (order) =>
                        Number(order.balance) > 0 &&
                        order.status !== "cancelled",
                ),
            );
        } catch (err) {
            console.error("Gagal memuat daftar tagihan:", err);
        }
    }, []);

    useEffect(() => {
        loadPayments(1);
        loadOutstandingOrders();
    }, [loadPayments, loadOutstandingOrders]);

    const selectedOrder = useMemo(
        () =>
            orders.find((order) => String(order.id) === String(form.order_id)),
        [orders, form.order_id],
    );

    const totalReceived = useMemo(
        () =>
            payments.reduce(
                (total, payment) => total + Number(payment.amount || 0),
                0,
            ),
        [payments],
    );

    const activeReceivables = useMemo(
        () =>
            orders.reduce(
                (total, order) => total + Number(order.balance || 0),
                0,
            ),
        [orders],
    );

    const filteredPayments = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) return payments;

        return payments.filter((payment) => {
            const values = [
                payment.payment_number,
                payment.order?.order_number,
                payment.order?.customer?.name,
                payment.reference_number,
                payment.receiver?.name,
            ];

            return values.some((value) =>
                String(value || "")
                    .toLowerCase()
                    .includes(keyword),
            );
        });
    }, [payments, search]);

    const resetForm = () => {
        setForm({
            order_id: "",
            amount: "",
            method: "cash",
            reference_number: "",
            notes: "",
        });
        setFormError("");
    };

    const openForm = () => {
        resetForm();
        setShowForm(true);
    };

    const handleOrderChange = (orderId) => {
        const order = orders.find(
            (item) => String(item.id) === String(orderId),
        );

        setForm((current) => ({
            ...current,
            order_id: orderId,
            amount: order ? String(Number(order.balance)) : "",
        }));
        setFormError("");
    };

    const submitPayment = async (event) => {
        event.preventDefault();
        setFormError("");

        if (!form.order_id) {
            setFormError("Pilih pesanan terlebih dahulu.");
            return;
        }

        const amount = Number(form.amount);
        const balance = Number(selectedOrder?.balance || 0);

        if (!Number.isFinite(amount) || amount <= 0) {
            setFormError("Nominal pembayaran harus lebih besar dari nol.");
            return;
        }

        if (amount > balance) {
            setFormError("Nominal pembayaran melebihi sisa tagihan.");
            return;
        }

        setSaving(true);

        try {
            await api.post("/api/v1/payments", {
                order_id: Number(form.order_id),
                amount,
                method: form.method,
                reference_number: form.reference_number || null,
                notes: form.notes || null,
            });

            setShowForm(false);
            resetForm();

            await Promise.all([loadPayments(1), loadOutstandingOrders()]);
        } catch (err) {
            const validationErrors = err.response?.data?.errors;
            const firstError = validationErrors
                ? Object.values(validationErrors).flat()[0]
                : null;

            setFormError(
                firstError ||
                    err.response?.data?.message ||
                    "Pembayaran gagal disimpan.",
            );
        } finally {
            setSaving(false);
        }
    };

    const showDetail = (payment) => {
        setSelectedPayment(payment);
    };

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Manajemen Pembayaran
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Catat penerimaan dan pantau pembayaran pesanan
                        pelanggan.
                    </p>
                </div>

                {canCreate && (
                    <button
                        type="button"
                        className="primary-button"
                        onClick={openForm}
                    >
                        <Plus size={16} />
                        Catat Pembayaran
                    </button>
                )}
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                    <AlertCircle size={16} className="inline mr-2" />
                    {error}
                    <button
                        type="button"
                        className="ml-3 underline"
                        onClick={() => loadPayments(1)}
                    >
                        Coba lagi
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Total Pembayaran
                            </p>
                            <p className="text-2xl font-bold text-white mt-2">
                                {pagination?.total ?? payments.length}
                            </p>
                        </div>
                        <div className="stat-icon">
                            <CreditCard size={21} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        Jumlah transaksi pada seluruh halaman
                    </p>
                </div>

                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Nilai Pembayaran Termuat
                            </p>
                            <p className="text-xl font-bold text-emerald-400 mt-2">
                                {money(totalReceived)}
                            </p>
                        </div>
                        <div className="stat-icon">
                            <Wallet size={21} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        Akumulasi transaksi pada halaman ini
                    </p>
                </div>

                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Tagihan Aktif Termuat
                            </p>
                            <p className="text-xl font-bold text-amber-400 mt-2">
                                {money(activeReceivables)}
                            </p>
                        </div>
                        <div className="stat-icon">
                            <Receipt size={21} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        Sisa tagihan dari pesanan yang dimuat
                    </p>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Riwayat Pembayaran</h3>
                        <p className="panel-subtitle">
                            Daftar penerimaan pembayaran yang tercatat di sistem
                        </p>
                    </div>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                            loadPayments(1);
                            loadOutstandingOrders();
                        }}
                        disabled={loading}
                    >
                        <RefreshCw
                            size={15}
                            className={loading ? "animate-spin" : ""}
                        />
                        Muat Ulang
                    </button>
                </div>

                <div className="p-4 border-b border-slate-700/50">
                    <div className="relative max-w-md">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            type="text"
                            className="form-input pl-10"
                            placeholder="Cari nomor pembayaran, pesanan, pelanggan..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Pembayaran</th>
                                <th>No. Pesanan</th>
                                <th>Pelanggan</th>
                                <th>Tanggal</th>
                                <th>Metode</th>
                                <th>Nominal</th>
                                <th>Petugas</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-10 text-slate-400"
                                    >
                                        Memuat riwayat pembayaran...
                                    </td>
                                </tr>
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="8"
                                        className="text-center py-10 text-slate-400"
                                    >
                                        Belum ada data pembayaran.
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td className="font-medium text-white">
                                            {payment.payment_number}
                                        </td>
                                        <td>
                                            {payment.order?.order_number || "-"}
                                        </td>
                                        <td>
                                            {payment.order?.customer?.name ||
                                                "Umum"}
                                        </td>
                                        <td>{dateFormat(payment.paid_at)}</td>
                                        <td>
                                            {methodLabels[payment.method] ||
                                                payment.method}
                                        </td>
                                        <td className="font-semibold text-emerald-400">
                                            {money(payment.amount)}
                                        </td>
                                        <td>{payment.receiver?.name || "-"}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() =>
                                                    showDetail(payment)
                                                }
                                                title="Lihat detail"
                                            >
                                                <Eye size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination && pagination.lastPage > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-700/50">
                        <span className="text-xs text-slate-400">
                            Halaman {pagination.currentPage} dari{" "}
                            {pagination.lastPage}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="secondary-button"
                                disabled={
                                    pagination.currentPage <= 1 || loading
                                }
                                onClick={() =>
                                    loadPayments(pagination.currentPage - 1)
                                }
                            >
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                className="secondary-button"
                                disabled={
                                    pagination.currentPage >=
                                        pagination.lastPage || loading
                                }
                                onClick={() =>
                                    loadPayments(pagination.currentPage + 1)
                                }
                            >
                                Berikutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-slate-700">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    Catat Pembayaran
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Masukkan penerimaan pembayaran pelanggan
                                </p>
                            </div>
                            <button
                                type="button"
                                className="text-slate-400 hover:text-white"
                                onClick={() => setShowForm(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={submitPayment}
                            className="p-5 space-y-4"
                        >
                            {formError && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                    <AlertCircle
                                        size={15}
                                        className="inline mr-2"
                                    />
                                    {formError}
                                </div>
                            )}

                            <Field label="Pilih Pesanan">
                                <select
                                    className="form-input"
                                    value={form.order_id}
                                    onChange={(event) =>
                                        handleOrderChange(event.target.value)
                                    }
                                    required
                                >
                                    <option value="">
                                        -- Pilih pesanan --
                                    </option>
                                    {orders.map((order) => (
                                        <option key={order.id} value={order.id}>
                                            {order.order_number} —{" "}
                                            {order.customer?.name || "Umum"} —
                                            Sisa {money(order.balance)}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            {selectedOrder && (
                                <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">
                                            Total Pesanan
                                        </span>
                                        <span className="text-white">
                                            {money(selectedOrder.total)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">
                                            Sudah Dibayar
                                        </span>
                                        <span className="text-emerald-400">
                                            {money(selectedOrder.paid_amount)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm font-semibold">
                                        <span className="text-amber-400">
                                            Sisa Tagihan
                                        </span>
                                        <span className="text-amber-400">
                                            {money(selectedOrder.balance)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <Field label="Nominal Pembayaran">
                                <input
                                    type="number"
                                    className="form-input"
                                    min="1"
                                    max={selectedOrder?.balance || undefined}
                                    step="0.01"
                                    placeholder="Masukkan nominal pembayaran"
                                    value={form.amount}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            amount: event.target.value,
                                        }))
                                    }
                                    required
                                />
                            </Field>

                            <Field label="Metode Pembayaran">
                                <select
                                    className="form-input"
                                    value={form.method}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            method: event.target.value,
                                        }))
                                    }
                                    required
                                >
                                    {Object.entries(methodLabels).map(
                                        ([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </Field>

                            <Field label="Nomor Referensi (Opsional)">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Contoh: nomor referensi transfer"
                                    value={form.reference_number}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            reference_number:
                                                event.target.value,
                                        }))
                                    }
                                />
                            </Field>

                            <Field label="Catatan (Opsional)">
                                <textarea
                                    className="form-input min-h-20"
                                    placeholder="Catatan pembayaran..."
                                    value={form.notes}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            notes: event.target.value,
                                        }))
                                    }
                                />
                            </Field>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setShowForm(false)}
                                    disabled={saving}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={saving || !orders.length}
                                >
                                    {saving
                                        ? "Menyimpan..."
                                        : "Simpan Pembayaran"}
                                </button>
                            </div>

                            {!orders.length && (
                                <p className="text-xs text-amber-400">
                                    Tidak ada pesanan dengan sisa tagihan yang
                                    dapat dibayar.
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-700">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    Detail Pembayaran
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {selectedPayment.payment_number}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="text-slate-400 hover:text-white"
                                onClick={() => setSelectedPayment(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400">
                                    Nomor Pesanan
                                </span>
                                <span className="text-white">
                                    {selectedPayment.order?.order_number || "-"}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400">
                                    Pelanggan
                                </span>
                                <span className="text-white">
                                    {selectedPayment.order?.customer?.name ||
                                        "Umum"}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Tanggal</span>
                                <span className="text-white">
                                    {dateFormat(selectedPayment.paid_at)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Metode</span>
                                <span className="text-white">
                                    {methodLabels[selectedPayment.method] ||
                                        selectedPayment.method}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400">
                                    Nomor Referensi
                                </span>
                                <span className="text-white">
                                    {selectedPayment.reference_number || "-"}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Petugas</span>
                                <span className="text-white">
                                    {selectedPayment.receiver?.name || "-"}
                                </span>
                            </div>

                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                                <p className="text-sm text-emerald-400">
                                    Nominal Pembayaran
                                </p>
                                <p className="text-2xl font-bold text-emerald-400 mt-1">
                                    {money(selectedPayment.amount)}
                                </p>
                            </div>

                            {selectedPayment.notes && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">
                                        Catatan
                                    </p>
                                    <p className="text-sm text-white">
                                        {selectedPayment.notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end p-5 border-t border-slate-700">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setSelectedPayment(null)}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
