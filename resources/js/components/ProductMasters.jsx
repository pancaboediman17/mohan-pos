import React, { useEffect, useState } from 'react';
import {
    Tags, Ruler, Plus, Search, RefreshCw, Pencil, Trash2,
    Power, X, Save, Package, AlertCircle, CheckCircle2
} from 'lucide-react';
import api from '../services/api';

const initialCategory = {
    name: '',
    description: '',
    is_active: true,
};

const initialUnit = {
    name: '',
    symbol: '',
    description: '',
    is_active: true,
};

export default function ProductMasters({ canManage = false }) {
    const [tab, setTab] = useState('categories');
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(initialCategory);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const isCategory = tab === 'categories';
    const records = isCategory ? categories : units;

    const loadData = async () => {
        setLoading(true);
        setError('');

        try {
            const [categoryResponse, unitResponse] = await Promise.all([
                api.get('/api/v1/product-categories'),
                api.get('/api/v1/units'),
            ]);

            setCategories(Array.isArray(categoryResponse.data)
                ? categoryResponse.data : []);
            setUnits(Array.isArray(unitResponse.data)
                ? unitResponse.data : []);
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal mengambil data master.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredRecords = records.filter(item => {
        const keyword = search.toLowerCase();
        return (
            item.name?.toLowerCase().includes(keyword) ||
            item.symbol?.toLowerCase().includes(keyword) ||
            item.description?.toLowerCase().includes(keyword)
        );
    });

    const openCreate = () => {
        setEditing(null);
        setForm(isCategory ? initialCategory : initialUnit);
        setError('');
        setModalOpen(true);
    };

    const openEdit = (item) => {
        setEditing(item);
        setForm({
            name: item.name || '',
            symbol: item.symbol || '',
            description: item.description || '',
            is_active: Boolean(item.is_active),
        });
        setError('');
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setEditing(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!form.name.trim()) {
            setError('Nama wajib diisi.');
            return;
        }

        if (!isCategory && !form.symbol.trim()) {
            setError('Simbol satuan wajib diisi.');
            return;
        }

        setSaving(true);

        try {
            const payload = {
                name: form.name.trim(),
                description: form.description || null,
                is_active: Boolean(form.is_active),
            };

            if (!isCategory) {
                payload.symbol = form.symbol.trim();
            }

            const endpoint = isCategory
                ? '/api/v1/product-categories'
                : '/api/v1/units';

            if (editing) {
                await api.put(`${endpoint}/${editing.id}`, payload);
                setSuccess(
                    `${isCategory ? 'Kategori' : 'Satuan'} berhasil diperbarui.`
                );
            } else {
                await api.post(endpoint, payload);
                setSuccess(
                    `${isCategory ? 'Kategori' : 'Satuan'} berhasil ditambahkan.`
                );
            }

            setModalOpen(false);
            setEditing(null);
            await loadData();
        } catch (err) {
            const validationErrors = err.response?.data?.errors;
            setError(validationErrors
                ? Object.values(validationErrors).flat().join(' ')
                : err.response?.data?.message ||
                  'Gagal menyimpan data master.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (item) => {
        const nextStatus = !item.is_active;

        if (!window.confirm(
            `Yakin ingin ${nextStatus ? 'mengaktifkan' : 'menonaktifkan'} ${item.name}?`
        )) return;

        const endpoint = isCategory
            ? '/api/v1/product-categories'
            : '/api/v1/units';

        try {
            setError('');
            setSuccess('');

            await api.put(`${endpoint}/${item.id}`, {
                name: item.name,
                ...(isCategory ? {} : { symbol: item.symbol }),
                description: item.description || null,
                is_active: nextStatus,
            });

            setSuccess(`${item.name} berhasil diperbarui.`);
            await loadData();
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal mengubah status.');
        }
    };

    const deleteRecord = async (item) => {
        const count = Number(item.products_count || 0);

        if (count > 0) {
            setError(
                `${item.name} masih digunakan oleh ${count} produk. Nonaktifkan saja jika tidak ingin digunakan lagi.`
            );
            return;
        }

        if (!window.confirm(
            `Hapus ${isCategory ? 'kategori' : 'satuan'} "${item.name}"?`
        )) return;

        const endpoint = isCategory
            ? '/api/v1/product-categories'
            : '/api/v1/units';

        try {
            setError('');
            setSuccess('');

            await api.delete(`${endpoint}/${item.id}`);
            setSuccess(`${item.name} berhasil dihapus.`);
            await loadData();
        } catch (err) {
            setError(err.response?.data?.message ||
                'Data tidak dapat dihapus karena masih digunakan.');
        }
    };

    const activeCount = records.filter(item => item.is_active).length;
    const inactiveCount = records.length - activeCount;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Tags className="text-red-500" size={25} />
                        <h2 className="text-2xl font-bold text-white">
                            Master Kategori & Satuan
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                        Pengaturan data dasar katalog produk dan jasa percetakan.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2"
                        >
                            <Plus size={17} />
                            <span>Tambah {isCategory ? 'Kategori' : 'Satuan'}</span>
                        </button>
                    )}
                </div>
            </div>

            {success && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-4 py-3 text-sm flex items-center gap-2">
                    <CheckCircle2 size={17} />
                    {success}
                </div>
            )}

            {error && !modalOpen && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={17} />
                    {error}
                    <button
                        onClick={() => setError('')}
                        className="ml-auto"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <p className="text-sm text-slate-400">
                        Total {isCategory ? 'Kategori' : 'Satuan'}
                    </p>
                    <p className="text-3xl font-bold text-white mt-2">
                        {records.length}
                    </p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <p className="text-sm text-slate-400">Data Aktif</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-2">
                        {activeCount}
                    </p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <p className="text-sm text-slate-400">Data Nonaktif</p>
                    <p className="text-3xl font-bold text-amber-400 mt-2">
                        {inactiveCount}
                    </p>
                </div>
            </div>

            <div className="bg-[#151b28] border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => {
                            setTab('categories');
                            setSearch('');
                            setError('');
                            setSuccess('');
                        }}
                        className={`flex-1 sm:flex-none px-5 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 ${
                            isCategory
                                ? 'border-red-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                    >
                        <Tags size={17} />
                        Kategori Produk
                        <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                            {categories.length}
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            setTab('units');
                            setSearch('');
                            setError('');
                            setSuccess('');
                        }}
                        className={`flex-1 sm:flex-none px-5 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 ${
                            !isCategory
                                ? 'border-red-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                    >
                        <Ruler size={17} />
                        Satuan
                        <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                            {units.length}
                        </span>
                    </button>
                </div>

                <div className="p-4 border-b border-slate-800">
                    <div className="relative">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`Cari ${isCategory ? 'kategori' : 'satuan'}...`}
                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left">
                        <thead className="bg-[#101725] text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-5 py-4">Nama</th>
                                {!isCategory && (
                                    <th className="px-5 py-4">Simbol</th>
                                )}
                                <th className="px-5 py-4">Deskripsi</th>
                                <th className="px-5 py-4">Produk Terkait</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={isCategory ? 5 : 6}
                                        className="px-5 py-12 text-center text-slate-400"
                                    >
                                        <RefreshCw className="animate-spin mx-auto mb-2" />
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isCategory ? 5 : 6}
                                        className="px-5 py-12 text-center text-slate-500"
                                    >
                                        Data tidak ditemukan.
                                    </td>
                                </tr>
                            ) : filteredRecords.map(item => (
                                <tr key={item.id} className="hover:bg-slate-800/30">
                                    <td className="px-5 py-4">
                                        <div className="font-medium text-white text-sm">
                                            {item.name}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {isCategory ? item.slug : `ID: ${item.id}`}
                                        </div>
                                    </td>

                                    {!isCategory && (
                                        <td className="px-5 py-4">
                                            <span className="px-2.5 py-1 bg-slate-700 rounded-md text-sm text-white font-medium">
                                                {item.symbol}
                                            </span>
                                        </td>
                                    )}

                                    <td className="px-5 py-4 text-sm text-slate-400 max-w-xs">
                                        {item.description || '-'}
                                    </td>

                                    <td className="px-5 py-4">
                                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                                            <Package size={15} className="text-slate-500" />
                                            {item.products_count || 0} produk
                                        </span>
                                    </td>

                                    <td className="px-5 py-4">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                            item.is_active
                                                ? 'text-emerald-400'
                                                : 'text-amber-400'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                item.is_active
                                                    ? 'bg-emerald-400'
                                                    : 'bg-amber-400'
                                            }`} />
                                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4">
                                        {canManage && (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => openEdit(item)}
                                                    title="Edit"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                                                >
                                                    <Pencil size={16} />
                                                </button>

                                                <button
                                                    onClick={() => toggleStatus(item)}
                                                    title="Aktif/nonaktif"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-700"
                                                >
                                                    <Power size={16} />
                                                </button>

                                                <button
                                                    onClick={() => deleteRecord(item)}
                                                    title="Hapus"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
                    Menampilkan {filteredRecords.length} dari {records.length} data
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="w-full max-w-lg bg-[#151b28] border border-slate-700 rounded-2xl shadow-2xl my-auto">
                        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {editing ? 'Edit' : 'Tambah'} {isCategory ? 'Kategori' : 'Satuan'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Lengkapi informasi data master.
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            {error && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-slate-400 mb-2">
                                    Nama {isCategory ? 'Kategori' : 'Satuan'} *
                                </label>
                                <input
                                    required
                                    maxLength={isCategory ? 100 : 50}
                                    value={form.name}
                                    onChange={e => setForm(current => ({
                                        ...current,
                                        name: e.target.value,
                                    }))}
                                    placeholder={isCategory
                                        ? 'Contoh: Digital Printing'
                                        : 'Contoh: Lembar'}
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                />
                            </div>

                            {!isCategory && (
                                <div>
                                    <label className="block text-xs text-slate-400 mb-2">
                                        Simbol Satuan *
                                    </label>
                                    <input
                                        required
                                        maxLength={20}
                                        value={form.symbol}
                                        onChange={e => setForm(current => ({
                                            ...current,
                                            symbol: e.target.value,
                                        }))}
                                        placeholder="Contoh: lbr"
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-slate-400 mb-2">
                                    Deskripsi
                                </label>
                                <textarea
                                    rows="3"
                                    value={form.description}
                                    onChange={e => setForm(current => ({
                                        ...current,
                                        description: e.target.value,
                                    }))}
                                    placeholder="Keterangan tambahan (opsional)"
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={e => setForm(current => ({
                                        ...current,
                                        is_active: e.target.checked,
                                    }))}
                                    className="accent-red-600"
                                />
                                Data aktif
                            </label>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-slate-700 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving
                                        ? <RefreshCw size={16} className="animate-spin" />
                                        : <Save size={16} />}
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
