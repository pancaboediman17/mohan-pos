import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import api from "../services/api";
import BrandLogo from "./BrandLogo";

export default function PublicCustomerUpload({ token }) {
    const [order, setOrder] = useState(null);
    const [itemId, setItemId] = useState("");
    const [files, setFiles] = useState([]);
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [fileInputKey, setFileInputKey] = useState(0);

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const response = await api.get(
                    `/api/v1/public/orders/${encodeURIComponent(token)}/upload`,
                );
                setOrder(response.data?.data || null);
            } catch (requestError) {
                setError(
                    requestError.response?.data?.message ||
                        "Tautan unggah tidak valid atau sudah kedaluwarsa.",
                );
            } finally {
                setLoading(false);
            }
        };
        loadOrder();
    }, [token]);

    const submit = async (event) => {
        event.preventDefault();
        if (!files.length) {
            setError("Pilih setidaknya satu file untuk dikirim.");
            return;
        }

        const formData = new FormData();
        files.forEach((file) => formData.append("files[]", file));
        if (itemId) formData.append("order_item_id", itemId);
        if (note.trim()) formData.append("note", note.trim());

        setUploading(true);
        setError("");
        setSuccess("");
        try {
            const response = await api.post(
                `/api/v1/public/orders/${encodeURIComponent(token)}/files`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } },
            );
            setSuccess(response.data?.message || "File berhasil dikirim.");
            setFiles([]);
            setNote("");
            setFileInputKey((current) => current + 1);
        } catch (requestError) {
            const validationError = requestError.response?.data?.errors
                ? Object.values(requestError.response.data.errors).flat()[0]
                : null;
            setError(
                validationError ||
                    requestError.response?.data?.message ||
                    "File gagal dikirim. Silakan coba kembali.",
            );
        } finally {
            setUploading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
            <section className="panel mx-auto w-full max-w-3xl">
                <header className="mb-6 border-b border-slate-800 pb-5">
                    <BrandLogo className="mb-4 h-[72px] w-56" />
                    <h1 className="mt-2 text-2xl font-bold text-white">
                        Kirim File Pesanan
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Unggah gambar, desain, atau dokumen referensi untuk tim percetakan.
                    </p>
                </header>

                {loading && (
                    <p role="status" className="py-8 text-center text-slate-400">
                        Memuat informasi pesanan...
                    </p>
                )}
                {error && (
                    <div role="alert" className="mb-5 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        <AlertCircle size={17} className="shrink-0" />
                        {error}
                    </div>
                )}
                {success && (
                    <div role="status" className="mb-5 flex gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                        <CheckCircle2 size={17} className="shrink-0" />
                        {success}
                    </div>
                )}

                {order && (
                    <>
                        <div className="mb-5 grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-slate-500">Nomor pesanan</p>
                                <p className="mt-1 font-semibold text-white">{order.order_number}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Pelanggan</p>
                                <p className="mt-1 font-semibold text-white">{order.customer_name}</p>
                            </div>
                        </div>

                        <form className="space-y-4" onSubmit={submit}>
                            {order.items?.length > 0 && (
                                <label className="form-field">
                                    <span>Untuk item (opsional)</span>
                                    <select
                                        className="form-input"
                                        value={itemId}
                                        onChange={(event) => setItemId(event.target.value)}
                                    >
                                        <option value="">Seluruh pesanan</option>
                                        {order.items.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.product_name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <label className="form-field">
                                <span>File (PDF, JPG, PNG, atau WebP; maksimal 20 MB per file, hingga 5 file)</span>
                                <input
                                    key={fileInputKey}
                                    type="file"
                                    className="form-input"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    multiple
                                    onChange={(event) => setFiles(Array.from(event.target.files || []))}
                                />
                            </label>
                            {files.length > 0 && (
                                <ul className="space-y-1 text-sm text-slate-300">
                                    {files.map((file) => (
                                        <li key={`${file.name}-${file.lastModified}`}>
                                            {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <label className="form-field">
                                <span>Catatan untuk tim (opsional)</span>
                                <textarea
                                    className="form-input min-h-24"
                                    maxLength={1000}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="Contoh: gunakan gambar ini untuk sisi depan..."
                                />
                            </label>

                            <button
                                type="submit"
                                className="primary-button w-full justify-center"
                                disabled={uploading || loading}
                            >
                                <Upload size={16} />
                                {uploading ? "Mengirim file..." : "Kirim ke tim percetakan"}
                            </button>
                        </form>
                    </>
                )}
            </section>
        </main>
    );
}
