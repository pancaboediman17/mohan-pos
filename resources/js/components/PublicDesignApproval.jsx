import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileImage } from "lucide-react";
import api from "../services/api";

export default function PublicDesignApproval({ token }) {
    const [design, setDesign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [decision, setDecision] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDesign = async () => {
            try {
                const response = await api.get(
                    `/api/v1/public/designs/${encodeURIComponent(token)}`,
                );
                setDesign(response.data?.data || null);
            } catch (requestError) {
                setError(
                    requestError.response?.data?.message ||
                        "Tautan desain tidak valid atau tidak tersedia.",
                );
            } finally {
                setLoading(false);
            }
        };
        loadDesign();
    }, [token]);

    const respond = async (choice) => {
        if (choice === "request_revision" && !note.trim()) {
            setError("Tuliskan catatan agar tim mengetahui revisi yang diperlukan.");
            return;
        }
        if (
            !window.confirm(
                choice === "approve"
                    ? "Setujui desain ini untuk diproduksi?"
                    : "Kirim permintaan revisi desain?",
            )
        ) {
            return;
        }

        setSaving(true);
        setError("");
        try {
            const response = await api.post(
                `/api/v1/public/designs/${encodeURIComponent(token)}/decision`,
                { decision: choice, note: note.trim() || null },
            );
            setDecision(response.data?.status || "");
            setDesign((current) => ({
                ...current,
                status: response.data?.status || current.status,
                customer_note: note.trim() || null,
            }));
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Jawaban desain gagal disimpan.",
            );
        } finally {
            setSaving(false);
        }
    };

    const isImage = design?.mime_type?.startsWith("image/");
    const pending = design?.status === "pending_approval" && !decision;

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
            <section className="panel mx-auto w-full max-w-4xl">
                <header className="mb-6 border-b border-slate-800 pb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                        PRINTFLOW POS
                    </p>
                    <h1 className="mt-2 text-2xl font-bold text-white">
                        Persetujuan Desain
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Pastikan desain, ukuran, dan spesifikasi sudah sesuai sebelum produksi.
                    </p>
                </header>

                {loading && (
                    <p role="status" className="py-8 text-center text-slate-400">
                        Memuat desain...
                    </p>
                )}
                {error && (
                    <div role="alert" className="mb-5 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        <AlertCircle size={17} className="shrink-0" />
                        {error}
                    </div>
                )}

                {design && (
                    <>
                        <div className="mb-5 grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-slate-500">Pesanan</p>
                                <p className="mt-1 font-semibold text-white">
                                    {design.order_number}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Pelanggan</p>
                                <p className="mt-1 font-semibold text-white">
                                    {design.customer_name}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Item pesanan</p>
                                <p className="mt-1 text-white">
                                    {design.product_name} · {Number(design.quantity)}{" "}
                                    {design.unit_name || ""}
                                    {design.width && design.height
                                        ? ` · ${design.width} × ${design.height}`
                                        : ""}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Versi desain</p>
                                <p className="mt-1 text-white">
                                    v{design.version} · {design.original_filename}
                                </p>
                            </div>
                        </div>

                        {design.specifications && (
                            <div className="mb-5 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
                                {design.specifications}
                            </div>
                        )}

                        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                            {isImage ? (
                                <img
                                    src={design.file_url}
                                    alt={`Desain versi ${design.version}`}
                                    className="mx-auto max-h-[70vh] max-w-full object-contain"
                                />
                            ) : design.mime_type === "application/pdf" ? (
                                <iframe
                                    title="Pratinjau desain"
                                    src={design.file_url}
                                    className="h-[70vh] w-full"
                                />
                            ) : (
                                <a
                                    href={design.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-6 text-sm text-blue-300"
                                >
                                    <FileImage size={20} />
                                    Buka file desain
                                </a>
                            )}
                        </div>

                        {design.customer_note && (
                            <p className="mt-4 text-sm text-amber-300">
                                Catatan revisi: {design.customer_note}
                            </p>
                        )}

                        {pending ? (
                            <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
                                <label className="form-field">
                                    <span>Catatan untuk permintaan revisi</span>
                                    <textarea
                                        className="form-input min-h-24"
                                        maxLength={1000}
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        placeholder="Jelaskan bagian yang perlu diperbaiki..."
                                    />
                                </label>
                                <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        className="secondary-button justify-center"
                                        disabled={saving}
                                        onClick={() => respond("request_revision")}
                                    >
                                        Minta revisi
                                    </button>
                                    <button
                                        type="button"
                                        className="primary-button justify-center"
                                        disabled={saving}
                                        onClick={() => respond("approve")}
                                    >
                                        <CheckCircle2 size={16} />
                                        Setujui desain
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div role="status" className="mt-6 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
                                {design.status === "approved" || decision === "approved"
                                    ? "Desain telah disetujui. Pesanan akan masuk ke antrean produksi."
                                    : design.status === "revision_requested" || decision === "revision_requested"
                                      ? "Permintaan revisi telah dikirim kepada tim desain."
                                      : "Desain ini sudah tidak menunggu persetujuan."}
                            </div>
                        )}
                    </>
                )}
            </section>
        </main>
    );
}
