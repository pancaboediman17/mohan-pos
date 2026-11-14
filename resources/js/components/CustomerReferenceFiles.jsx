import { useState } from "react";
import { AlertCircle, Download, FileImage } from "lucide-react";
import api from "../services/api";

export default function CustomerReferenceFiles({ orderId, files = [] }) {
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");

    if (!files.length) return null;

    const downloadFile = async (file) => {
        setDownloadingId(file.id);
        setError("");
        try {
            const response = await api.get(
                `/api/v1/orders/${orderId}/customer-files/${file.id}/file`,
                { responseType: "blob" },
            );
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement("a");
            link.href = url;
            link.download = file.original_filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "File referensi gagal diunduh.",
            );
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <h4 className="mb-2 text-sm font-semibold text-white">
                File referensi pesanan
            </h4>
            <ul className="space-y-2">
                {files.map((file) => (
                    <li
                        key={file.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                        <span className="flex min-w-0 items-center gap-2 text-slate-300">
                            <FileImage size={16} className="shrink-0 text-slate-400" />
                            <span className="min-w-0">
                                <span className="block break-all">{file.original_filename}</span>
                                {(file.item?.product_name || file.note) && (
                                    <span className="block text-xs text-slate-500">
                                        {[file.item?.product_name, file.note].filter(Boolean).join(" · ")}
                                    </span>
                                )}
                            </span>
                        </span>
                        <button
                            type="button"
                            className="secondary-button !px-3 !py-2"
                            disabled={downloadingId === file.id}
                            onClick={() => downloadFile(file)}
                        >
                            <Download size={14} />
                            {downloadingId === file.id ? "Mengunduh..." : "Unduh"}
                        </button>
                    </li>
                ))}
            </ul>
            {error && (
                <p role="alert" className="mt-2 flex items-center gap-2 text-xs text-red-400">
                    <AlertCircle size={14} />
                    {error}
                </p>
            )}
        </section>
    );
}
