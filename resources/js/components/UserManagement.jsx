import { useEffect, useState } from 'react';
import {
    Users, UserPlus, Search, RefreshCw, Pencil,
    Power, X, ChevronLeft, ChevronRight,
    UserCheck, UserX, AlertCircle
} from 'lucide-react';
import api from '../services/api';

const ROLE_OPTIONS = [
    'Owner',
    'Admin',
    'Kasir',
    'Operator Produksi',
    'Desainer',
    'HR',
];

const formatDate = (date) => {
    if (!date) return '-';

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date));
};

export default function UserManagement({ user, canManage = false }) {
    const isOwner = user?.roles?.includes('Owner');

    const availableRoles = isOwner
        ? ROLE_OPTIONS
        : ['Kasir', 'Operator Produksi', 'Desainer', 'HR'];

    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const emptyForm = {
        name: '',
        email: '',
        password: '',
        role: 'Kasir',
        branch_id: '',
        is_active: true,
    };

    const [form, setForm] = useState(emptyForm);

    const loadUsers = async () => {
        setLoading(true);
        setError('');

        try {
            const params = {
                page,
                search: search.trim() || undefined,
                role: roleFilter || undefined,
                status: statusFilter || undefined,
            };

            const response = await api.get('/api/v1/users', { params });

            setUsers(response.data.data.data || []);
            setPagination({
                current_page: response.data.data.current_page,
                last_page: response.data.data.last_page,
                total: response.data.data.total,
            });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Gagal mengambil data pengguna.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [page, search, roleFilter, statusFilter]);

    useEffect(() => {
        api.get('/api/v1/branches')
            .then((response) => setBranches((response.data.data || []).filter((branch) => branch.is_active)))
            .catch(() => setBranches([]));
    }, []);

    const activeCount = users.filter(item => item.is_active).length;
    const inactiveCount = users.filter(item => !item.is_active).length;

    const openCreateModal = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setError('');
        setModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingUser(item);
        setForm({
            name: item.name,
            email: item.email,
            password: '',
            role: item.roles?.[0]?.name || 'Kasir',
            branch_id: item.branch_id || '',
            is_active: item.is_active,
        });
        setError('');
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setEditingUser(null);
        setForm(emptyForm);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!canManage) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                name: form.name,
                email: form.email,
                role: form.role,
                branch_id: form.branch_id || null,
                is_active: form.is_active,
            };

            if (form.password.trim()) {
                payload.password = form.password;
            }

            if (editingUser) {
                await api.put(
                    `/api/v1/users/${editingUser.id}`,
                    payload
                );
                setSuccess('Data pengguna berhasil diperbarui.');
            } else {
                if (!form.password.trim()) {
                    setError('Password wajib diisi untuk pengguna baru.');
                    setSaving(false);
                    return;
                }

                await api.post('/api/v1/users', payload);
                setSuccess('Pengguna baru berhasil ditambahkan.');
            }

            setModalOpen(false);
            setEditingUser(null);
            setForm(emptyForm);

            await loadUsers();
        } catch (err) {
            const validationErrors = err.response?.data?.errors;

            if (validationErrors) {
                setError(
                    Object.values(validationErrors).flat().join(' ')
                );
            } else {
                setError(
                    err.response?.data?.message ||
                    'Terjadi kesalahan saat menyimpan pengguna.'
                );
            }
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (item) => {
        if (!canManage) return;

        const nextStatus = !item.is_active;

        if (
            item.id === user?.id &&
            !nextStatus
        ) {
            setError('Anda tidak dapat menonaktifkan akun sendiri.');
            return;
        }

        const confirmed = window.confirm(
            `Yakin ingin ${nextStatus ? 'mengaktifkan' : 'menonaktifkan'} akun ${item.name}?`
        );

        if (!confirmed) return;

        setError('');
        setSuccess('');

        try {
            await api.patch(`/api/v1/users/${item.id}`, {
                is_active: nextStatus,
            });

            setSuccess(
                `Akun ${item.name} berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
            );

            await loadUsers();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Gagal mengubah status pengguna.'
            );
        }
    };

    const getRoleStyle = (role) => {
        const styles = {
            Owner: 'bg-red-500/10 text-red-400 border-red-500/20',
            Admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            Kasir: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            'Operator Produksi': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            Desainer: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
            HR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };

        return styles[role] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Users className="text-red-500" size={24} />
                        <h2 className="text-2xl font-bold text-white">
                            Manajemen Pengguna
                        </h2>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                        Kelola akun, role, dan hak akses tim PRINTFLOW.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={loadUsers}
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
                            Tambah Pengguna
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total pengguna</span>
                        <Users className="text-blue-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-white mt-3">
                        {pagination.total}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Seluruh akun terdaftar
                    </p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Aktif di halaman ini</span>
                        <UserCheck className="text-emerald-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-emerald-400 mt-3">
                        {activeCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Pengguna berstatus aktif
                    </p>
                </div>

                <div className="bg-[#151b28] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Nonaktif di halaman ini</span>
                        <UserX className="text-amber-400" size={21} />
                    </div>
                    <div className="text-3xl font-bold text-amber-400 mt-3">
                        {inactiveCount}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Pengguna berstatus nonaktif
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
                            placeholder="Cari nama atau email..."
                            className="w-full bg-[#0d1320] border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-red-500"
                        />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value);
                            setPage(1);
                        }}
                        className="bg-[#0d1320] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-red-500"
                    >
                        <option value="">Semua Role</option>
                        {ROLE_OPTIONS.map(role => (
                            <option key={role} value={role}>{role}</option>
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
                    <table className="w-full text-left">
                        <thead className="bg-[#101725] text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-5 py-4 font-semibold">Pengguna</th>
                                <th className="px-5 py-4 font-semibold">Role</th>
                                <th className="px-5 py-4 font-semibold">Tanggal Bergabung</th>
                                <th className="px-5 py-4 font-semibold">Status</th>
                                {canManage && (
                                    <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                                )}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={canManage ? 5 : 4} className="px-5 py-12 text-center text-slate-400">
                                        <RefreshCw className="animate-spin mx-auto mb-2" />
                                        Memuat data pengguna...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={canManage ? 5 : 4} className="px-5 py-12 text-center text-slate-500">
                                        Tidak ada pengguna ditemukan.
                                    </td>
                                </tr>
                            ) : users.map(item => {
                                const role = item.roles?.[0]?.name || 'Tanpa Role';
                                const isProtected = !isOwner && ['Owner', 'Admin'].includes(role);
                                const isSelf = item.id === user?.id;

                                return (
                                    <tr key={item.id} className="hover:bg-slate-800/30">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                                                    {item.name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {item.name}
                                                        {isSelf && (
                                                            <span className="text-xs text-slate-500 ml-2">
                                                                (Anda)
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {item.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-md border text-xs font-medium ${getRoleStyle(role)}`}>
                                                {role}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-400">
                                            {formatDate(item.created_at)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${item.is_active ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                {item.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </td>

                                        {canManage && (
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!isProtected && (
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            title="Edit pengguna"
                                                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}

                                                    {!isProtected && (
                                                        <button
                                                            onClick={() => toggleStatus(item)}
                                                            disabled={isSelf}
                                                            title={isSelf ? 'Tidak dapat menonaktifkan akun sendiri' : item.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <Power size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        Menampilkan {users.length} dari {pagination.total} pengguna
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
                            Halaman {pagination.current_page || 1} / {pagination.last_page || 1}
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

            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-[#151b28] border border-slate-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Lengkapi informasi akun pengguna.
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
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

                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Nama Lengkap
                                </label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                    placeholder="Masukkan nama lengkap"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Email
                                </label>
                                <input
                                    required
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                    placeholder="nama@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Password {editingUser && '(kosongkan jika tidak diubah)'}
                                </label>
                                <input
                                    required={!editingUser}
                                    type="password"
                                    minLength={8}
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                    placeholder="Minimal 8 karakter"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Role Pengguna
                                </label>
                                <select
                                    required
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                >
                                    {availableRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-300 mb-2">
                                    Cabang Penugasan
                                </label>
                                <select
                                    value={form.branch_id}
                                    onChange={e => setForm({ ...form, branch_id: e.target.value })}
                                    className="w-full bg-[#0d1320] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                                >
                                    <option value="">Tidak ditugaskan ke cabang</option>
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.code} — {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-center gap-3 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                    className="accent-red-600 w-4 h-4"
                                />
                                Akun aktif dan dapat login
                            </label>

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
                                    {saving ? 'Menyimpan...' : 'Simpan Pengguna'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
