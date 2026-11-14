import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Pencil,
    Plus,
    Power,
    RefreshCw,
    Search,
    Tags,
    Trash2,
    X,
} from "lucide-react";
import api from "../services/api";

const emptyForm = {
    name: "",
    code: "",
    description: "",
    default_cost: "0",
    is_active: true,
};

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

export default function FinishingTypes({ canManage = false }) {
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadItems = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get("/api/v1/finishing-types");
            setItems(response.data?.data || []);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Gagal memuat master jenis finishing.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const filteredItems = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return items;

        return items.filter((item) =>
            [item.name, item.code, item.description].some((value) =>
                String(value || "")
                    .toLowerCase()
                    .includes(keyword),
            ),
        );
    }, [items, search]);

    const openForm = (item = null) => {
        setEditing(item);
        setForm(
            item
                ? {
                      name: item.name || "",
                      code: item.code || "",
                      description: item.description || "",
                      default_cost: String(item.default_cost || 0),
                      is_active: Boolean(item.is_active),
                  }
                : { ...emptyForm },
        );
        setError("");
        setSuccess("");
        setModalOpen(true);
    };

    const closeForm = () => {
        if (saving) return;
        setModalOpen(false);
        setEditing(null);
    };

    const saveItem = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        const name = form.name.trim();
        const code = form.code.trim().toUpperCase();
        const defaultCost = Number(form.default_cost || 0);

        if (!name || !code) {
            setError("Nama dan kode finishing wajib diisi.");
            return;
        }

        if (!Number.isFinite(defaultCost) || defaultCost < 0) {
            setError("Biaya default harus berupa angka nol atau lebih.");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                name,
                code,
                description: form.description.trim() || null,
                default_cost: defaultCost,
                is_active: Boolean(form.is_active),
            };
            const endpoint = "/api/v1/finishing-types";

            if (editing) {
                await api.put(`${endpoint}/${editing.id}`, payload);
            } else {
                await api.post(endpoint, payload);
            }

            setModalOpen(false);
            setEditing(null);
            setSuccess(
                `Jenis finishing berhasil ${editing ? "diperbarui" : "ditambahkan"}.`,
            );
            await loadItems();
        } catch (requestError) {
            const validationErrors = requestError.response?.data?.errors;
            setError(
                validationErrors
                    ? Object.values(validationErrors).flat().join(" ")
                    : requestError.response?.data?.message ||
                          "Gagal menyimpan jenis finishing.",
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (item) => {
        const nextStatus = !item.is_active;
        if (
            !window.confirm(
                `${nextStatus ? "Aktifkan" : "Nonaktifkan"} finishing ${item.name}?`,
            )
        ) {
            return;
        }

        setError("");
        setSuccess("");

        try {
            await api.patch(`/api/v1/finishing-types/${item.id}`, {
                name: item.name,
                code: item.code,
                description: item.description,
                default_cost: item.default_cost,
                is_active: nextStatus,
            });
            setSuccess(
                `Jenis finishing berhasil ${nextStatus ? "diaktifkan" : "dinonaktifkan"}.`,
            );
            await loadItems();
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Gagal mengubah status finishing.",
            );
        }
    };

    const removeItem = async (item) => {
        if (
            !window.confirm(
                `Hapus jenis finishing "${item.name}"? Data akan dihapus secara soft delete.`,
            )
        ) {
            return;
        }

        setError("");
        setSuccess("");

        try {
            await api.delete(`/api/v1/finishing-types/${item.id}`);
            setSuccess("Jenis finishing berhasil dihapus.");
            await loadItems();
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Gagal menghapus jenis finishing.",
            );
        }
    };

    return (
        <div className="space-y-6">
            <section className="welcome-row">
                <div>
                    <div className="flex items-center gap-2">
                        <Tags size={24} className="text-red-400" />
                        <h2 className="text-2xl font-bold text-white">
                            Master Jenis Finishing
                        </h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                        Siapkan opsi finishing untuk alur pesanan dan produksi
                        berikutnya.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={loadItems}
                        disabled={loading}
                    >
                        <RefreshCw
                            size={15}
                            className={loading ? "animate-spin" : ""}
                        />
                        Muat Ulang
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            className="primary-button"
                            onClick={() => openForm()}
                        >
                            <Plus size={16} />
                            Tambah Finishing
                        </button>
                    )}
                </div>
            </section>

            {success && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                    <CheckCircle2 size={17} />
                    {success}
                </div>
            )}
            {error && !modalOpen && (
                <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"
                >
                    <AlertCircle size={17} />
                    {error}
                </div>
            )}

            <section className="panel">
                <div className="panel-header flex-wrap">
                    <div>
                        <h3 className="panel-title">Daftar Finishing</h3>
                        <p className="panel-subtitle">
                            {items.length} jenis terdaftar
                        </p>
                    </div>
                    <div className="relative w-full sm:max-w-xs">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            className="form-input pl-10"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari nama atau kode..."
                            aria-label="Cari jenis finishing"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Jenis Finishing</th>
                                <th>Biaya Default</th>
                                <th>Status</th>
                                {canManage && (
                                    <th className="text-right">Aksi</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={canManage ? 5 : 4}
                                        className="py-10 text-center"
                                    >
                                        Memuat master finishing...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={canManage ? 5 : 4}
                                        className="py-10 text-center text-slate-500"
                                    >
                                        {search
                                            ? "Finishing tidak ditemukan."
                                            : "Belum ada jenis finishing."}
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="font-mono text-xs text-slate-400">
                                            {item.code}
                                        </td>
                                        <td>
                                            <p className="font-medium text-white">
                                                {item.name}
                                            </p>
                                            {item.description && (
                                                <p className="mt-1 max-w-md text-xs text-slate-500">
                                                    {item.description}
                                                </p>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap text-white">
                                            {money(item.default_cost)}
                                        </td>
                                        <td>
                                            <span
                                                className={
                                                    item.is_active
                                                        ? "status-badge bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                        : "status-badge bg-slate-500/10 text-slate-400 border-slate-500/20"
                                                }
                                            >
                                                {item.is_active
                                                    ? "Aktif"
                                                    : "Nonaktif"}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td>
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        className="secondary-button !px-3 !py-2"
                                                        onClick={() =>
                                                            openForm(item)
                                                        }
                                                        title="Edit finishing"
                                                        aria-label={`Edit ${item.name}`}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="secondary-button !px-3 !py-2"
                                                        onClick={() =>
                                                            toggleStatus(item)
                                                        }
                                                        title={
                                                            item.is_active
                                                                ? "Nonaktifkan"
                                                                : "Aktifkan"
                                                        }
                                                        aria-label={`Ubah status ${item.name}`}
                                                    >
                                                        <Power size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="secondary-button !px-3 !py-2 !text-red-400"
                                                        onClick={() =>
                                                            removeItem(item)
                                                        }
                                                        title="Hapus finishing"
                                                        aria-label={`Hapus ${item.name}`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6">
                    <div className="panel my-auto w-full max-w-xl">
                        <div className="panel-header mb-5">
                            <div>
                                <h3 className="panel-title">
                                    {editing ? "Edit" : "Tambah"} Jenis Finishing
                                </h3>
                                <p className="panel-subtitle">
                                    Biaya default dapat disesuaikan pada saat
                                    transaksi.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={closeForm}
                                disabled={saving}
                                aria-label="Tutup form"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={saveItem} className="space-y-4">
                            {error && (
                                <div
                                    role="alert"
                                    className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
                                >
                                    <AlertCircle
                                        size={15}
                                        className="mr-2 inline"
                                    />
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="form-field">
                                    <span>Nama Finishing *</span>
                                    <input
                                        className="form-input"
                                        maxLength={100}
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                        placeholder="Contoh: Laminasi Doff"
                                        required
                                    />
                                </label>
                                <label className="form-field">
                                    <span>Kode *</span>
                                    <input
                                        className="form-input"
                                        maxLength={30}
                                        value={form.code}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                code: event.target.value.toUpperCase(),
                                            }))
                                        }
                                        placeholder="Contoh: LAM-DOFF"
                                        required
                                    />
                                </label>
                            </div>

                            <label className="form-field">
                                <span>Biaya Default</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.default_cost}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            default_cost: event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <label className="form-field">
                                <span>Deskripsi (Opsional)</span>
                                <textarea
                                    className="form-input min-h-24"
                                    value={form.description}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            description: event.target.value,
                                        }))
                                    }
                                    placeholder="Catatan tentang proses atau penggunaan finishing..."
                                />
                            </label>

                            <label className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            is_active: event.target.checked,
                                        }))
                                    }
                                />
                                Finishing aktif
                            </label>

                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Menyimpan..."
                                        : editing
                                          ? "Simpan Perubahan"
                                          : "Simpan Finishing"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
