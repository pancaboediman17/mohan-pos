import { useEffect, useMemo, useState } from "react";
import {
    Building2,
    CheckCircle2,
    Pencil,
    Plus,
    Power,
    RefreshCw,
    Search,
    Trash2,
    Users,
    X,
    AlertCircle,
    Save,
    Factory,
} from "lucide-react";
import api from "../services/api";

const initialForm = {
    code: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    is_production_hub: false,
    is_active: true,
};

export default function BranchManagement({ canManage = false }) {
    const [branches, setBranches] = useState([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(initialForm);

    const loadBranches = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/branches");
            setBranches(response.data.data || []);
        } catch (err) {
            setError(
                err.response?.data?.message || "Gagal mengambil data cabang.",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBranches();
    }, []);

    const filteredBranches = useMemo(
        () =>
            branches.filter((branch) => {
                const keyword = search.trim().toLowerCase();
                const matchesSearch =
                    !keyword ||
                    [branch.code, branch.name, branch.address].some((value) =>
                        value?.toLowerCase().includes(keyword),
                    );
                const matchesStatus =
                    status === "" ||
                    String(Number(branch.is_active)) === status;
                return matchesSearch && matchesStatus;
            }),
        [branches, search, status],
    );

    const openCreate = () => {
        setEditing(null);
        setForm(initialForm);
        setError("");
        setModalOpen(true);
    };

    const openEdit = (branch) => {
        setEditing(branch);
        setForm({
            code: branch.code || "",
            name: branch.name || "",
            phone: branch.phone || "",
            email: branch.email || "",
            address: branch.address || "",
            is_production_hub: Boolean(branch.is_production_hub),
            is_active: Boolean(branch.is_active),
        });
        setError("");
        setModalOpen(true);
    };

    const saveBranch = async (event) => {
        event.preventDefault();
        if (!canManage) return;
        setSaving(true);
        setError("");
        try {
            const payload = {
                ...form,
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                phone: form.phone.trim() || null,
                email: form.email.trim() || null,
                address: form.address.trim() || null,
            };
            if (editing)
                await api.put(`/api/v1/branches/${editing.id}`, payload);
            else await api.post("/api/v1/branches", payload);
            setSuccess(
                `Cabang berhasil ${editing ? "diperbarui" : "ditambahkan"}.`,
            );
            setModalOpen(false);
            await loadBranches();
        } catch (err) {
            const messages = err.response?.data?.errors;
            setError(
                messages
                    ? Object.values(messages).flat().join(" ")
                    : err.response?.data?.message || "Gagal menyimpan cabang.",
            );
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (branch) => {
        if (!canManage || !window.confirm(`Ubah status ${branch.name}?`))
            return;
        try {
            await api.patch(`/api/v1/branches/${branch.id}`, {
                ...branch,
                is_active: !branch.is_active,
            });
            setSuccess(
                `Cabang ${branch.name} berhasil ${branch.is_active ? "dinonaktifkan" : "diaktifkan"}.`,
            );
            await loadBranches();
        } catch (err) {
            setError(
                err.response?.data?.message || "Gagal mengubah status cabang.",
            );
        }
    };

    const deleteBranch = async (branch) => {
        if (!canManage || !window.confirm(`Hapus cabang "${branch.name}"?`))
            return;
        try {
            await api.delete(`/api/v1/branches/${branch.id}`);
            setSuccess("Cabang berhasil dihapus.");
            await loadBranches();
        } catch (err) {
            setError(
                err.response?.data?.message || "Cabang tidak dapat dihapus.",
            );
        }
    };

    const activeCount = branches.filter((branch) => branch.is_active).length;
    const productionHub = branches.find((branch) => branch.is_production_hub);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Building2 className="text-red-500" size={25} />
                        <h2 className="text-2xl font-bold text-white">
                            Master Cabang
                        </h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                        Kelola cabang penerima pesanan dan pusat produksi.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={loadBranches}
                        disabled={loading}
                        className="secondary-button"
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? "animate-spin" : ""}
                        />
                        Refresh
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            onClick={openCreate}
                            className="primary-button"
                        >
                            <Plus size={16} />
                            Tambah Cabang
                        </button>
                    )}
                </div>
            </div>

            {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    <CheckCircle2 size={17} />
                    {success}
                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        className="ml-auto"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
            {error && !modalOpen && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    <AlertCircle size={17} />
                    {error}
                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="ml-auto"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Total Cabang
                            </p>
                            <p className="mt-2 text-3xl font-bold text-white">
                                {branches.length}
                            </p>
                        </div>
                        <div className="stat-icon">
                            <Building2 size={21} />
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                        Lokasi terdaftar
                    </p>
                </div>
                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Cabang Aktif
                            </p>
                            <p className="mt-2 text-3xl font-bold text-emerald-400">
                                {activeCount}
                            </p>
                        </div>
                        <div className="stat-icon">
                            <CheckCircle2 size={21} />
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                        Siap menerima pesanan
                    </p>
                </div>
                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Pusat Produksi
                            </p>
                            <p className="mt-2 text-lg font-bold text-white">
                                {productionHub?.name || "Belum ditetapkan"}
                            </p>
                        </div>
                        <div className="stat-icon">
                            <Factory size={21} />
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                        Produksi terpusat
                    </p>
                </div>
            </div>

            <div className="panel overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row">
                    <div className="relative flex-1">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari kode, nama, atau alamat..."
                            className="w-full rounded-lg border border-slate-700 bg-[#0d1320] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-red-500"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="rounded-lg border border-slate-700 bg-[#0d1320] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-red-500"
                    >
                        <option value="">Semua Status</option>
                        <option value="1">Aktif</option>
                        <option value="0">Nonaktif</option>
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-190 text-left">
                        <thead className="bg-[#101725] text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-5 py-4">Cabang</th>
                                <th className="px-5 py-4">Kontak</th>
                                <th className="px-5 py-4">Pengguna</th>
                                <th className="px-5 py-4">Tipe</th>
                                <th className="px-5 py-4">Status</th>
                                {canManage && (
                                    <th className="px-5 py-4 text-right">
                                        Aksi
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={canManage ? 6 : 5}
                                        className="px-5 py-12 text-center text-slate-400"
                                    >
                                        <RefreshCw className="mx-auto mb-2 animate-spin" />
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : filteredBranches.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={canManage ? 6 : 5}
                                        className="px-5 py-12 text-center text-slate-500"
                                    >
                                        Belum ada data cabang.
                                    </td>
                                </tr>
                            ) : (
                                filteredBranches.map((branch) => (
                                    <tr
                                        key={branch.id}
                                        className="hover:bg-slate-800/30"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="font-medium text-white">
                                                {branch.name}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {branch.code} ·{" "}
                                                {branch.address ||
                                                    "Alamat belum diisi"}
                                            </p>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-400">
                                            {branch.phone || "-"}
                                            <br />
                                            {branch.email || "-"}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                                                <Users
                                                    size={15}
                                                    className="text-slate-500"
                                                />
                                                {branch.users_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {branch.is_production_hub ? (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-400">
                                                    <Factory size={13} />
                                                    Pusat Produksi
                                                </span>
                                            ) : (
                                                <span className="text-sm text-slate-400">
                                                    Cabang Penerima
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={
                                                    branch.is_active
                                                        ? "text-sm text-emerald-400"
                                                        : "text-sm text-amber-400"
                                                }
                                            >
                                                {branch.is_active
                                                    ? "Aktif"
                                                    : "Nonaktif"}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEdit(branch)
                                                        }
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateStatus(branch)
                                                        }
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-amber-400"
                                                        title="Aktif/nonaktif"
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            deleteBranch(branch)
                                                        }
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-red-400"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 size={16} />
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
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-6">
                    <div className="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#151b28] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {editing ? "Edit Cabang" : "Tambah Cabang"}
                                </h3>
                                <p className="mt-1 text-xs text-slate-400">
                                    Cabang pusat produksi hanya boleh satu.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !saving && setModalOpen(false)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={saveBranch} className="space-y-4 p-5">
                            {error && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                    {error}
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block text-sm text-slate-300">
                                    Kode Cabang *
                                    <input
                                        required
                                        maxLength="20"
                                        value={form.code}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                code: event.target.value.toUpperCase(),
                                            })
                                        }
                                        placeholder="JKT-01"
                                        className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0d1320] px-3 py-2.5 text-white outline-none focus:border-red-500"
                                    />
                                </label>
                                <label className="block text-sm text-slate-300">
                                    Nama Cabang *
                                    <input
                                        required
                                        maxLength="150"
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                name: event.target.value,
                                            })
                                        }
                                        placeholder="Cabang Jakarta"
                                        className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0d1320] px-3 py-2.5 text-white outline-none focus:border-red-500"
                                    />
                                </label>
                                <label className="block text-sm text-slate-300">
                                    Telepon
                                    <input
                                        value={form.phone}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                phone: event.target.value,
                                            })
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0d1320] px-3 py-2.5 text-white outline-none focus:border-red-500"
                                    />
                                </label>
                                <label className="block text-sm text-slate-300">
                                    Email
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                email: event.target.value,
                                            })
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0d1320] px-3 py-2.5 text-white outline-none focus:border-red-500"
                                    />
                                </label>
                            </div>
                            <label className="block text-sm text-slate-300">
                                Alamat
                                <textarea
                                    rows="3"
                                    value={form.address}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            address: event.target.value,
                                        })
                                    }
                                    className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0d1320] px-3 py-2.5 text-white outline-none focus:border-red-500"
                                />
                            </label>
                            <div className="flex flex-col gap-3 rounded-lg border border-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={form.is_production_hub}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                is_production_hub:
                                                    event.target.checked,
                                            })
                                        }
                                        className="accent-red-600"
                                    />
                                    Tetapkan sebagai pusat produksi
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                is_active: event.target.checked,
                                            })
                                        }
                                        className="accent-red-600"
                                    />
                                    Cabang aktif
                                </label>
                            </div>
                            <div className="flex justify-end gap-2 border-t border-slate-700 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    disabled={saving}
                                    className="secondary-button"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="primary-button"
                                >
                                    {saving ? (
                                        <RefreshCw
                                            size={16}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    {saving ? "Menyimpan..." : "Simpan Cabang"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
