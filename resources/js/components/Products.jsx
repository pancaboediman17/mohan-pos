import React, { useEffect, useMemo, useState } from 'react';
import {
    Package, Plus, Search, RefreshCw, Pencil, Power, Trash2,
    Eye, X, ChevronLeft, ChevronRight, AlertCircle, Calculator,
    Layers, TrendingUp, Wallet, Box, Save, PlusCircle, MinusCircle
} from 'lucide-react';
import api from '../services/api';

const TYPES = [
    { value: 'material', label: 'Bahan / Material' },
    { value: 'printing', label: 'Printing / Mesin' },
    { value: 'finishing', label: 'Finishing' },
    { value: 'labor', label: 'Tenaga Kerja' },
    { value: 'overhead', label: 'Overhead' },
    { value: 'other', label: 'Lainnya' },
];

const money = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
}).format(Number(value || 0));

const emptyComponent = () => ({
    name: '',
    component_type: 'material',
    quantity: 1,
    unit_id: '',
    unit_cost: 0,
    notes: '',
});

const emptyForm = {
    name: '',
    product_category_id: '',
    unit_id: '',
    description: '',
    selling_price: 0,
    is_active: true,
    cost_components: [emptyComponent()],
};

export default function Products({ canManage = false }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [detailProduct, setDetailProduct] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const loadMaster = async () => {
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
                'Gagal mengambil data kategori dan satuan.');
        }
    };

    const loadProducts = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/api/v1/products', {
                params: {
                    page,
                    search: search.trim() || undefined,
                    category_id: categoryFilter || undefined,
                    status: statusFilter === '' ? undefined : statusFilter,
                },
            });

            const result = response.data;
            setProducts(result.data || []);
            setPagination({
                current_page: result.current_page || 1,
                last_page: result.last_page || 1,
                total: result.total || 0,
            });
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal mengambil daftar produk.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMaster();
    }, []);

    useEffect(() => {
        loadProducts();
    }, [page, search, categoryFilter, statusFilter]);

    const activeCount = products.filter(item => item.is_active).length;
    const inactiveCount = products.filter(item => !item.is_active).length;

    const totalValue = useMemo(
        () => products.reduce((sum, item) =>
            sum + Number(item.selling_price || 0), 0),
        [products]
    );

    const totalCost = useMemo(
        () => products.reduce((sum, item) =>
            sum + Number(item.estimated_cost || 0), 0),
        [products]
    );

    const totalHpp = form.cost_components.reduce((sum, item) =>
        sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);

    const grossProfit = Number(form.selling_price || 0) - totalHpp;
    const margin = Number(form.selling_price || 0) > 0
        ? (grossProfit / Number(form.selling_price)) * 100
        : 0;

    const openCreateModal = () => {
        setEditingProduct(null);
        setForm(emptyForm);
        setError('');
        setSuccess('');
        setModalOpen(true);
    };

    const openEditModal = async (item) => {
        setError('');
        setSuccess('');

        try {
            const response = await api.get(`/api/v1/products/${item.id}`);
            const product = response.data.data;

            setEditingProduct(product);
            setForm({
                name: product.name || '',
                product_category_id: String(product.product_category_id || ''),
                unit_id: String(product.unit_id || ''),
                description: product.description || '',
                selling_price: Number(product.selling_price || 0),
                is_active: Boolean(product.is_active),
                cost_components: (product.cost_components || []).length
                    ? product.cost_components.map(component => ({
                        name: component.name || '',
                        component_type: component.component_type || 'material',
                        quantity: Number(component.quantity || 1),
                        unit_id: component.unit_id
                            ? String(component.unit_id) : '',
                        unit_cost: Number(component.unit_cost || 0),
                        notes: component.notes || '',
                    }))
                    : [emptyComponent()],
            });
            setModalOpen(true);
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal mengambil detail produk.');
        }
    };

    const openDetail = async (item) => {
        try {
            const response = await api.get(`/api/v1/products/${item.id}`);
            setDetailProduct(response.data.data);
            setDetailOpen(true);
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal mengambil detail produk.');
        }
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setEditingProduct(null);
        setForm(emptyForm);
    };

    const updateForm = (field, value) => {
        setForm(current => ({ ...current, [field]: value }));
    };

    const updateComponent = (index, field, value) => {
        setForm(current => ({
            ...current,
            cost_components: current.cost_components.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            ),
        }));
    };

    const addComponent = () => {
        setForm(current => ({
            ...current,
            cost_components: [
                ...current.cost_components,
                emptyComponent(),
            ],
        }));
    };

    const removeComponent = (index) => {
        setForm(current => ({
            ...current,
            cost_components: current.cost_components.length === 1
                ? [emptyComponent()]
                : current.cost_components.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!canManage) return;

        if (!form.name.trim() || !form.product_category_id || !form.unit_id) {
            setError('Nama, kategori, dan satuan produk wajib diisi.');
            return;
        }

        const components = form.cost_components
            .filter(item => item.name.trim())
            .map(item => ({
                name: item.name.trim(),
                component_type: item.component_type,
                quantity: Number(item.quantity),
                unit_id: item.unit_id ? Number(item.unit_id) : null,
                unit_cost: Number(item.unit_cost),
                notes: item.notes || null,
            }));

        if (components.some(item =>
            item.quantity <= 0 || item.unit_cost < 0
        )) {
            setError('Jumlah komponen harus lebih dari 0 dan biaya tidak boleh negatif.');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        const payload = {
            name: form.name.trim(),
            product_category_id: Number(form.product_category_id),
            unit_id: Number(form.unit_id),
            description: form.description || null,
            selling_price: Number(form.selling_price),
            is_active: Boolean(form.is_active),
            cost_components: components,
        };

        try {
            if (editingProduct) {
                await api.put(
                    `/api/v1/products/${editingProduct.id}`,
                    payload
                );
                setSuccess('Produk berhasil diperbarui.');
            } else {
                await api.post('/api/v1/products', payload);
                setSuccess('Produk berhasil ditambahkan.');
            }

            setModalOpen(false);
            setEditingProduct(null);
            setForm(emptyForm);
            await loadProducts();
        } catch (err) {
            const validationErrors = err.response?.data?.errors;
            setError(validationErrors
                ? Object.values(validationErrors).flat().join(' ')
                : err.response?.data?.message ||
                  'Terjadi kesalahan saat menyimpan produk.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (item) => {
        if (!canManage) return;

        const nextStatus = !item.is_active;
        if (!window.confirm(
            `Yakin ingin ${nextStatus ? 'mengaktifkan' : 'menonaktifkan'} ${item.name}?`
        )) return;

        try {
            await api.patch(`/api/v1/products/${item.id}`, {
                is_active: nextStatus,
            });
            setSuccess(`Status produk ${item.name} berhasil diperbarui.`);
            await loadProducts();
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal mengubah status produk.');
        }
    };

    const deleteProduct = async (item) => {
        if (!canManage) return;

        if (!window.confirm(
            `Hapus produk "${item.name}" dari daftar aktif? Data akan masuk soft delete.`
        )) return;

        try {
            await api.delete(`/api/v1/products/${item.id}`);
            setSuccess(`Produk ${item.name} berhasil dihapus.`);

            if (products.length === 1 && page > 1) {
                setPage(current => current - 1);
            } else {
                await loadProducts();
            }
        } catch (err) {
            setError(err.response?.data?.message ||
                'Gagal menghapus produk.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Package className="text-red-500" size={25} />
                        <h2 className="text-2xl font-bold text-white">
                            Produk & Jasa
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                        Kelola katalog produk, layanan percetakan, harga jual, dan HPP.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            loadMaster();
                            loadProducts();
                        }}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    {canManage && (
                        <button
                            onClick={openCreateModal}
                            className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2"
                        >
                            <Plus size={17} />
                            Tambah Produk
                        </button>
                    )}
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total Produk</span>
                        <Package className="text-blue-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-white mt-3">
                        {pagination.total}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Produk terdaftar</p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Aktif di halaman</span>
                        <Layers className="text-emerald-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-emerald-400 mt-3">
                        {activeCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Produk aktif</p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Nonaktif di halaman</span>
                        <Power className="text-amber-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-amber-400 mt-3">
                        {inactiveCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Produk nonaktif</p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Nilai HPP halaman</span>
                        <Calculator className="text-red-400" size={21} />
                    </div>
                    <div className="text-xl font-bold text-white mt-3">
                        {money(totalCost)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Nilai jual: {money(totalValue)}
                    </p>
                </div>
            </div>

            {success && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-4 py-3 text-sm">
                    {success}
                </div>
            )}

            {error && !modalOpen && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={17} />
                    {error}
                </div>
            )}

            {/* Filters and table */}
            <div className="bg-[#151b28] border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            value={search}
                            onChange={event => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Cari kode produk atau nama..."
                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                        />
                    </div>

                    <select
                        value={categoryFilter}
                        onChange={event => {
                            setCategoryFilter(event.target.value);
                            setPage(1);
                        }}
                        className="bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-red-500"
                    >
                        <option value="">Semua Kategori</option>
                        {categories.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={event => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        className="bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-red-500"
                    >
                        <option value="">Semua Status</option>
                        <option value="1">Aktif</option>
                        <option value="0">Nonaktif</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[950px]">
                        <thead className="bg-[#101725] text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-5 py-4 font-semibold">Produk</th>
                                <th className="px-5 py-4 font-semibold">Kategori</th>
                                <th className="px-5 py-4 font-semibold">Harga Jual</th>
                                <th className="px-5 py-4 font-semibold">HPP</th>
                                <th className="px-5 py-4 font-semibold">Laba Kotor</th>
                                <th className="px-5 py-4 font-semibold">Status</th>
                                <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw className="animate-spin mx-auto mb-2" />
                                        Memuat data produk...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-5 py-12 text-center text-slate-500">
                                        Tidak ada produk ditemukan.
                                    </td>
                                </tr>
                            ) : products.map(item => {
                                const profit = Number(item.selling_price || 0) -
                                    Number(item.estimated_cost || 0);

                                return (
                                    <tr key={item.id} className="hover:bg-slate-800/30">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-white">
                                                    <Box size={19} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {item.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {item.product_code} · {item.unit?.symbol || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-400">
                                            {item.category?.name || '-'}
                                        </td>

                                        <td className="px-5 py-4 text-sm text-white font-medium">
                                            {money(item.selling_price)}
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-300">
                                            {money(item.estimated_cost)}
                                        </td>

                                        <td className={`px-5 py-4 text-sm font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {money(profit)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.is_active ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                {item.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openDetail(item)}
                                                    title="Detail produk"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700"
                                                >
                                                    <Eye size={16} />
                                                </button>

                                                {canManage && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            title="Edit produk"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleStatus(item)}
                                                            title="Ubah status"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-700"
                                                        >
                                                            <Power size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteProduct(item)}
                                                            title="Hapus produk"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        Menampilkan {products.length} dari {pagination.total} produk
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPage(current => Math.max(1, current - 1))}
                            disabled={page <= 1 || loading}
                            className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                        >
                            <ChevronLeft size={17} />
                        </button>
                        <span className="text-sm text-slate-400">
                            Halaman {pagination.current_page} / {pagination.last_page}
                        </span>
                        <button
                            onClick={() => setPage(current => Math.min(pagination.last_page, current + 1))}
                            disabled={page >= pagination.last_page || loading}
                            className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                        >
                            <ChevronRight size={17} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Create / Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="w-full max-w-5xl bg-[#151b28] border border-slate-700 rounded-2xl shadow-2xl my-auto">
                        <div className="sticky top-0 z-10 bg-[#151b28] border-b border-slate-700 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Data produk dan perhitungan harga pokok produksi
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-6">
                            {error && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Product identity */}
                            <section className="space-y-4">
                                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Package size={17} className="text-red-400" />
                                    Informasi Produk
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">Nama Produk *</label>
                                        <input
                                            required
                                            value={form.name}
                                            onChange={e => updateForm('name', e.target.value)}
                                            placeholder="Contoh: Cetak Banner Flexi"
                                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">Kategori *</label>
                                        <select
                                            required
                                            value={form.product_category_id}
                                            onChange={e => updateForm('product_category_id', e.target.value)}
                                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                        >
                                            <option value="">Pilih kategori</option>
                                            {categories.filter(item => item.is_active).map(item => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">Satuan Produk *</label>
                                        <select
                                            required
                                            value={form.unit_id}
                                            onChange={e => updateForm('unit_id', e.target.value)}
                                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                        >
                                            <option value="">Pilih satuan</option>
                                            {units.filter(item => item.is_active).map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} ({item.symbol})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2">Harga Jual *</label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.selling_price}
                                            onChange={e => updateForm('selling_price', e.target.value)}
                                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-slate-400 mb-2">Deskripsi</label>
                                        <textarea
                                            rows="2"
                                            value={form.description}
                                            onChange={e => updateForm('description', e.target.value)}
                                            placeholder="Keterangan produk atau layanan..."
                                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={e => updateForm('is_active', e.target.checked)}
                                            className="accent-red-600"
                                        />
                                        Produk aktif dan dapat dipilih saat transaksi
                                    </label>
                                </div>
                            </section>

                            <div className="border-t border-slate-700" />

                            {/* Cost components */}
                            <section className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                            <Calculator size={17} className="text-red-400" />
                                            Komponen HPP
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Masukkan biaya bahan, mesin, finishing, tenaga kerja, dan overhead.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addComponent}
                                        className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm flex items-center gap-2"
                                    >
                                        <PlusCircle size={16} />
                                        Tambah Komponen
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {form.cost_components.map((component, index) => (
                                        <div key={index} className="bg-[#0d1320] border border-slate-700 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-semibold text-slate-300">
                                                    Komponen #{index + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeComponent(index)}
                                                    className="text-slate-500 hover:text-red-400"
                                                    title="Hapus komponen"
                                                >
                                                    <MinusCircle size={18} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1.5">Nama Biaya</label>
                                                    <input
                                                        value={component.name}
                                                        onChange={e => updateComponent(index, 'name', e.target.value)}
                                                        placeholder="Contoh: Bahan Flexi"
                                                        className="w-full bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1.5">Jenis Biaya</label>
                                                    <select
                                                        value={component.component_type}
                                                        onChange={e => updateComponent(index, 'component_type', e.target.value)}
                                                        className="w-full bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                                    >
                                                        {TYPES.map(type => (
                                                            <option key={type.value} value={type.value}>{type.label}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1.5">Satuan Komponen</label>
                                                    <select
                                                        value={component.unit_id}
                                                        onChange={e => updateComponent(index, 'unit_id', e.target.value)}
                                                        className="w-full bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                                    >
                                                        <option value="">Tidak ditentukan</option>
                                                        {units.filter(item => item.is_active).map(item => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.name} ({item.symbol})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1.5">Jumlah / Qty</label>
                                                    <input
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        value={component.quantity}
                                                        onChange={e => updateComponent(index, 'quantity', e.target.value)}
                                                        className="w-full bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1.5">Biaya per Satuan (Rp)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={component.unit_cost}
                                                        onChange={e => updateComponent(index, 'unit_cost', e.target.value)}
                                                        className="w-full bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1.5">Subtotal</label>
                                                    <div className="bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-400">
                                                        {money(Number(component.quantity || 0) * Number(component.unit_cost || 0))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <input
                                                    value={component.notes}
                                                    onChange={e => updateComponent(index, 'notes', e.target.value)}
                                                    placeholder="Catatan komponen (opsional)"
                                                    className="w-full bg-[#151b28] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Calculation */}
                            <section className="bg-[#0d1320] border border-slate-700 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                    <TrendingUp size={17} className="text-red-400" />
                                    Simulasi Harga & Profitabilitas
                                </h4>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <p className="text-xs text-slate-500">Total HPP</p>
                                        <p className="text-lg font-bold text-white mt-1">{money(totalHpp)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Harga Jual</p>
                                        <p className="text-lg font-bold text-white mt-1">{money(form.selling_price)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Laba Kotor</p>
                                        <p className={`text-lg font-bold mt-1 ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {money(grossProfit)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Margin</p>
                                        <p className={`text-lg font-bold mt-1 ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {margin.toFixed(2)}%
                                        </p>
                                    </div>
                                </div>

                                {grossProfit < 0 && (
                                    <p className="text-xs text-red-400 mt-3">
                                        Peringatan: harga jual lebih rendah daripada total HPP.
                                    </p>
                                )}
                            </section>

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
                                    {saving ? 'Menyimpan...' : 'Simpan Produk'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product detail */}
            {detailOpen && detailProduct && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="w-full max-w-3xl bg-[#151b28] border border-slate-700 rounded-2xl shadow-2xl my-auto">
                        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Detail Produk</h3>
                                <p className="text-xs text-slate-400 mt-1">{detailProduct.product_code}</p>
                            </div>
                            <button
                                onClick={() => setDetailOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            <div>
                                <h4 className="text-xl font-bold text-white">{detailProduct.name}</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    {detailProduct.category?.name || '-'} · {detailProduct.unit?.name || '-'}
                                </p>
                                {detailProduct.description && (
                                    <p className="text-sm text-slate-400 mt-3">{detailProduct.description}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-[#0d1320] rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Harga Jual</p>
                                    <p className="text-sm font-bold text-white mt-1">{money(detailProduct.selling_price)}</p>
                                </div>
                                <div className="bg-[#0d1320] rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Total HPP</p>
                                    <p className="text-sm font-bold text-white mt-1">{money(detailProduct.estimated_cost)}</p>
                                </div>
                                <div className="bg-[#0d1320] rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Laba Kotor</p>
                                    <p className="text-sm font-bold text-emerald-400 mt-1">
                                        {money(Number(detailProduct.selling_price) - Number(detailProduct.estimated_cost))}
                                    </p>
                                </div>
                                <div className="bg-[#0d1320] rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Status</p>
                                    <p className={`text-sm font-bold mt-1 ${detailProduct.is_active ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {detailProduct.is_active ? 'Aktif' : 'Nonaktif'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-white mb-3">Rincian Komponen HPP</h4>
                                <div className="overflow-x-auto border border-slate-700 rounded-lg">
                                    <table className="w-full min-w-[600px] text-sm text-left">
                                        <thead className="bg-[#0d1320] text-xs text-slate-500">
                                            <tr>
                                                <th className="px-3 py-3">Komponen</th>
                                                <th className="px-3 py-3">Jenis</th>
                                                <th className="px-3 py-3">Qty</th>
                                                <th className="px-3 py-3">Satuan</th>
                                                <th className="px-3 py-3 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {(detailProduct.cost_components || []).map(component => (
                                                <tr key={component.id}>
                                                    <td className="px-3 py-3 text-white">{component.name}</td>
                                                    <td className="px-3 py-3 text-slate-400">
                                                        {TYPES.find(item => item.value === component.component_type)?.label || component.component_type}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-300">{component.quantity}</td>
                                                    <td className="px-3 py-3 text-slate-400">
                                                        {component.unit?.symbol || '-'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-white">
                                                        {money(component.total_cost)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!detailProduct.cost_components ||
                                                detailProduct.cost_components.length === 0) && (
                                                <tr>
                                                    <td colSpan="5" className="px-3 py-6 text-center text-slate-500">
                                                        Belum ada komponen HPP.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
