import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    Banknote,
    CalendarDays,
    CheckCircle2,
    Clock3,
    DoorClosed,
    DoorOpen,
    RefreshCw,
    Wallet,
} from "lucide-react";
import api from "../services/api";

const localDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

const dateTime = (value) =>
    value
        ? new Date(value).toLocaleString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—";

const methodLabels = {
    cash: "Tunai",
    transfer: "Transfer",
    qris: "QRIS",
    debit: "Kartu debit",
    credit: "Kartu kredit",
    other: "Lainnya",
};

const requestError = (error, fallback) =>
    Object.values(error.response?.data?.errors || {}).flat()[0] ||
    error.response?.data?.message ||
    fallback;

function Metric({ label, value, detail, icon: Icon }) {
    return (
        <div className="stat-card">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-2 break-words text-xl font-bold text-white">
                        {value}
                    </p>
                    {detail && (
                        <p className="mt-1 text-xs text-slate-500">{detail}</p>
                    )}
                </div>
                <div className="stat-icon">
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
}

export default function CashierRegister({ onShiftChange }) {
    const [reportDate, setReportDate] = useState(() => localDate(new Date()));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [openingCash, setOpeningCash] = useState("0");
    const [openingNotes, setOpeningNotes] = useState("");
    const [closingCash, setClosingCash] = useState("");
    const [closingNotes, setClosingNotes] = useState("");

    const loadReport = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get("/api/v1/cash-register", {
                params: { date: reportDate },
            });
            const result = response.data.data;
            setData(result);
            onShiftChange(Boolean(result.current_shift));
        } catch (requestErrorValue) {
            setError(
                requestError(
                    requestErrorValue,
                    "Laporan kasir gagal dimuat.",
                ),
            );
            onShiftChange(false);
        } finally {
            setLoading(false);
        }
    }, [onShiftChange, reportDate]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const openRegister = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");

        try {
            await api.post("/api/v1/cash-register/open", {
                opening_cash: openingCash,
                opening_notes: openingNotes || null,
            });
            setMessage("Kasir berhasil dibuka. Pembayaran kini tercatat dalam shift ini.");
            setOpeningCash("0");
            setOpeningNotes("");
            await loadReport();
        } catch (requestErrorValue) {
            setError(
                requestError(
                    requestErrorValue,
                    "Kasir gagal dibuka. Silakan coba lagi.",
                ),
            );
        } finally {
            setSaving(false);
        }
    };

    const closeRegister = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");

        try {
            const response = await api.post("/api/v1/cash-register/close", {
                closing_cash: closingCash,
                closing_notes: closingNotes || null,
            });
            const variance = Number(response.data?.data?.cash_variance || 0);
            setMessage(
                `Kasir ditutup. ${variance === 0 ? "Kas sesuai." : `Selisih kas ${money(variance)}.`}`,
            );
            setClosingCash("");
            setClosingNotes("");
            await loadReport();
        } catch (requestErrorValue) {
            setError(
                requestError(
                    requestErrorValue,
                    "Kasir gagal ditutup. Silakan coba lagi.",
                ),
            );
        } finally {
            setSaving(false);
        }
    };

    const report = data?.daily_report;
    const shift = data?.current_shift;

    return (
        <section className="space-y-4">
            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Buka / Tutup Kasir</h3>
                        <p className="panel-subtitle">
                            Catat saldo awal dan cocokkan kas saat pergantian shift.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={loadReport}
                        disabled={loading}
                    >
                        <RefreshCw
                            size={15}
                            className={loading ? "animate-spin" : ""}
                        />
                        Muat Ulang
                    </button>
                </div>

                {error && (
                    <div
                        className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
                        role="alert"
                    >
                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                {message && (
                    <div
                        className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300"
                        role="status"
                    >
                        <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                        <span>{message}</span>
                    </div>
                )}

                {loading && !data ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                        Memuat status kasir...
                    </p>
                ) : shift ? (
                    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <div className="flex items-center gap-2 text-emerald-300">
                                <DoorOpen size={19} />
                                <span className="font-semibold">
                                    Shift sedang terbuka
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                                Dibuka {dateTime(shift.opened_at)}
                                {shift.branch ? ` · ${shift.branch}` : ""}
                            </p>
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Saldo awal
                                    </p>
                                    <p className="mt-1 font-semibold text-white">
                                        {money(shift.opening_cash)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Pembayaran tunai
                                    </p>
                                    <p className="mt-1 font-semibold text-white">
                                        {money(shift.cash_received)}
                                    </p>
                                </div>
                                <div className="col-span-2 rounded-lg bg-slate-950/30 p-3">
                                    <p className="text-xs text-slate-400">
                                        Kas yang diharapkan
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-white">
                                        {money(shift.expected_cash)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form
                            className="grid content-start gap-3"
                            onSubmit={closeRegister}
                        >
                            <label className="form-field">
                                <span>Uang tunai fisik saat ini (Rp) *</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0"
                                    step="1"
                                    required
                                    value={closingCash}
                                    onChange={(event) =>
                                        setClosingCash(event.target.value)
                                    }
                                    placeholder="Hitung uang di laci"
                                />
                            </label>
                            <label className="form-field">
                                <span>Catatan tutup shift</span>
                                <textarea
                                    className="form-input min-h-20"
                                    maxLength={2000}
                                    value={closingNotes}
                                    onChange={(event) =>
                                        setClosingNotes(event.target.value)
                                    }
                                    placeholder="Catatan selisih atau serah terima..."
                                />
                            </label>
                            <button
                                type="submit"
                                className="primary-button justify-self-start"
                                disabled={saving}
                            >
                                <DoorClosed size={16} />
                                {saving ? "Memproses..." : "Tutup Kasir"}
                            </button>
                        </form>
                    </div>
                ) : (
                    <form
                        className="mt-5 grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end"
                        onSubmit={openRegister}
                    >
                        <label className="form-field">
                            <span>Saldo awal laci (Rp) *</span>
                            <input
                                className="form-input"
                                type="number"
                                min="0"
                                step="1"
                                required
                                value={openingCash}
                                onChange={(event) =>
                                    setOpeningCash(event.target.value)
                                }
                            />
                        </label>
                        <label className="form-field">
                            <span>Catatan buka shift</span>
                            <input
                                className="form-input"
                                maxLength={2000}
                                value={openingNotes}
                                onChange={(event) =>
                                    setOpeningNotes(event.target.value)
                                }
                                placeholder="Opsional"
                            />
                        </label>
                        <button
                            type="submit"
                            className="primary-button"
                            disabled={saving || loading}
                        >
                            <DoorOpen size={16} />
                            {saving ? "Memproses..." : "Buka Kasir"}
                        </button>
                    </form>
                )}
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Laporan Kasir Harian</h3>
                        <p className="panel-subtitle">
                            Ringkasan pesanan dan pembayaran yang dicatat oleh Anda.
                        </p>
                    </div>
                    <label className="form-field min-w-44">
                        <span className="sr-only">Tanggal laporan</span>
                        <span className="flex items-center gap-2">
                            <CalendarDays size={15} />
                            Tanggal
                        </span>
                        <input
                            className="form-input"
                            type="date"
                            required
                            value={reportDate}
                            max={localDate(new Date())}
                            onChange={(event) =>
                                setReportDate(event.target.value)
                            }
                        />
                    </label>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric
                        label="Pesanan dibuat"
                        value={report?.order_count ?? "—"}
                        detail={money(report?.order_value)}
                        icon={CalendarDays}
                    />
                    <Metric
                        label="Pembayaran diterima"
                        value={money(report?.payments_received)}
                        detail={`${report?.payment_count ?? 0} transaksi`}
                        icon={Wallet}
                    />
                    <Metric
                        label="Penerimaan tunai"
                        value={money(report?.cash_received)}
                        detail="Kas masuk hari ini"
                        icon={Banknote}
                    />
                    <Metric
                        label="Shift kasir"
                        value={data?.shifts?.length ?? "—"}
                        detail="Dibuka pada tanggal terpilih"
                        icon={Clock3}
                    />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div>
                        <h4 className="mb-3 text-sm font-semibold text-white">
                            Rincian metode pembayaran
                        </h4>
                        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
                            {report?.payment_methods?.length ? (
                                report.payment_methods.map((item) => (
                                    <div
                                        key={item.method}
                                        className="flex items-center justify-between gap-3 px-4 py-3"
                                    >
                                        <span className="text-sm text-slate-300">
                                            {methodLabels[item.method] ||
                                                item.method}
                                            <span className="ml-2 text-xs text-slate-500">
                                                {item.payment_count} transaksi
                                            </span>
                                        </span>
                                        <span className="text-sm font-semibold text-white">
                                            {money(item.amount)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="px-4 py-6 text-center text-sm text-slate-500">
                                    Belum ada pembayaran pada tanggal ini.
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-3 text-sm font-semibold text-white">
                            Riwayat shift pada tanggal ini
                        </h4>
                        <div className="space-y-3">
                            {data?.shifts?.length ? (
                                data.shifts.map((item) => (
                                    <article
                                        key={item.id}
                                        className="rounded-lg border border-slate-800 p-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-white">
                                                {dateTime(item.opened_at)}
                                            </span>
                                            <span
                                                className={`status-badge ${
                                                    item.status === "open"
                                                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                                        : "bg-slate-500/10 text-slate-300 border-slate-500/20"
                                                }`}
                                            >
                                                {item.status === "open"
                                                    ? "Terbuka"
                                                    : "Ditutup"}
                                            </span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                            <p className="text-slate-400">
                                                Saldo awal{" "}
                                                <strong className="text-slate-200">
                                                    {money(item.opening_cash)}
                                                </strong>
                                            </p>
                                            <p className="text-slate-400">
                                                Kas diharapkan{" "}
                                                <strong className="text-slate-200">
                                                    {money(item.expected_cash)}
                                                </strong>
                                            </p>
                                            {item.closing_cash !== null && (
                                                <>
                                                    <p className="text-slate-400">
                                                        Kas dihitung{" "}
                                                        <strong className="text-slate-200">
                                                            {money(item.closing_cash)}
                                                        </strong>
                                                    </p>
                                                    <p className="text-slate-400">
                                                        Selisih{" "}
                                                        <strong
                                                            className={
                                                                item.cash_variance === 0
                                                                    ? "text-emerald-300"
                                                                    : "text-amber-300"
                                                            }
                                                        >
                                                            {money(item.cash_variance)}
                                                        </strong>
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <p className="rounded-lg border border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
                                    Belum ada shift pada tanggal ini.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <h4 className="mb-3 text-sm font-semibold text-white">
                        Pembayaran terbaru
                    </h4>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Waktu</th>
                                    <th>No. Pesanan</th>
                                    <th>Pelanggan</th>
                                    <th>Metode</th>
                                    <th>Jumlah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report?.recent_payments?.length ? (
                                    report.recent_payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td>{dateTime(payment.paid_at)}</td>
                                            <td className="font-medium text-white">
                                                {payment.order?.order_number || "—"}
                                            </td>
                                            <td>
                                                {payment.order?.customer?.name ||
                                                    "Pelanggan Umum"}
                                            </td>
                                            <td>
                                                {methodLabels[payment.method] ||
                                                    payment.method}
                                            </td>
                                            <td className="font-semibold text-white">
                                                {money(payment.amount)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="py-8 text-center text-slate-500"
                                        >
                                            Belum ada pembayaran pada tanggal ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}
