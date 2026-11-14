import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Printer } from "lucide-react";
import api from "../services/api";
import { InvoicePrintDocument } from "./TransactionDocuments";

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const dateFormat = (value) =>
    value
        ? new Date(value).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : "-";

export default function PublicQuoteApproval({ token }) {
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [decision, setDecision] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const loadQuote = async () => {
            try {
                const response = await api.get(
                    `/api/v1/public/quotes/${encodeURIComponent(token)}`,
                );
                setQuote(response.data?.data || null);
            } catch (requestError) {
                setError(
                    requestError.response?.data?.message ||
                        "Tautan penawaran tidak valid atau sudah digunakan.",
                );
            } finally {
                setLoading(false);
            }
        };

        loadQuote();
    }, [token]);

    const respond = async (choice) => {
        if (
            !window.confirm(
                choice === "approve"
                    ? "Setujui penawaran ini?"
                    : "Tolak penawaran ini?",
            )
        ) {
            return;
        }

        setSaving(true);
        setError("");

        try {
            const response = await api.post(
                `/api/v1/public/quotes/${encodeURIComponent(token)}/decision`,
                { decision: choice, note: note.trim() || null },
            );
            setDecision(response.data?.quote_status || "");
            window.history.replaceState(null, "", window.location.pathname);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Jawaban penawaran gagal disimpan.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
            <section className="panel mx-auto w-full max-w-3xl">
                <div className="mb-6 border-b border-slate-800 pb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                        PRINTFLOW POS
                    </p>
                    <h1 className="mt-2 text-2xl font-bold text-white">
                        Persetujuan Penawaran
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Periksa rincian harga sebelum memberikan jawaban.
                    </p>
                </div>

                {loading && (
                    <p role="status" className="py-8 text-center text-slate-400">
                        Memuat penawaran...
                    </p>
                )}

                {error && (
                    <div
                        role="alert"
                        className="mb-5 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
                    >
                        <AlertCircle size={17} className="shrink-0" />
                        {error}
                    </div>
                )}

                {quote && (
                    <>
                        <div className="mb-6 grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-slate-500">
                                    Nomor penawaran
                                </p>
                                <p className="mt-1 font-semibold text-white">
                                    {quote.order_number}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">
                                    Untuk
                                </p>
                                <p className="mt-1 font-semibold text-white">
                                    {quote.customer_name}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">
                                    Tanggal penawaran
                                </p>
                                <p className="mt-1 text-white">
                                    {dateFormat(quote.created_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">
                                    Target penyelesaian
                                </p>
                                <p className="mt-1 text-white">
                                    {dateFormat(quote.due_date)}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Deskripsi</th>
                                        <th>Kuantitas</th>
                                        <th>Harga satuan</th>
                                        <th>Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quote.items.map((item, index) => (
                                        <tr key={`${item.product_name}-${index}`}>
                                            <td>
                                                <p className="font-medium text-white">
                                                    {item.product_name}
                                                </p>
                                                {item.specifications && (
                                                    <p className="text-xs text-slate-400">
                                                        {item.specifications}
                                                    </p>
                                                )}
                                                {!!item.finishings?.length && (
                                                    <p className="text-xs text-slate-400">
                                                        Finishing:{" "}
                                                        {item.finishings
                                                            .map(
                                                                (finishing) =>
                                                                    finishing.finishing_name,
                                                            )
                                                            .join(", ")}
                                                    </p>
                                                )}
                                            </td>
                                            <td>
                                                {Number(item.quantity)}{" "}
                                                {item.unit_name || ""}
                                            </td>
                                            <td>{money(item.unit_price)}</td>
                                            <td>{money(item.subtotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="ml-auto mt-5 max-w-sm space-y-2">
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>Subtotal</span>
                                <span>{money(quote.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>Diskon</span>
                                <span>{money(quote.discount)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-700 pt-3 font-bold text-white">
                                <span>Total penawaran</span>
                                <span>{money(quote.total)}</span>
                            </div>
                        </div>

                        {!decision ? (
                            <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
                                <label className="form-field">
                                    <span>Catatan (opsional)</span>
                                    <textarea
                                        className="form-input min-h-20"
                                        maxLength={1000}
                                        value={note}
                                        onChange={(event) =>
                                            setNote(event.target.value)
                                        }
                                        placeholder="Catatan untuk percetakan..."
                                    />
                                </label>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={saving}
                                        onClick={() => respond("reject")}
                                    >
                                        Tolak Penawaran
                                    </button>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        disabled={saving}
                                        onClick={() => respond("approve")}
                                    >
                                        <CheckCircle2 size={16} />
                                        {saving
                                            ? "Menyimpan..."
                                            : "Setujui Penawaran"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                role="status"
                                className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300"
                            >
                                <CheckCircle2 size={18} />
                                {decision === "approved"
                                    ? "Penawaran telah disetujui. Tim PRINTFLOW akan menindaklanjuti pesanan."
                                    : "Penawaran telah ditolak. Tim PRINTFLOW akan menghubungi Anda."}
                            </div>
                        )}

                        <div className="mt-5 flex justify-end print:hidden">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => window.print()}
                            >
                                <Printer size={16} />
                                Cetak Penawaran
                            </button>
                        </div>
                        <InvoicePrintDocument
                            order={{
                                ...quote,
                                quote_status: decision || "pending",
                                customer: { name: quote.customer_name },
                            }}
                            documentType="PENAWARAN HARGA"
                        />
                    </>
                )}
            </section>
        </main>
    );
}
