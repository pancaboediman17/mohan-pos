import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ClipboardList, Plus, Search, Eye, RefreshCw, X, Trash2,
    CalendarDays, UserRound, Package, Wallet, AlertCircle,
} from 'lucide-react';
import api from '../services/api';

const money = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
}).format(Number(value || 0));

const dateFormat = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
};

const listData = (response) => {
    const data = response.data?.data?.data
        ?? response.data?.data
        ?? response.data;
    return Array.isArray(data) ? data : [];
};

const statusLabels = {
    pending: 'Menunggu',
    processing: 'Diproses',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    unpaid: 'Belum Dibayar',
    partial: 'Dibayar Sebagian',
    paid: 'Lunas',
};

function StatusBadge({ status }) {
    const styles = {
        pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
        unpaid: 'bg-red-500/10 text-red-400 border-red-500/20',
        partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };

    return (
        <span className={`status-badge ${styles[status] || 'bg-slate-500/10 text-slate-400'}`}>
            {statusLabels[status] || status || '-'}
        </span>
    );
}

function Field({ label, children }) {
    return (
        <label className="form-field">
            <span>{label}</span>
            {children}
        </label>
    );
}

export default function Orders({ user, canCreate = false }) {
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [formError, setFormError] = useState('');

    const emptyItem = () => ({
        product_id: '',
        quantity: '1',
        width: '',
        height: '',
        specifications: '',
        notes: '',
    });

    const [form, setForm] = useState({
        customer_id: '',
        discount: '0',
        due_date: '',
        notes: '',
        items: [emptyItem()],
    });

    const loadOrders = useCallback(async (page = 1) => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/api/v1/orders', {
                params: {
                    page,
                    search: search || undefined,
                    status: statusFilter || undefined,
                },
            });

            setOrders(response.data?.data || []);
            setPagination({
                currentPage: response.data?.current_page || 1,
                lastPage: response.data?.last_page || 1,
                total: response.data?.total || 0,
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Gagal memuat daftar pesanan.');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    const loadMasterData = useCallback(async () => {
        try {
            const [customerResponse, productResponse] = await Promise.all([
                api.get('/api/v1/customers', { params: { per_page: 100 } }),
                api.get('/api/v1/products', { params: { per_page: 100 } }),
            ]);

            setCustomers(listData(customerResponse));
            setProducts(listData(productResponse));
        } catch (err) {
            console.error('Gagal memuat master data:', err);
        }
    }, []);

    useEffect(() => {
        loadOrders(1);
    }, [loadOrders]);

    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    const productOptions = useMemo(
        () => products.filter((product) => product.is_active !== false),
        [products],
    );

    const subtotal = useMemo(() => {
        return form.items.reduce((total, item) => {
            const product = products.find(
                (product) => String(product.id) === String(item.product_id),
            );
            return total + Number(item.quantity || 0) * Number(product?.selling_price || 0);
        }, 0);
    }, [form.items, products]);

    const discount = Math.max(0, Number(form.discount || 0));
    const total = Math.max(0, subtotal - discount);

    const updateItem = (index, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item,
            ),
        }));
    };

    const addItem = () => {
        setForm((current) => ({
            ...current,
            items: [...current.items, emptyItem()],
        }));
    };

    const removeItem = (index) => {
        setForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const resetForm = () => {
        setForm({
            customer_id: '',
            discount: '0',
            due_date: '',
            notes: '',
            items: [emptyItem()],
        });
        setFormError('');
    };

    const submitOrder = async (event) => {
        event.preventDefault();
        setFormError('');

        if (!form.items.length || form.items.some((item) => !item.product_id)) {
            setFormError('Pilih produk untuk setiap baris pesanan.');
            return;
        }

        if (form.items.some((item) => Number(item.quantity) <= 0)) {
            setFormError('Kuantitas harus lebih besar dari nol.');
            return;
        }

        if (discount > subtotal) {
            setFormError('Diskon tidak boleh melebihi subtotal.');
            return;
        }

        setSaving(true);

        try {
            const payload = {
                customer_id: form.customer_id || null,
                discount,
                due_date: form.due_date || null,
                notes: form.notes || null,
                items: form.items.map((item) => ({
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity),
                    width: item.width ? Number(item.width) : null,
                    height: item.height ? Number(item.height) : null,
                    specifications: item.specifications || null,
                    notes: item.notes || null,
                })),
            };

            await api.post('/api/v1/orders', payload);

            setShowForm(false);
            resetForm();
            await loadOrders(1);
        } catch (err) {
            const validationErrors = err.response?.data?.errors;
            const firstError = validationErrors
                ? Object.values(validationErrors).flat()[0]
                : null;

            setFormError(firstError || err.response?.data?.message || 'Pesanan gagal disimpan.');
        } finally {
            setSaving(false);
        }
    };

    const showDetail = async (order) => {
        try {
            const response = await api.get(`/api/v1/orders/${order.id}`);
            setSelectedOrder(response.data?.data || response.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Gagal memuat detail pesanan.');
        }
    };

    const openCreateForm = () => {
        resetForm();
        setShowForm(true);
    };

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">Manajemen Pesanan</h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Kelola transaksi pelanggan dan pantau status pesanan.
                    </p>
                </div>

                {canCreate && (
                    <button type="button" className="primary-button" onClick={openCreateForm}>
                        <Plus size={16} /> Pesanan Baru
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Total Pesanan</p>
                            <p className="text-2xl font-bold text-white mt-2">
                                {pagination?.total ?? orders.length}
                            </p>
                        </div>
                        <div className="stat-icon"><ClipboardList size={21} /></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">Total data pesanan</p>
                </div>

                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Belum Lunas</p>
                            <p className="text-2xl font-bold text-white mt-2">
                                {orders.filter((order) => order.payment_status !== 'paid').length}
                            </p>
                        </div>
                        <div className="stat-icon text-amber-400"><Wallet size={21} /></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">Dari halaman yang sedang ditampilkan</p>
                </div>

                <div className="stat-card">
                    <div className="flex justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Nilai Pesanan</p>
                            <p className="text-xl font-bold text-white mt-2">
                                {money(orders.reduce((sum, order) => sum + Number(order.total || 0), 0))}
                            </p>
                        </div>
                        <div className="stat-icon"><Package size={21} /></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">Akumulasi halaman saat ini</p>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header flex-wrap">
                    <div>
                        <h3 className="panel-title">Daftar Pesanan</h3>
                        <p className="panel-subtitle">Data transaksi dari database PRINTFLOW</p>
                    </div>

                    <button type="button" className="secondary-button" onClick={() => loadOrders(1)}>
                        <RefreshCw size={15} /> Muat Ulang
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mb-5">
                    <div className="relative flex-1">
                        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            className="form-input pl-10"
                            placeholder="Cari nomor pesanan atau pelanggan..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <select
                        className="form-input md:max-w-52"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="pending">Menunggu</option>
                        <option value="processing">Diproses</option>
                        <option value="completed">Selesai</option>
                        <option value="cancelled">Dibatalkan</option>
                    </select>
                </div>

                {error && (
                    <div className="text-sm text-red-400 mb-4 flex gap-2 items-center">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Pesanan</th>
                                <th>Pelanggan</th>
                                <th>Tanggal</th>
                                <th>Total</th>
                                <th>Sisa Tagihan</th>
                                <th>Status Pesanan</th>
                                <th>Pembayaran</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="text-center py-8">Memuat data pesanan...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-8 text-slate-500">Belum ada data pesanan.</td></tr>
                            ) : orders.map((order) => (
                                <tr key={order.id}>
                                    <td className="font-semibold text-white">{order.order_number}</td>
                                    <td>{order.customer?.name || 'Pelanggan Umum'}</td>
                                    <td>{dateFormat(order.created_at)}</td>
                                    <td className="text-white">{money(order.total)}</td>
                                    <td className="text-amber-400">{money(order.balance)}</td>
                                    <td><StatusBadge status={order.status} /></td>
                                    <td><StatusBadge status={order.payment_status} /></td>
                                    <td>
                                        <button
                                            type="button"
                                            className="secondary-button !px-3 !py-2"
                                            onClick={() => showDetail(order)}
                                            title="Lihat detail"
                                        >
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {pagination && pagination.lastPage > 1 && (
                    <div className="flex justify-between items-center gap-3 mt-5 text-sm">
                        <span className="text-slate-500">
                            Halaman {pagination.currentPage} dari {pagination.lastPage}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="secondary-button"
                                disabled={pagination.currentPage <= 1}
                                onClick={() => loadOrders(pagination.currentPage - 1)}
                            >
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                className="secondary-button"
                                disabled={pagination.currentPage >= pagination.lastPage}
                                onClick={() => loadOrders(pagination.currentPage + 1)}
                            >
                                Berikutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="panel w-full max-w-4xl my-auto">
                        <div className="panel-header mb-5">
                            <div>
                                <h3 className="panel-title">Buat Pesanan Baru</h3>
                                <p className="panel-subtitle">Pilih pelanggan dan produk yang dipesan.</p>
                            </div>
                            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                                <X size={17} />
                            </button>
                        </div>

                        <form onSubmit={submitOrder} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Pelanggan">
                                    <select
                                        className="form-input"
                                        value={form.customer_id}
                                        onChange={(event) => setForm({ ...form, customer_id: event.target.value })}
                                    >
                                        <option value="">Pelanggan Umum</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Tanggal Jatuh Tempo">
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={form.due_date}
                                        onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                                    />
                                </Field>
                            </div>

                            <div className="border-t border-slate-700 pt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-white">Item Pesanan</h4>
                                    <button type="button" className="secondary-button" onClick={addItem}>
                                        <Plus size={15} /> Tambah Item
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {form.items.map((item, index) => {
                                        const product = products.find(
                                            (product) => String(product.id) === String(item.product_id),
                                        );

                                        return (
                                            <div key={index} className="rounded-xl border border-slate-700 p-4 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-semibold text-slate-300">Item {index + 1}</span>
                                                    {form.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            className="text-red-400 p-2"
                                                            onClick={() => removeItem(index)}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <Field label="Produk / Jasa">
                                                        <select
                                                            required
                                                            className="form-input"
                                                            value={item.product_id}
                                                            onChange={(event) => updateItem(index, 'product_id', event.target.value)}
                                                        >
                                                            <option value="">Pilih produk</option>
                                                            {productOptions.map((product) => (
                                                                <option key={product.id} value={product.id}>
                                                                    {product.product_code} - {product.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </Field>

                                                    <Field label={`Kuantitas${product?.unit?.name ? ` (${product.unit.name})` : ''}`}>
                                                        <input
                                                            required
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            className="form-input"
                                                            value={item.quantity}
                                                            onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                                                        />
                                                    </Field>

                                                    <Field label="Lebar (opsional)">
                                                        <input
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            className="form-input"
                                                            placeholder="Contoh: 5"
                                                            value={item.width}
                                                            onChange={(event) => updateItem(index, 'width', event.target.value)}
                                                        />
                                                    </Field>

                                                    <Field label="Tinggi (opsional)">
                                                        <input
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            className="form-input"
                                                            placeholder="Contoh: 1"
                                                            value={item.height}
                                                            onChange={(event) => updateItem(index, 'height', event.target.value)}
                                                        />
                                                    </Field>
                                                </div>

                                                <Field label="Spesifikasi">
                                                    <input
                                                        className="form-input"
                                                        placeholder="Contoh: Flexi Korea, finishing mata ayam..."
                                                        value={item.specifications}
                                                        onChange={(event) => updateItem(index, 'specifications', event.target.value)}
                                                    />
                                                </Field>

                                                {product && (
                                                    <div className="text-sm flex flex-wrap justify-between gap-2 text-slate-400">
                                                        <span>Harga satuan: {money(product.selling_price)}</span>
                                                        <span className="text-white font-semibold">
                                                            Subtotal: {money(Number(item.quantity || 0) * Number(product.selling_price || 0))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Diskon (Rp)">
                                    <input
                                        type="number"
                                        min="0"
                                        className="form-input"
                                        value={form.discount}
                                        onChange={(event) => setForm({ ...form, discount: event.target.value })}
                                    />
                                </Field>

                                <Field label="Catatan Pesanan">
                                    <input
                                        className="form-input"
                                        placeholder="Catatan tambahan..."
                                        value={form.notes}
                                        onChange={(event) => setForm({ ...form, notes: event.target.value })}
                                    />
                                </Field>
                            </div>

                            <div className="rounded-xl bg-slate-900/70 p-4 space-y-2">
                                <div className="flex justify-between text-sm text-slate-400">
                                    <span>Subtotal</span><span>{money(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-400">
                                    <span>Diskon</span><span>{money(discount)}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-700 pt-3 text-lg font-bold text-white">
                                    <span>Total Pesanan</span><span>{money(total)}</span>
                                </div>
                            </div>

                            {formError && (
                                <p className="text-sm text-red-400 flex gap-2 items-center">
                                    <AlertCircle size={16} /> {formError}
                                </p>
                            )}

                            <div className="flex justify-end gap-3">
                                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="primary-button" disabled={saving}>
                                    {saving ? 'Menyimpan...' : 'Simpan Pesanan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
                    <div className="panel w-full max-w-3xl my-auto">
                        <div className="panel-header mb-5">
                            <div>
                                <h3 className="panel-title">Detail Pesanan</h3>
                                <p className="panel-subtitle">{selectedOrder.order_number}</p>
                            </div>
                            <button type="button" className="secondary-button" onClick={() => setSelectedOrder(null)}>
                                <X size={17} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            <div>
                                <p className="text-xs text-slate-500">Pelanggan</p>
                                <p className="text-white font-semibold mt-1">
                                    {selectedOrder.customer?.name || 'Pelanggan Umum'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Tanggal Pesanan</p>
                                <p className="text-white mt-1">{dateFormat(selectedOrder.created_at)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Status Pesanan</p>
                                <div className="mt-1"><StatusBadge status={selectedOrder.status} /></div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Status Pembayaran</p>
                                <div className="mt-1"><StatusBadge status={selectedOrder.payment_status} /></div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>
                                </thead>
                                <tbody>
                                    {(selectedOrder.items || []).map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <p className="text-white">{item.product_name}</p>
                                                <p className="text-xs text-slate-500">{item.specifications || '-'}</p>
                                            </td>
                                            <td>{Number(item.quantity)} {item.unit_name}</td>
                                            <td>{money(item.unit_price)}</td>
                                            <td>{money(item.subtotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="max-w-sm ml-auto mt-5 space-y-2">
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>Subtotal</span><span>{money(selectedOrder.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>Diskon</span><span>{money(selectedOrder.discount)}</span>
                            </div>
                            <div className="flex justify-between text-white font-bold">
                                <span>Total</span><span>{money(selectedOrder.total)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                                <span>Sudah Dibayar</span><span>{money(selectedOrder.paid_amount)}</span>
                            </div>
                            <div className="flex justify-between text-amber-400 font-bold">
                                <span>Sisa Tagihan</span><span>{money(selectedOrder.balance)}</span>
                            </div>
                        </div>

                        {selectedOrder.notes && (
                            <p className="text-sm text-slate-400 mt-5">Catatan: {selectedOrder.notes}</p>
                        )}

                        <div className="flex justify-end mt-6">
                            <button type="button" className="secondary-button" onClick={() => setSelectedOrder(null)}>
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
