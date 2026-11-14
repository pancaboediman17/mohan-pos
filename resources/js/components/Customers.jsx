import { useEffect, useState } from 'react';
import {
    Users, UserPlus, Search, RefreshCw, Pencil, Power,
    Trash2, X, ChevronLeft, ChevronRight, Building2,
    UserRound, Landmark, Eye, AlertCircle, Phone, Mail,
    MapPin
} from 'lucide-react';
import api from '../services/api';

const CUSTOMER_TYPES = [
    { value: 'individual', label: 'Perorangan' },
    { value: 'company', label: 'Perusahaan' },
    { value: 'government', label: 'Instansi Pemerintah' },
];

const formatDate = (date) => {
    if (!date) return '-';

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date));
};

const emptyForm = {
    name: '',
    customer_type: 'individual',
    phone: '',
    email: '',
    address: '',
    notes: '',
    is_active: true,
};

export default function Customers({ user, canManage = false }) {
    const [customers, setCustomers] = useState([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [detailCustomer, setDetailCustomer] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const loadCustomers = async () => {
        setLoading(true);
        setError('');

        try {
            const params = {
                page,
                search: search.trim() || undefined,
                type: typeFilter || undefined,
                status: statusFilter || undefined,
            };

            const response = await api.get('/api/v1/customers', { params });
            const result = response.data.data;

            setCustomers(result.data || []);
            setPagination({
                current_page: result.current_page || 1,
                last_page: result.last_page || 1,
                total: result.total || 0,
            });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Gagal mengambil data pelanggan.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, [page, search, typeFilter, statusFilter]);

    const activeCount = customers.filter(item => item.is_active).length;
    const inactiveCount = customers.filter(item => !item.is_active).length;

    const openCreateModal = () => {
        setEditingCustomer(null);
        setForm(emptyForm);
        setError('');
        setModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingCustomer(item);
        setForm({
            name: item.name || '',
            customer_type: item.customer_type || 'individual',
            phone: item.phone || '',
            email: item.email || '',
            address: item.address || '',
            notes: item.notes || '',
            is_active: Boolean(item.is_active),
        });
        setError('');
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setEditingCustomer(null);
        setForm(emptyForm);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!canManage) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            if (editingCustomer) {
                await api.put(
                    `/api/v1/customers/${editingCustomer.id}`,
                    form
                );
                setSuccess('Data pelanggan berhasil diperbarui.');
            } else {
                await api.post('/api/v1/customers', form);
                setSuccess('Pelanggan baru berhasil ditambahkan.');
            }

            setModalOpen(false);
            setEditingCustomer(null);
            setForm(emptyForm);

            await loadCustomers();
        } catch (err) {
            const validationErrors = err.response?.data?.errors;

            setError(
                validationErrors
                    ? Object.values(validationErrors).flat().join(' ')
                    : err.response?.data?.message ||
                      'Terjadi kesalahan saat menyimpan pelanggan.'
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (item) => {
        if (!canManage) return;

        const nextStatus = !item.is_active;
        const confirmed = window.confirm(
            `Yakin ingin ${nextStatus ? 'mengaktifkan' : 'menonaktifkan'} pelanggan ${item.name}?`
        );

        if (!confirmed) return;

        setError('');
        setSuccess('');

        try {
            await api.patch(`/api/v1/customers/${item.id}`, {
                is_active: nextStatus,
            });

            setSuccess(
                `Pelanggan ${item.name} berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
            );

            await loadCustomers();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Gagal mengubah status pelanggan.'
            );
        }
    };

    const deleteCustomer = async (item) => {
        if (!canManage) return;

        const confirmed = window.confirm(
            `Hapus pelanggan "${item.name}" dari daftar aktif? Data akan masuk ke soft delete.`
        );

        if (!confirmed) return;

        setError('');
        setSuccess('');

        try {
            await api.delete(`/api/v1/customers/${item.id}`);
            setSuccess(`Pelanggan ${item.name} berhasil dihapus.`);

            if (customers.length === 1 && page > 1) {
                setPage(current => current - 1);
            } else {
                await loadCustomers();
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Gagal menghapus pelanggan.'
            );
        }
    };

    const getTypeLabel = (type) => {
        return CUSTOMER_TYPES.find(item => item.value === type)?.label || type;
    };

    const getTypeIcon = (type) => {
        if (type === 'company') return Building2;
        if (type === 'government') return Landmark;
        return UserRound;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Users className="text-red-500" size={24} />
                        <h2 className="text-2xl font-bold text-white">
                            Data Pelanggan
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                        Kelola data pelanggan perorangan, perusahaan, dan instansi.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={loadCustomers}
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
                            <UserPlus size={17} />
                            Tambah Pelanggan
                        </button>
                    )}
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total pelanggan</span>
                        <Users className="text-blue-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-white mt-3">
                        {pagination.total}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Seluruh pelanggan terdaftar</p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Aktif di halaman ini</span>
                        <UserRound className="text-emerald-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-emerald-400 mt-3">
                        {activeCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Pelanggan berstatus aktif</p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Nonaktif di halaman ini</span>
                        <Power className="text-amber-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-amber-400 mt-3">
                        {inactiveCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Pelanggan berstatus nonaktif</p>
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
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Cari kode, nama, telepon, atau email..."
                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                        />
                    </div>

                    <select
                        value={typeFilter}
                        onChange={(e) => {
                            setTypeFilter(e.target.value);
                            setPage(1);
                        }}
                        className="bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-red-500"
                    >
                        <option value="">Semua Jenis</option>
                        {CUSTOMER_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
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
                    <table className="w-full text-left min-w-[850px]">
                        <thead className="bg-[#101725] text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-5 py-4 font-semibold">Pelanggan</th>
                                <th className="px-5 py-4 font-semibold">Jenis</th>
                                <th className="px-5 py-4 font-semibold">Kontak</th>
                                <th className="px-5 py-4 font-semibold">Status</th>
                                <th className="px-5 py-4 font-semibold">Terdaftar</th>
                                <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw className="animate-spin mx-auto mb-2" />
                                        Memuat data pelanggan...
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                                        Tidak ada pelanggan ditemukan.
                                    </td>
                                </tr>
                            ) : customers.map(item => {
                                const TypeIcon = getTypeIcon(item.customer_type);

                                return (
                                    <tr key={item.id} className="hover:bg-slate-800/30">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white">
                                                    <TypeIcon size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {item.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {item.customer_code || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-400">
                                            {getTypeLabel(item.customer_type)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="text-sm text-slate-300">
                                                {item.phone || '-'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {item.email || '-'}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.is_active ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                {item.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-400">
                                            {formatDate(item.created_at)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => setDetailCustomer(item)}
                                                    title="Lihat detail"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700"
                                                >
                                                    <Eye size={16} />
                                                </button>

                                                {canManage && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            title="Edit pelanggan"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>

                                                        <button
                                                            onClick={() => toggleStatus(item)}
                                                            title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                            className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-700"
                                                        >
                                                            <Power size={16} />
                                                        </button>

                                                        <button
                                                            onClick={() => deleteCustomer(item)}
                                                            title="Hapus pelanggan"
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
                        Menampilkan {customers.length} dari {pagination.total} pelanggan
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

            {/* Create / Edit modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl my-8 bg-[#151b28] border border-slate-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Lengkapi informasi pelanggan MOHAN Digital Lab's.
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Nama Pelanggan *
                                    </label>
                                    <input
                                        required
                                        maxLength={150}
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                        placeholder="Nama perorangan / perusahaan / instansi"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Jenis Pelanggan *
                                    </label>
                                    <select
                                        required
                                        value={form.customer_type}
                                        onChange={e => setForm({ ...form, customer_type: e.target.value })}
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                    >
                                        {CUSTOMER_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Nomor Telepon / WhatsApp
                                    </label>
                                    <input
                                        type="tel"
                                        maxLength={25}
                                        value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                        placeholder="08xxxxxxxxxx"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        maxLength={255}
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                        placeholder="email@perusahaan.com"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Alamat
                                    </label>
                                    <textarea
                                        rows="2"
                                        value={form.address}
                                        onChange={e => setForm({ ...form, address: e.target.value })}
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                        placeholder="Alamat lengkap pelanggan"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Catatan
                                    </label>
                                    <textarea
                                        rows="2"
                                        value={form.notes}
                                        onChange={e => setForm({ ...form, notes: e.target.value })}
                                        className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                        placeholder="Catatan tambahan..."
                                    />
                                </div>

                                <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                        className="accent-red-600"
                                    />
                                    Pelanggan aktif
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={saving}
                                    className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
                                >
                                    {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Customer detail modal */}
            {detailCustomer && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-[#151b28] border border-slate-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-white">Detail Pelanggan</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Informasi data pelanggan.
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailCustomer(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-xl font-bold text-white">
                                    {detailCustomer.name}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                    {detailCustomer.customer_code || '-'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Building2 size={17} className="text-slate-500" />
                                {getTypeLabel(detailCustomer.customer_type)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Phone size={17} className="text-slate-500" />
                                {detailCustomer.phone || '-'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Mail size={17} className="text-slate-500" />
                                {detailCustomer.email || '-'}
                            </div>
                            <div className="flex items-start gap-2 text-sm text-slate-300">
                                <MapPin size={17} className="text-slate-500 mt-0.5" />
                                {detailCustomer.address || '-'}
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <p className="text-xs text-slate-500 mb-1">Catatan</p>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">
                                    {detailCustomer.notes || '-'}
                                </p>
                            </div>

                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Status: {detailCustomer.is_active ? 'Aktif' : 'Nonaktif'}</span>
                                <span>Terdaftar: {formatDate(detailCustomer.created_at)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
