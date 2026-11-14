import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ClipboardList, Plus, Search, Eye, RefreshCw, X, Trash2,
    Package, Wallet, AlertCircle, Printer, Download, Upload, FileImage, Check, Truck,
    Copy, Link2, MessageCircle,
} from 'lucide-react';
import api from '../services/api';
import { InvoicePrintDocument, PaymentReceiptPrintDocument } from './TransactionDocuments';
import CustomerReferenceFiles from './CustomerReferenceFiles';

const money = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
}).format(Number(value || 0));

const orderSaveError = (error) => {
    const validationErrors = error.response?.data?.errors;
    const firstError = validationErrors
        ? Object.values(validationErrors).flat()[0]
        : null;
    const message = firstError || error.response?.data?.message;

    // Jangan tampilkan detail SQL/konfigurasi database kepada kasir.
    if (/SQLSTATE|Unknown column|Connection:|Integrity constraint/i.test(message || '')) {
        return 'Transaksi belum dapat disimpan karena konfigurasi sistem perlu diperbarui. Silakan hubungi administrator.';
    }

    return message || 'Pesanan gagal disimpan.';
};

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
    ready_for_confirmation: 'Menunggu konfirmasi admin',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    unpaid: 'Belum Dibayar',
    partial: 'Dibayar Sebagian',
    paid: 'Lunas',
};

const channelLabels = {
    pos: 'POS',
    shopee: 'Shopee',
    tokopedia: 'Tokopedia',
    tiktok_shop: 'TikTok Shop',
    lazada: 'Lazada',
};

const shipmentStatuses = {
    pending: 'Menunggu dikirim',
    booked: 'Booking kurir',
    picked_up: 'Dijemput kurir',
    in_transit: 'Dalam perjalanan',
    delivered: 'Terkirim',
    failed: 'Pengiriman gagal',
    cancelled: 'Dibatalkan',
};

const importStatusLabels = {
    ready: 'Siap diimpor',
    imported: 'Berhasil diimpor',
    duplicate: 'Duplikat',
    invalid: 'Ditolak',
};

const importStatusStyles = {
    ready: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    imported: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    duplicate: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    invalid: 'bg-red-500/10 text-red-300 border-red-500/20',
};

const paymentMethodLabels = {
    cash: 'Tunai',
    transfer: 'Transfer Bank',
    qris: 'QRIS',
    debit: 'Kartu Debit',
    credit: 'Kartu Kredit',
    other: 'Lainnya',
};

const paymentTypeLabels = {
    full: 'Lunas',
    down_payment: 'DP / Uang Muka',
    installment: 'Cicilan',
    settlement: 'Pelunasan',
};

let nextOrderItemDraftId = 0;

function StatusBadge({ status }) {
    const styles = {
        pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        ready_for_confirmation: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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

function completionWhatsAppUrl(order) {
    const phone = order.customer?.phone || order.shipment?.recipient_phone;
    const digits = String(phone || '').replace(/\D/g, '');
    const number = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
    if (!number) return null;

    const customerName = order.customer?.name || order.shipment?.recipient_name || 'Pelanggan';
    const message = `Halo ${customerName}, pesanan ${order.order_number} sudah selesai diproduksi. Silakan hubungi kami untuk informasi pengambilan atau pengiriman. Terima kasih.`;

    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function ShipmentPanel({ order, canEdit, onUpdated }) {
    const shipment = order.shipment;
    const [form, setForm] = useState({
        recipient_name: '',
        recipient_phone: '',
        shipping_address: '',
        courier: '',
        service_name: '',
        tracking_number: '',
        shipping_fee: '0',
        status: 'pending',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        setForm({
            recipient_name: shipment?.recipient_name || '',
            recipient_phone: shipment?.recipient_phone || '',
            shipping_address: shipment?.shipping_address || '',
            courier: shipment?.courier || '',
            service_name: shipment?.service_name || '',
            tracking_number: shipment?.tracking_number || '',
            shipping_fee: String(shipment?.shipping_fee || 0),
            status: shipment?.status || 'pending',
            notes: shipment?.notes || '',
        });
        setError('');
        setSuccess('');
    }, [order.id, shipment]);

    const saveShipment = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.put(`/api/v1/orders/${order.id}/shipment`, {
                ...form,
                shipping_fee: Number(form.shipping_fee || 0),
                recipient_name: form.recipient_name || null,
                recipient_phone: form.recipient_phone || null,
                shipping_address: form.shipping_address || null,
                courier: form.courier || null,
                service_name: form.service_name || null,
                tracking_number: form.tracking_number || null,
                notes: form.notes || null,
            });
            onUpdated({ ...order, shipment: response.data?.data });
            setSuccess('Informasi pengiriman tersimpan.');
        } catch (requestError) {
            const validationError = requestError.response?.data?.errors
                ? Object.values(requestError.response.data.errors).flat()[0]
                : null;
            setError(
                validationError ||
                    requestError.response?.data?.message ||
                    'Informasi pengiriman gagal disimpan.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="mt-6 rounded-xl border border-slate-700 p-4">
            <div className="mb-4 flex items-center gap-2">
                <Truck size={17} className="text-blue-300" />
                <div>
                    <h4 className="font-semibold text-white">Pengiriman</h4>
                    <p className="text-xs text-slate-500">
                        Pencatatan manual; belum membuat booking atau pelacakan otomatis.
                    </p>
                </div>
            </div>

            {!canEdit && shipment && (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <p><span className="text-slate-500">Kurir:</span> {shipment.courier || '-'}</p>
                    <p><span className="text-slate-500">Layanan:</span> {shipment.service_name || '-'}</p>
                    <p><span className="text-slate-500">Resi:</span> {shipment.tracking_number || '-'}</p>
                    <p><span className="text-slate-500">Status:</span> {shipmentStatuses[shipment.status] || shipment.status}</p>
                    <p className="sm:col-span-2"><span className="text-slate-500">Alamat:</span> {shipment.shipping_address || '-'}</p>
                </div>
            )}

            {canEdit && (
                <form onSubmit={saveShipment} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nama penerima">
                            <input className="form-input" maxLength="150" value={form.recipient_name}
                                onChange={(event) => setForm({ ...form, recipient_name: event.target.value })} />
                        </Field>
                        <Field label="Telepon penerima">
                            <input className="form-input" maxLength="25" value={form.recipient_phone}
                                onChange={(event) => setForm({ ...form, recipient_phone: event.target.value })} />
                        </Field>
                        <Field label="Kurir">
                            <input className="form-input" maxLength="80" placeholder="GrabExpress, GoSend, Paxel, Lalamove..."
                                value={form.courier} onChange={(event) => setForm({ ...form, courier: event.target.value })} />
                        </Field>
                        <Field label="Layanan">
                            <input className="form-input" maxLength="80" placeholder="Same Day / Instant / Reguler"
                                value={form.service_name} onChange={(event) => setForm({ ...form, service_name: event.target.value })} />
                        </Field>
                        <Field label="Nomor resi">
                            <input className="form-input" maxLength="100" value={form.tracking_number}
                                onChange={(event) => setForm({ ...form, tracking_number: event.target.value })} />
                        </Field>
                        <Field label="Ongkir (Rp)">
                            <input className="form-input" type="number" min="0" step="1" value={form.shipping_fee}
                                onChange={(event) => setForm({ ...form, shipping_fee: event.target.value })} />
                        </Field>
                        <Field label="Status pengiriman">
                            <select className="form-input" value={form.status}
                                onChange={(event) => setForm({ ...form, status: event.target.value })}>
                                {Object.entries(shipmentStatuses).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Catatan kurir">
                            <input className="form-input" maxLength="2000" value={form.notes}
                                onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                        </Field>
                    </div>
                    <Field label="Alamat pengiriman">
                        <textarea className="form-input min-h-20" maxLength="2000" value={form.shipping_address}
                            onChange={(event) => setForm({ ...form, shipping_address: event.target.value })} />
                    </Field>
                    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                    {success && <p role="status" className="text-sm text-emerald-400">{success}</p>}
                    <div className="flex justify-end">
                        <button type="submit" className="secondary-button" disabled={saving}>
                            <Check size={15} /> {saving ? 'Menyimpan...' : 'Simpan Pengiriman'}
                        </button>
                    </div>
                </form>
            )}

            {!canEdit && !shipment && (
                <p className="text-sm text-slate-500">Belum ada data pengiriman.</p>
            )}
        </section>
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

export default function Orders({
    canCreate = false,
    canCreatePayment = false,
    canEdit = false,
    canSelectBranch = false,
    defaultBranchId = '',
    autoOpenCreate = false,
    autoOpenCreateMode = 'invoice',
    onAutoOpenHandled,
}) {
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [finishingTypes, setFinishingTypes] = useState([]);
    const [branches, setBranches] = useState([]);
    const [pagination, setPagination] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [marketplaceImporting, setMarketplaceImporting] = useState(false);
    const [error, setError] = useState('');
    const [marketplaceError, setMarketplaceError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [marketplaceFile, setMarketplaceFile] = useState(null);
    const [marketplacePreview, setMarketplacePreview] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [checkoutMode, setCheckoutMode] = useState('invoice');
    const [initialPayment, setInitialPayment] = useState({
        type: 'full',
        amount: '',
        method: 'cash',
        tendered_amount: '',
        reference_number: '',
        notes: '',
    });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [posReceipt, setPosReceipt] = useState(null);
    const [showSettlementForm, setShowSettlementForm] = useState(false);
    const [settlementSaving, setSettlementSaving] = useState(false);
    const [settlementError, setSettlementError] = useState('');
    const [settlementForm, setSettlementForm] = useState({
        amount: '',
        method: 'cash',
        tendered_amount: '',
        reference_number: '',
        notes: '',
    });
    const hasActiveCustomerUploadLink = Boolean(
        selectedOrder?.customer_upload_token_expires_at &&
            new Date(selectedOrder.customer_upload_token_expires_at) > new Date(),
    );
    const [formError, setFormError] = useState('');
    const [approvalLinkLoading, setApprovalLinkLoading] = useState(false);
    const [approvalLinkError, setApprovalLinkError] = useState('');
    const [customerUploadLinkLoading, setCustomerUploadLinkLoading] = useState(false);
    const [customerUploadLinkError, setCustomerUploadLinkError] = useState('');
    const [completionConfirming, setCompletionConfirming] = useState(false);
    const [completionConfirmError, setCompletionConfirmError] = useState('');
    const [marketplaceConfirming, setMarketplaceConfirming] = useState(false);
    const [marketplaceConfirmError, setMarketplaceConfirmError] = useState('');

    const emptyItem = () => ({
        draft_id: ++nextOrderItemDraftId,
        reference_image: null,
        reference_image_input_version: 0,
        product_id: '',
        quantity: '1',
        width: '',
        height: '',
        specifications: '',
        notes: '',
        finishing_type_ids: [],
    });

    const [form, setForm] = useState({
        customer_id: '',
        branch_id: defaultBranchId ? String(defaultBranchId) : '',
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
            const [
                customerResponse,
                productResponse,
                finishingResponse,
                branchResponse,
            ] = await Promise.all([
                api.get('/api/v1/customers', { params: { per_page: 100 } }),
                api.get('/api/v1/products', { params: { per_page: 100 } }),
                canCreate
                    ? api.get('/api/v1/order-finishing-types')
                    : Promise.resolve(null),
                canSelectBranch
                    ? api.get('/api/v1/branches')
                    : Promise.resolve(null),
            ]);

            setCustomers(listData(customerResponse));
            setProducts(listData(productResponse));
            setFinishingTypes(finishingResponse?.data?.data || []);
            setBranches(branchResponse?.data?.data || []);
        } catch (err) {
            console.error('Gagal memuat master data:', err);
        }
    }, [canCreate, canSelectBranch]);

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
    const currentPaymentAmount = initialPayment.type === 'full'
        ? total
        : Math.max(0, Number(initialPayment.amount || 0));
    const cashChange = initialPayment.method === 'cash'
        ? Math.max(0, Number(initialPayment.tendered_amount || 0) - currentPaymentAmount)
        : 0;
    const settlementAmount = Math.max(0, Number(settlementForm.amount || 0));
    const settlementCashChange = settlementForm.method === 'cash'
        ? Math.max(0, Number(settlementForm.tendered_amount || 0) - settlementAmount)
        : 0;

    const updateItem = (index, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item,
            ),
        }));
    };

    const clearItemImage = (index) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                          ...item,
                          reference_image: null,
                          reference_image_input_version:
                              item.reference_image_input_version + 1,
                      }
                    : item,
            ),
        }));
    };

    const toggleFinishing = (index, finishingTypeId) => {
        const selectedIds = form.items[index].finishing_type_ids;
        const id = String(finishingTypeId);
        const nextIds = selectedIds.includes(id)
            ? selectedIds.filter((selectedId) => selectedId !== id)
            : [...selectedIds, id];

        updateItem(index, 'finishing_type_ids', nextIds);
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
            branch_id: defaultBranchId ? String(defaultBranchId) : '',
            discount: '0',
            due_date: '',
            notes: '',
            items: [emptyItem()],
        });
        setInitialPayment({
            type: 'full',
            amount: '',
            method: 'cash',
            tendered_amount: '',
            reference_number: '',
            notes: '',
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

        const paymentAmount = initialPayment.type === 'full'
            ? total
            : Number(initialPayment.amount);
        const tenderedAmount = Number(initialPayment.tendered_amount);
        if (checkoutMode === 'pos') {
            if (!canCreatePayment) {
                setFormError('Akun ini tidak memiliki izin menerima pembayaran.');
                return;
            }
            if (total <= 0) {
                setFormError('Transaksi POS harus memiliki total pembayaran lebih dari nol.');
                return;
            }
            if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
                setFormError('Masukkan nominal DP yang valid.');
                return;
            }
            if (initialPayment.type === 'down_payment' && paymentAmount >= total) {
                setFormError('Nominal DP harus lebih kecil dari total. Pilih Lunas untuk membayar seluruhnya.');
                return;
            }
            if (initialPayment.method === 'cash' && (!Number.isFinite(tenderedAmount) || tenderedAmount < paymentAmount)) {
                setFormError('Nominal uang tunai diterima harus sama atau lebih besar dari tagihan saat ini.');
                return;
            }
        }

        setSaving(true);

        try {
            const payload = {
                order_type: checkoutMode,
                customer_id: form.customer_id || null,
                ...(canSelectBranch
                    ? { branch_id: form.branch_id ? Number(form.branch_id) : null }
                    : {}),
                discount,
                due_date: form.due_date || null,
                notes: form.notes || null,
                ...(checkoutMode === 'pos'
                    ? {
                          initial_payment: {
                              type: initialPayment.type,
                              amount: paymentAmount,
                              method: initialPayment.method,
                              reference_number:
                                  initialPayment.reference_number || null,
                              notes: initialPayment.notes || null,
                          },
                      }
                    : {}),
                items: form.items.map((item) => ({
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity),
                    width: item.width ? Number(item.width) : null,
                    height: item.height ? Number(item.height) : null,
                    specifications: item.specifications || null,
                    notes: item.notes || null,
                    finishing_type_ids: item.finishing_type_ids.map(Number),
                })),
            };

            const hasReferenceImages = form.items.some(
                (item) => item.reference_image,
            );
            let response;

            if (hasReferenceImages) {
                const formData = new FormData();
                formData.append('customer_id', payload.customer_id || '');
                if (canSelectBranch) {
                    formData.append('branch_id', form.branch_id || '');
                }
                formData.append('discount', String(payload.discount));
                formData.append('due_date', payload.due_date || '');
                formData.append('notes', payload.notes || '');
                formData.append('order_type', payload.order_type);
                if (payload.initial_payment) {
                    formData.append(
                        'initial_payment[type]',
                        payload.initial_payment.type,
                    );
                    formData.append(
                        'initial_payment[amount]',
                        String(payload.initial_payment.amount),
                    );
                    formData.append(
                        'initial_payment[method]',
                        payload.initial_payment.method,
                    );
                    formData.append(
                        'initial_payment[reference_number]',
                        payload.initial_payment.reference_number || '',
                    );
                    formData.append(
                        'initial_payment[notes]',
                        payload.initial_payment.notes || '',
                    );
                }

                payload.items.forEach((item, index) => {
                    formData.append(`items[${index}][product_id]`, String(item.product_id));
                    formData.append(`items[${index}][quantity]`, String(item.quantity));
                    formData.append(`items[${index}][width]`, item.width ? String(item.width) : '');
                    formData.append(`items[${index}][height]`, item.height ? String(item.height) : '');
                    formData.append(`items[${index}][specifications]`, item.specifications || '');
                    formData.append(`items[${index}][notes]`, item.notes || '');
                    item.finishing_type_ids.forEach((id) => {
                        formData.append(`items[${index}][finishing_type_ids][]`, String(id));
                    });

                    const image = form.items[index].reference_image;
                    if (image) {
                        formData.append(`items[${index}][reference_image]`, image);
                    }
                });

                response = await api.post('/api/v1/orders', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                response = await api.post('/api/v1/orders', payload);
            }

            const savedOrder = response.data?.data || null;
            const savedPayment = savedOrder?.payments?.[0] || null;

            setShowForm(false);
            resetForm();
            if (checkoutMode === 'pos' && savedOrder && savedPayment) {
                setPosReceipt({
                    payment: { ...savedPayment, order: savedOrder },
                    tenderedAmount: initialPayment.method === 'cash'
                        ? tenderedAmount
                        : paymentAmount,
                });
            } else {
                setSelectedOrder(savedOrder
                    ? {
                          ...savedOrder,
                          approval_url: response.data.approval_url,
                      }
                    : null);
            }
            await loadOrders(1);
        } catch (err) {
            setFormError(orderSaveError(err));
        } finally {
            setSaving(false);
        }
    };

    const showDetail = async (order) => {
        try {
            const response = await api.get(`/api/v1/orders/${order.id}`);
            setSelectedOrder(response.data?.data || response.data);
            setApprovalLinkError('');
            setCustomerUploadLinkError('');
            setCompletionConfirmError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Gagal memuat detail pesanan.');
        }
    };

    const openSettlementForm = () => {
        const balance = Number(selectedOrder?.balance || 0);
        setSettlementForm({
            amount: String(balance),
            method: 'cash',
            tendered_amount: String(balance),
            reference_number: '',
            notes: '',
        });
        setSettlementError('');
        setShowSettlementForm(true);
    };

    const submitSettlement = async (event) => {
        event.preventDefault();
        const balance = Number(selectedOrder?.balance || 0);

        if (!settlementAmount || settlementAmount > balance) {
            setSettlementError('Nominal pembayaran harus lebih dari nol dan tidak boleh melebihi sisa tagihan.');
            return;
        }
        if (settlementForm.method === 'cash' && Number(settlementForm.tendered_amount) < settlementAmount) {
            setSettlementError('Nominal uang tunai diterima harus sama atau lebih besar dari pembayaran.');
            return;
        }

        setSettlementSaving(true);
        setSettlementError('');
        try {
            const response = await api.post('/api/v1/payments', {
                order_id: selectedOrder.id,
                amount: settlementAmount,
                payment_type: settlementAmount === balance ? 'settlement' : 'installment',
                method: settlementForm.method,
                reference_number: settlementForm.reference_number || null,
                notes: settlementForm.notes || null,
            });
            const payment = response.data?.data;

            setShowSettlementForm(false);
            if (payment) {
                setPosReceipt({
                    payment,
                    tenderedAmount: settlementForm.method === 'cash'
                        ? Number(settlementForm.tendered_amount)
                        : settlementAmount,
                });
            }
            await showDetail(selectedOrder);
            await loadOrders(1);
        } catch (err) {
            setSettlementError(orderSaveError(err));
        } finally {
            setSettlementSaving(false);
        }
    };

    const createCustomerUploadLink = async () => {
        if (!selectedOrder) return;
        if (
            (selectedOrder.customer_upload_url || hasActiveCustomerUploadLink) &&
            !window.confirm('Buat tautan baru? Tautan unggah yang lama akan langsung dinonaktifkan.')
        ) {
            return;
        }

        setCustomerUploadLinkLoading(true);
        setCustomerUploadLinkError('');
        try {
            const response = await api.post(
                `/api/v1/orders/${selectedOrder.id}/customer-upload-link`,
            );
            setSelectedOrder((current) => ({
                ...current,
                customer_upload_url: response.data?.upload_url,
                customer_upload_expires_at: response.data?.expires_at,
            }));
        } catch (requestError) {
            setCustomerUploadLinkError(
                requestError.response?.data?.message ||
                    'Gagal membuat tautan unggah pelanggan.',
            );
        } finally {
            setCustomerUploadLinkLoading(false);
        }
    };

    const copyCustomerUploadLink = async () => {
        try {
            await navigator.clipboard.writeText(selectedOrder.customer_upload_url);
            setCustomerUploadLinkError('');
        } catch {
            setCustomerUploadLinkError(
                'Tidak dapat menyalin otomatis. Salin tautan dari kolom di bawah.',
            );
        }
    };

    const confirmCompletion = async () => {
        if (!selectedOrder) return;

        setCompletionConfirming(true);
        setCompletionConfirmError('');
        try {
            const response = await api.post(
                `/api/v1/orders/${selectedOrder.id}/confirm-completion`,
            );
            setSelectedOrder(response.data?.data || selectedOrder);
            await loadOrders(1);
        } catch (requestError) {
            setCompletionConfirmError(
                requestError.response?.data?.message ||
                    'Konfirmasi penyelesaian pesanan gagal.',
            );
        } finally {
            setCompletionConfirming(false);
        }
    };

    const createApprovalLink = async () => {
        if (!selectedOrder) return;
        if (
            selectedOrder.approval_url &&
            !window.confirm(
                'Buat tautan baru? Tautan persetujuan yang lama akan dinonaktifkan.',
            )
        ) {
            return;
        }

        setApprovalLinkLoading(true);
        setApprovalLinkError('');

        try {
            const response = await api.post(
                `/api/v1/orders/${selectedOrder.id}/approval-link`,
            );
            setSelectedOrder((current) => ({
                ...current,
                approval_url: response.data?.approval_url,
            }));
        } catch (err) {
            setApprovalLinkError(
                err.response?.data?.message ||
                    'Gagal membuat tautan persetujuan.',
            );
        } finally {
            setApprovalLinkLoading(false);
        }
    };

    const downloadMarketplaceTemplate = async () => {
        setMarketplaceError('');

        try {
            const response = await api.get('/api/v1/marketplace/orders/template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'mohan-digital-labs-marketplace-orders-template.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (requestError) {
            setMarketplaceError(
                requestError.response?.data?.message ||
                    'Template CSV gagal diunduh.',
            );
        }
    };

    const marketplaceFormData = () => {
        const formData = new FormData();
        formData.append('file', marketplaceFile);
        if (canSelectBranch) {
            formData.append('branch_id', form.branch_id || '');
        }

        return formData;
    };

    const previewMarketplaceImport = async () => {
        if (!marketplaceFile || (canSelectBranch && !form.branch_id)) {
            setMarketplaceError(
                !marketplaceFile
                    ? 'Pilih file CSV terlebih dahulu.'
                    : 'Pilih cabang untuk pesanan marketplace.',
            );
            return;
        }

        setMarketplaceImporting(true);
        setMarketplaceError('');
        setMarketplacePreview(null);

        try {
            const response = await api.post(
                '/api/v1/marketplace/orders/import/preview',
                marketplaceFormData(),
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setMarketplacePreview(response.data?.data || null);
        } catch (requestError) {
            const validationError = requestError.response?.data?.errors
                ? Object.values(requestError.response.data.errors).flat()[0]
                : null;
            setMarketplaceError(
                validationError ||
                    requestError.response?.data?.message ||
                    'Pratinjau CSV gagal diproses.',
            );
        } finally {
            setMarketplaceImporting(false);
        }
    };

    const importMarketplaceOrders = async () => {
        if (
            !marketplaceFile ||
            !marketplacePreview?.ready ||
            (canSelectBranch && !form.branch_id)
        ) return;

        setMarketplaceImporting(true);
        setMarketplaceError('');

        try {
            const response = await api.post(
                '/api/v1/marketplace/orders/import',
                marketplaceFormData(),
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setMarketplacePreview(response.data?.data || null);
            setMarketplaceFile(null);
            await loadOrders(1);
        } catch (requestError) {
            const validationError = requestError.response?.data?.errors
                ? Object.values(requestError.response.data.errors).flat()[0]
                : null;
            setMarketplaceError(
                validationError ||
                    requestError.response?.data?.message ||
                    'Impor marketplace gagal diproses.',
            );
        } finally {
            setMarketplaceImporting(false);
        }
    };

    const confirmMarketplaceOrder = async () => {
        if (!selectedOrder) return;

        setMarketplaceConfirming(true);
        setMarketplaceConfirmError('');
        try {
            const response = await api.post(
                `/api/v1/orders/${selectedOrder.id}/confirm-marketplace`,
            );
            setSelectedOrder(response.data?.data || selectedOrder);
            await loadOrders(1);
        } catch (requestError) {
            setMarketplaceConfirmError(
                requestError.response?.data?.message ||
                    'Pesanan marketplace gagal dikonfirmasi.',
            );
        } finally {
            setMarketplaceConfirming(false);
        }
    };

    const copyApprovalLink = async () => {
        try {
            await navigator.clipboard.writeText(selectedOrder.approval_url);
            setApprovalLinkError('');
        } catch {
            setApprovalLinkError(
                'Tidak dapat menyalin otomatis. Salin tautan dari kolom di bawah.',
            );
        }
    };

    const openCreateForm = (mode = 'invoice') => {
        resetForm();
        setCheckoutMode(mode);
        setShowForm(true);
    };

    useEffect(() => {
        if (!autoOpenCreate) return;

        if (canCreate) {
            openCreateForm(autoOpenCreateMode);
        }

        onAutoOpenHandled?.();
    }, [autoOpenCreate, autoOpenCreateMode, canCreate, onAutoOpenHandled]);

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
                    <div className="flex flex-wrap gap-2">
                        {canCreatePayment && (
                            <button
                                type="button"
                                className="primary-button"
                                onClick={() => openCreateForm('pos')}
                            >
                                <Wallet size={16} /> Transaksi POS
                            </button>
                        )}
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openCreateForm('invoice')}
                        >
                            <ClipboardList size={16} /> Buat Invoice
                        </button>
                    </div>
                )}
            </div>

            {canCreate && (
                <section className="panel border border-blue-500/20">
                    <div className="panel-header flex-wrap">
                        <div>
                            <h3 className="panel-title">Impor Pesanan Marketplace</h3>
                            <p className="panel-subtitle">
                                Format template MOHAN Digital Lab's; ekspor marketplace perlu disesuaikan ke kolom template.
                            </p>
                        </div>
                        <button type="button" className="secondary-button" onClick={downloadMarketplaceTemplate}>
                            <Download size={15} /> Unduh Template
                        </button>
                    </div>

                    <p className="mb-4 text-xs leading-5 text-slate-400">
                        Satu baris per item; semua kolom pesanan harus sama di setiap baris dengan ID pesanan yang sama.
                        SKU yang tidak dikenal membatalkan seluruh pesanan terkait. Pesanan yang berhasil diimpor masuk
                        tinjauan staf; belum membuat work order. Status pembayaran marketplace hanya informasi dan belum
                        dicatat sebagai penerimaan atau settlement.
                    </p>

                    {canSelectBranch && (
                        <Field label="Cabang untuk pesanan marketplace *">
                            <select
                                className="form-input mb-3"
                                required
                                value={form.branch_id}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        branch_id: event.target.value,
                                    })
                                }
                            >
                                <option value="">Pilih cabang</option>
                                {branches
                                    .filter((branch) => branch.is_active)
                                    .map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.code} — {branch.name}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            className="form-input min-w-0 flex-1"
                            aria-label="Pilih file CSV marketplace"
                            onChange={(event) => {
                                setMarketplaceFile(event.target.files?.[0] || null);
                                setMarketplacePreview(null);
                                setMarketplaceError('');
                            }}
                        />
                        <button
                            type="button"
                            className="secondary-button"
                            disabled={!marketplaceFile || marketplaceImporting}
                            onClick={previewMarketplaceImport}
                        >
                            <Search size={15} />
                            {marketplaceImporting ? 'Memeriksa...' : 'Pratinjau'}
                        </button>
                        <button
                            type="button"
                            className="primary-button"
                            disabled={!marketplaceFile || !marketplacePreview?.ready || marketplaceImporting}
                            onClick={importMarketplaceOrders}
                        >
                            <Upload size={15} />
                            {marketplaceImporting
                                ? 'Mengimpor...'
                                : `Impor ${marketplacePreview?.ready || 0} pesanan`}
                        </button>
                    </div>

                    {marketplaceError && (
                        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-red-400">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            {marketplaceError}
                        </p>
                    )}

                    {marketplacePreview && (
                        <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="status-badge bg-blue-500/10 text-blue-300 border-blue-500/20">
                                    {marketplacePreview.ready} siap
                                </span>
                                {marketplacePreview.imported > 0 && (
                                    <span className="status-badge bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                                        {marketplacePreview.imported} berhasil diimpor
                                    </span>
                                )}
                                {marketplacePreview.duplicates > 0 && (
                                    <span className="status-badge bg-amber-500/10 text-amber-300 border-amber-500/20">
                                        {marketplacePreview.duplicates} duplikat
                                    </span>
                                )}
                                {marketplacePreview.invalid > 0 && (
                                    <span className="status-badge bg-red-500/10 text-red-300 border-red-500/20">
                                        {marketplacePreview.invalid} ditolak
                                    </span>
                                )}
                            </div>
                            <div className="max-h-64 space-y-2 overflow-y-auto">
                                {(marketplacePreview.orders || []).map((item, index) => (
                                    <article
                                        key={`${item.sales_channel || 'invalid'}-${item.external_order_id || index}`}
                                        className="rounded-lg border border-slate-700 p-3"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-white">
                                                    {channelLabels[item.sales_channel] || item.sales_channel || 'Kanal tidak diketahui'}
                                                    {' · '}{item.external_order_id || 'ID kosong'}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    {item.customer_name || 'Pelanggan'} · {item.item_count} item · {money(item.total)}
                                                </p>
                                            </div>
                                            <span className={`status-badge ${importStatusStyles[item.status] || ''}`}>
                                                {importStatusLabels[item.status] || item.status}
                                            </span>
                                        </div>
                                        {item.errors?.length > 0 && (
                                            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-300">
                                                {item.errors.map((message) => <li key={message}>{message}</li>)}
                                            </ul>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}

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
                        <p className="panel-subtitle">Data transaksi dari database MOHAN Digital Lab's</p>
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
                        <option value="ready_for_confirmation">Menunggu konfirmasi admin</option>
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
                                <th>Kanal</th>
                                <th>Pelanggan</th>
                                <th>Tanggal</th>
                                <th>Total</th>
                                <th>Sisa Tagihan</th>
                                <th>Status Pesanan</th>
                                <th>Persetujuan Quote</th>
                                <th>Pembayaran</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="10" className="text-center py-8">Memuat data pesanan...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan="10" className="text-center py-8 text-slate-500">Belum ada data pesanan.</td></tr>
                            ) : orders.map((order) => (
                                <tr key={order.id}>
                                    <td className="font-semibold text-white">{order.order_number}</td>
                                    <td>
                                        <span className="status-badge bg-slate-500/10 text-slate-300 border-slate-500/20">
                                            {channelLabels[order.sales_channel] || order.sales_channel || 'POS'}
                                        </span>
                                        {order.external_order_id && (
                                            <span className="mt-1 block text-xs text-slate-500">{order.external_order_id}</span>
                                        )}
                                    </td>
                                    <td>{order.customer?.name || order.shipment?.recipient_name || 'Pelanggan Umum'}</td>
                                    <td>{dateFormat(order.external_order_date || order.created_at)}</td>
                                    <td className="text-white">{money(order.total)}</td>
                                    <td className="text-amber-400">{money(order.balance)}</td>
                                    <td><StatusBadge status={order.status} /></td>
                                    <td>
                                        <span
                                            className={`status-badge ${
                                                order.quote_status === 'approved'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : order.quote_status === 'rejected'
                                                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}
                                        >
                                            {order.quote_status === 'approved'
                                                ? 'Disetujui'
                                                : order.quote_status === 'rejected'
                                                  ? 'Ditolak'
                                                  : order.sales_channel !== 'pos'
                                                    ? 'Perlu tinjauan staf'
                                                    : 'Menunggu'}
                                        </span>
                                    </td>
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
                                <h3 className="panel-title">
                                    {checkoutMode === 'pos'
                                        ? 'Transaksi POS'
                                        : 'Buat Invoice'}
                                </h3>
                                <p className="panel-subtitle">
                                    {checkoutMode === 'pos'
                                        ? 'Catat pembayaran langsung sebelum transaksi disimpan.'
                                        : 'Simpan tagihan untuk dibayar kemudian.'}
                                </p>
                            </div>
                            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                                <X size={17} />
                            </button>
                        </div>

                        <form onSubmit={submitOrder} className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2">
                                {canCreatePayment && (
                                    <button
                                        type="button"
                                        className={`rounded-xl border p-3 text-left transition ${
                                            checkoutMode === 'pos'
                                                ? 'border-red-500/50 bg-red-500/10'
                                                : 'border-slate-700 hover:border-slate-500'
                                        }`}
                                        onClick={() => {
                                            setCheckoutMode('pos');
                                            setFormError('');
                                        }}
                                        aria-pressed={checkoutMode === 'pos'}
                                    >
                                        <span className="flex items-center gap-2 font-semibold text-white">
                                            <Wallet size={16} />
                                            Transaksi POS
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-400">
                                            Bayar lunas atau DP sekarang.
                                        </span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={`rounded-xl border p-3 text-left transition ${
                                        checkoutMode === 'invoice'
                                            ? 'border-red-500/50 bg-red-500/10'
                                            : 'border-slate-700 hover:border-slate-500'
                                    }`}
                                    onClick={() => {
                                        setCheckoutMode('invoice');
                                        setFormError('');
                                    }}
                                    aria-pressed={checkoutMode === 'invoice'}
                                >
                                    <span className="flex items-center gap-2 font-semibold text-white">
                                        <ClipboardList size={16} />
                                        Buat Invoice
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-400">
                                        Simpan tagihan, pembayaran dicatat terpisah.
                                    </span>
                                </button>
                            </div>

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

                                {canSelectBranch && (
                                    <Field label="Cabang Pesanan *">
                                        <select
                                            className="form-input"
                                            required
                                            value={form.branch_id}
                                            onChange={(event) =>
                                                setForm({
                                                    ...form,
                                                    branch_id: event.target.value,
                                                })
                                            }
                                        >
                                            <option value="">Pilih cabang</option>
                                            {branches
                                                .filter((branch) => branch.is_active)
                                                .map((branch) => (
                                                    <option
                                                        key={branch.id}
                                                        value={branch.id}
                                                    >
                                                        {branch.code} — {branch.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </Field>
                                )}

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
                                        const selectedFinishingTypes = finishingTypes.filter(
                                            (finishingType) => item.finishing_type_ids.includes(String(finishingType.id)),
                                        );
                                        const finishingUnitCost = selectedFinishingTypes.reduce(
                                            (sum, finishingType) => sum + Number(finishingType.default_cost || 0),
                                            0,
                                        );

                                        return (
                                            <div key={item.draft_id} className="rounded-xl border border-slate-700 p-4 space-y-3">
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

                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-300">
                                                            Finishing
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Biaya default menambah HPP internal per unit, bukan tagihan pelanggan.
                                                        </p>
                                                    </div>
                                                    {finishingTypes.length > 0 ? (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {finishingTypes.map((finishingType) => (
                                                                <label
                                                                    key={finishingType.id}
                                                                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 p-3 text-sm"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.finishing_type_ids.includes(String(finishingType.id))}
                                                                        onChange={() => toggleFinishing(index, finishingType.id)}
                                                                    />
                                                                    <span className="min-w-0">
                                                                        <span className="block text-slate-200">
                                                                            {finishingType.name}
                                                                        </span>
                                                                        <span className="block text-xs text-slate-500">
                                                                            {finishingType.code} · {money(finishingType.default_cost)} / unit
                                                                        </span>
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-500">
                                                            Belum ada finishing aktif.
                                                        </p>
                                                    )}
                                                    {selectedFinishingTypes.length > 0 && (
                                                        <p className="text-xs text-slate-400">
                                                            Tambahan HPP: {money(finishingUnitCost)} / unit
                                                        </p>
                                                    )}
                                                </div>

                                                <Field label="Spesifikasi">
                                                    <input
                                                        className="form-input"
                                                        placeholder="Contoh: Bahan Flexi Korea, warna, atau catatan khusus..."
                                                        value={item.specifications}
                                                        onChange={(event) => updateItem(index, 'specifications', event.target.value)}
                                                    />
                                                </Field>

                                                <div className="space-y-2">
                                                    <Field label="Gambar referensi (opsional)">
                                                        <input
                                                            key={`${item.draft_id}-${item.reference_image_input_version}`}
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            className="order-item-image-input"
                                                            disabled={saving}
                                                            onChange={(event) => updateItem(
                                                                index,
                                                                'reference_image',
                                                                event.target.files?.[0] || null,
                                                            )}
                                                        />
                                                    </Field>
                                                    {item.reference_image && (
                                                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                                                            <span className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                                                                <FileImage size={16} className="shrink-0 text-red-400" />
                                                                <span className="break-all">{item.reference_image.name}</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="secondary-button !min-h-8 !px-3 !py-1.5 !text-red-400"
                                                                onClick={() => clearItemImage(index)}
                                                                aria-label={`Hapus gambar referensi item ${index + 1}`}
                                                            >
                                                                Hapus
                                                            </button>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-slate-500">
                                                        JPG, PNG, atau WEBP, maksimal 10 MB. Gambar hanya terhubung ke Item {index + 1}.
                                                    </p>
                                                </div>

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

                            {checkoutMode === 'pos' && (
                                <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                    <div>
                                        <h4 className="font-semibold text-white">
                                            Pembayaran saat transaksi
                                        </h4>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Pembayaran dan pesanan disimpan bersamaan. Jika pembayaran gagal, pesanan juga tidak dibuat.
                                        </p>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Tipe Pembayaran">
                                            <select
                                                className="form-input"
                                                value={initialPayment.type}
                                                onChange={(event) =>
                                                    setInitialPayment((current) => ({
                                                        ...current,
                                                        type: event.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="full">Lunas</option>
                                                <option value="down_payment">DP / Uang Muka</option>
                                            </select>
                                        </Field>
                                        {initialPayment.type === 'full' ? (
                                            <Field label="Total Dibayar Sekarang">
                                                <input
                                                    className="form-input"
                                                    value={money(total)}
                                                    readOnly
                                                />
                                            </Field>
                                        ) : (
                                            <Field label="Nominal DP (Rp)">
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    min="1"
                                                    max={Math.max(0, total - 0.01)}
                                                    step="0.01"
                                                    placeholder="Masukkan nominal DP"
                                                    value={initialPayment.amount}
                                                    onChange={(event) =>
                                                        setInitialPayment((current) => ({
                                                            ...current,
                                                            amount: event.target.value,
                                                        }))
                                                    }
                                                    required
                                                />
                                            </Field>
                                        )}
                                        <Field label="Metode Pembayaran">
                                            <select
                                                className="form-input"
                                                value={initialPayment.method}
                                                onChange={(event) =>
                                                    setInitialPayment((current) => ({
                                                        ...current,
                                                        method: event.target.value,
                                                    }))
                                                }
                                            >
                                                {Object.entries(paymentMethodLabels).map(
                                                    ([value, label]) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </Field>
                                        {initialPayment.method === 'cash' && (
                                            <>
                                                <Field label="Uang Diterima (Rp)">
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        min={Math.max(0, currentPaymentAmount)}
                                                        step="1"
                                                        placeholder="Masukkan uang dari pelanggan"
                                                        value={initialPayment.tendered_amount}
                                                        onChange={(event) =>
                                                            setInitialPayment((current) => ({
                                                                ...current,
                                                                tendered_amount: event.target.value,
                                                            }))
                                                        }
                                                        required
                                                    />
                                                </Field>
                                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 sm:self-end">
                                                    <p className="text-xs text-emerald-300">Kembalian</p>
                                                    <p className="mt-1 text-lg font-bold text-emerald-300">
                                                        {money(cashChange)}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                        <Field label="Nomor Referensi (Opsional)">
                                            <input
                                                className="form-input"
                                                maxLength="100"
                                                placeholder="Referensi transfer/QRIS"
                                                value={initialPayment.reference_number}
                                                onChange={(event) =>
                                                    setInitialPayment((current) => ({
                                                        ...current,
                                                        reference_number: event.target.value,
                                                    }))
                                                }
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Catatan Pembayaran (Opsional)">
                                        <textarea
                                            className="form-input min-h-16"
                                            maxLength="2000"
                                            placeholder="Catatan tambahan..."
                                            value={initialPayment.notes}
                                            onChange={(event) =>
                                                setInitialPayment((current) => ({
                                                    ...current,
                                                    notes: event.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                </section>
                            )}

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
                                    {saving
                                        ? checkoutMode === 'pos'
                                            ? 'Memproses pembayaran...'
                                            : 'Menyimpan invoice...'
                                        : checkoutMode === 'pos'
                                          ? 'Bayar & Simpan Transaksi'
                                          : 'Simpan Invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {posReceipt && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl">
                        <div className="border-b border-slate-700 p-5 text-center">
                            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                                <Check size={24} />
                            </div>
                            <h3 className="mt-3 text-lg font-bold text-white">Pembayaran berhasil</h3>
                            <p className="mt-1 text-sm text-slate-400">
                                {posReceipt.payment.order?.order_number}
                            </p>
                        </div>
                        <div className="space-y-3 p-5">
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-slate-400">Metode pembayaran</span>
                                <span className="font-medium text-white">
                                    {paymentMethodLabels[posReceipt.payment.method] || posReceipt.payment.method}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-sm">
                                <span className="text-slate-400">Tagihan dibayar</span>
                                <span className="font-semibold text-white">{money(posReceipt.payment.amount)}</span>
                            </div>
                            {posReceipt.payment.method === 'cash' && (
                                <>
                                    <div className="flex justify-between gap-4 text-sm">
                                        <span className="text-slate-400">Uang diterima</span>
                                        <span className="font-semibold text-white">{money(posReceipt.tenderedAmount)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
                                        <span className="font-medium text-emerald-200">Kembalian</span>
                                        <span className="text-lg font-bold text-emerald-300">
                                            {money(Math.max(0, posReceipt.tenderedAmount - Number(posReceipt.payment.amount || 0)))}
                                        </span>
                                    </div>
                                </>
                            )}
                            {Number(posReceipt.payment.order?.balance || 0) > 0 && (
                                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                                    Sisa tagihan: {money(posReceipt.payment.order.balance)}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-700 p-5">
                            <button type="button" className="secondary-button" onClick={() => window.print()}>
                                <Printer size={16} /> Cetak Struk
                            </button>
                            <button type="button" className="primary-button" onClick={() => setPosReceipt(null)}>
                                Transaksi Baru
                            </button>
                        </div>
                    </div>
                    <PaymentReceiptPrintDocument payment={posReceipt.payment} />
                </div>
            )}

            {showSettlementForm && selectedOrder && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-700 p-5">
                            <div>
                                <h3 className="text-lg font-bold text-white">Pelunasan Pesanan</h3>
                                <p className="mt-1 text-sm text-slate-400">
                                    {selectedOrder.order_number} · sisa {money(selectedOrder.balance)}
                                </p>
                            </div>
                            <button type="button" className="text-slate-400 hover:text-white" onClick={() => setShowSettlementForm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form className="space-y-4 p-5" onSubmit={submitSettlement}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Nominal Pembayaran (Rp)">
                                    <input
                                        type="number"
                                        className="form-input"
                                        min="1"
                                        max={Number(selectedOrder.balance || 0)}
                                        step="1"
                                        required
                                        value={settlementForm.amount}
                                        onChange={(event) => setSettlementForm((current) => ({
                                            ...current,
                                            amount: event.target.value,
                                        }))}
                                    />
                                </Field>
                                <Field label="Metode Pembayaran">
                                    <select
                                        className="form-input"
                                        value={settlementForm.method}
                                        onChange={(event) => setSettlementForm((current) => ({
                                            ...current,
                                            method: event.target.value,
                                        }))}
                                    >
                                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </Field>
                                {settlementForm.method === 'cash' && (
                                    <>
                                        <Field label="Uang Diterima (Rp)">
                                            <input
                                                type="number"
                                                className="form-input"
                                                min={settlementAmount}
                                                step="1"
                                                required
                                                value={settlementForm.tendered_amount}
                                                onChange={(event) => setSettlementForm((current) => ({
                                                    ...current,
                                                    tendered_amount: event.target.value,
                                                }))}
                                            />
                                        </Field>
                                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 sm:self-end">
                                            <p className="text-xs text-emerald-300">Kembalian</p>
                                            <p className="mt-1 text-lg font-bold text-emerald-300">{money(settlementCashChange)}</p>
                                        </div>
                                    </>
                                )}
                                <Field label="Nomor Referensi (Opsional)">
                                    <input
                                        className="form-input"
                                        maxLength="100"
                                        placeholder="Referensi transfer/QRIS"
                                        value={settlementForm.reference_number}
                                        onChange={(event) => setSettlementForm((current) => ({
                                            ...current,
                                            reference_number: event.target.value,
                                        }))}
                                    />
                                </Field>
                            </div>
                            <Field label="Catatan Pembayaran (Opsional)">
                                <textarea
                                    className="form-input min-h-16"
                                    maxLength="2000"
                                    value={settlementForm.notes}
                                    onChange={(event) => setSettlementForm((current) => ({
                                        ...current,
                                        notes: event.target.value,
                                    }))}
                                />
                            </Field>
                            {settlementError && (
                                <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
                                    <AlertCircle size={16} /> {settlementError}
                                </p>
                            )}
                            <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
                                <button type="button" className="secondary-button" onClick={() => setShowSettlementForm(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="primary-button" disabled={settlementSaving}>
                                    <Wallet size={16} /> {settlementSaving ? 'Memproses...' : settlementAmount === Number(selectedOrder.balance || 0) ? 'Lunasi & Cetak Struk' : 'Simpan Cicilan'}
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
                                    {selectedOrder.customer?.name || selectedOrder.shipment?.recipient_name || 'Pelanggan Umum'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Tanggal Pesanan</p>
                                <p className="text-white mt-1">{dateFormat(selectedOrder.created_at)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Jenis Transaksi</p>
                                <p className="text-white mt-1">
                                    {selectedOrder.sales_channel !== 'pos'
                                        ? channelLabels[selectedOrder.sales_channel] || 'Marketplace'
                                        : selectedOrder.order_type === 'pos'
                                          ? 'Transaksi POS'
                                          : 'Invoice'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Status Pesanan</p>
                                <div className="mt-1"><StatusBadge status={selectedOrder.status} /></div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Status Pembayaran</p>
                                <div className="mt-1"><StatusBadge status={selectedOrder.payment_status} /></div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Persetujuan Penawaran</p>
                                <span
                                    className={`status-badge ${
                                        selectedOrder.quote_status === 'approved'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : selectedOrder.quote_status === 'rejected'
                                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}
                                >
                                    {selectedOrder.quote_status === 'approved'
                                        ? 'Disetujui'
                                        : selectedOrder.quote_status === 'rejected'
                                          ? 'Ditolak'
                                          : selectedOrder.sales_channel !== 'pos'
                                            ? 'Perlu tinjauan staf'
                                            : 'Menunggu jawaban'}
                                </span>
                            </div>
                        </div>

                        {selectedOrder.sales_channel !== 'pos' && (
                            <section className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="grid gap-3 text-sm sm:grid-cols-3">
                                    <div>
                                        <p className="text-xs text-slate-500">Kanal marketplace</p>
                                        <p className="mt-1 font-semibold text-white">
                                            {channelLabels[selectedOrder.sales_channel] || selectedOrder.sales_channel}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">ID pesanan eksternal</p>
                                        <p className="mt-1 text-white">{selectedOrder.external_order_id || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Tanggal pesanan marketplace</p>
                                        <p className="mt-1 text-white">{dateFormat(selectedOrder.external_order_date)}</p>
                                    </div>
                                    <div className="sm:col-span-3">
                                        <p className="text-xs text-slate-500">Status pembayaran marketplace</p>
                                        <p className="mt-1 text-white">
                                            {selectedOrder.channel_payment_status === 'paid' ? 'Dibayar oleh pembeli' : 'Belum dibayar oleh pembeli'}
                                            {' · '}belum dicatat sebagai uang diterima/settlement.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {selectedOrder.sales_channel !== 'pos' && selectedOrder.quote_status === 'pending' && (
                            <section className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            Tinjauan pesanan marketplace
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Periksa produk, harga, dan alamat. Work order baru dibuat setelah konfirmasi ini.
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className="primary-button"
                                            onClick={confirmMarketplaceOrder}
                                            disabled={marketplaceConfirming}
                                        >
                                            <Check size={15} />
                                            {marketplaceConfirming ? 'Mengonfirmasi...' : 'Konfirmasi & teruskan'}
                                        </button>
                                    )}
                                </div>
                                {marketplaceConfirmError && (
                                    <p role="alert" className="mt-3 text-sm text-red-400">
                                        {marketplaceConfirmError}
                                    </p>
                                )}
                            </section>
                        )}

                        {selectedOrder.sales_channel === 'pos' && selectedOrder.quote_status === 'pending' && canEdit && (
                            <section className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            Tautan persetujuan pelanggan
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Produksi menunggu persetujuan. DP tetap dapat diterima.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={createApprovalLink}
                                        disabled={approvalLinkLoading}
                                    >
                                        <Link2 size={15} />
                                        {approvalLinkLoading
                                            ? 'Membuat tautan...'
                                            : selectedOrder.approval_url
                                              ? 'Buat tautan baru'
                                              : 'Buat tautan persetujuan'}
                                    </button>
                                </div>
                                {selectedOrder.approval_url && (
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                        <input
                                            className="form-input min-w-0 flex-1"
                                            value={selectedOrder.approval_url}
                                            readOnly
                                            aria-label="Tautan persetujuan pelanggan"
                                        />
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={copyApprovalLink}
                                        >
                                            <Copy size={15} />
                                            Salin tautan
                                        </button>
                                    </div>
                                )}
                                {approvalLinkError && (
                                    <p role="alert" className="mt-2 text-sm text-red-400">
                                        {approvalLinkError}
                                    </p>
                                )}
                            </section>
                        )}

                        {canEdit && !['cancelled', 'ready_for_confirmation', 'completed'].includes(selectedOrder.status) && (
                            <section className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            File gambar atau referensi pelanggan
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Bagikan tautan aman yang berlaku 30 hari. Tautan baru akan menonaktifkan tautan sebelumnya.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={createCustomerUploadLink}
                                        disabled={customerUploadLinkLoading}
                                    >
                                        <Link2 size={15} />
                                        {customerUploadLinkLoading
                                            ? 'Membuat tautan...'
                                            : selectedOrder.customer_upload_url || hasActiveCustomerUploadLink
                                              ? 'Buat tautan baru'
                                              : 'Buat tautan unggah'}
                                    </button>
                                </div>
                                {selectedOrder.customer_upload_url && (
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                        <input
                                            className="form-input min-w-0 flex-1"
                                            value={selectedOrder.customer_upload_url}
                                            readOnly
                                            aria-label="Tautan unggah file pelanggan"
                                        />
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={copyCustomerUploadLink}
                                        >
                                            <Copy size={15} />
                                            Salin tautan
                                        </button>
                                    </div>
                                )}
                                {customerUploadLinkError && (
                                    <p role="alert" className="mt-2 text-sm text-red-400">
                                        {customerUploadLinkError}
                                    </p>
                                )}
                            </section>
                        )}

                        <CustomerReferenceFiles
                            orderId={selectedOrder.id}
                            files={selectedOrder.customer_files || []}
                        />

                        {selectedOrder.status === 'ready_for_confirmation' && canEdit && (
                            <section className="mb-5 mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            Produksi telah menyelesaikan seluruh item
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Periksa pesanan, lalu konfirmasi agar status selesai tercatat. Setelah itu, admin dapat membuka WhatsApp dengan pesan siap kirim.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={confirmCompletion}
                                        disabled={completionConfirming}
                                    >
                                        <Check size={15} />
                                        {completionConfirming ? 'Mengonfirmasi...' : 'Konfirmasi selesai'}
                                    </button>
                                </div>
                                {completionConfirmError && (
                                    <p role="alert" className="mt-3 text-sm text-red-400">
                                        {completionConfirmError}
                                    </p>
                                )}
                            </section>
                        )}

                        {selectedOrder.status === 'completed' && canEdit && (
                            <section className="mb-5 mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                {completionWhatsAppUrl(selectedOrder) ? (
                                    <>
                                        <a
                                            href={completionWhatsAppUrl(selectedOrder)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="secondary-button inline-flex"
                                        >
                                            <MessageCircle size={16} />
                                            Buka WhatsApp
                                        </a>
                                        <p className="mt-2 text-xs text-slate-400">
                                            Pesan sudah disiapkan; admin tetap perlu menekan tombol Kirim di WhatsApp.
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-amber-300">
                                        Nomor WhatsApp pelanggan belum tersedia. Lengkapi nomor telepon pelanggan atau penerima untuk mengirim kabar selesai.
                                    </p>
                                )}
                            </section>
                        )}

                        {selectedOrder.status === 'completed' &&
                            selectedOrder.payment_status === 'partial' &&
                            canCreatePayment && (
                            <section className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Pelunasan pesanan</p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Pesanan ini masih memiliki sisa tagihan {money(selectedOrder.balance)}.
                                        </p>
                                    </div>
                                    <button type="button" className="primary-button" onClick={openSettlementForm}>
                                        <Wallet size={16} /> Terima Pelunasan
                                    </button>
                                </div>
                            </section>
                        )}

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
                                                {item.finishings?.length > 0 && (
                                                    <p className="text-xs text-slate-400">
                                                        Finishing: {item.finishings.map((finishing) => finishing.finishing_name).join(', ')}
                                                    </p>
                                                )}
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

                        {selectedOrder.payments?.length > 0 && (
                            <section className="mt-5 rounded-xl border border-slate-700 p-4">
                                <h4 className="mb-3 font-semibold text-white">
                                    Riwayat Pembayaran
                                </h4>
                                <div className="space-y-2">
                                    {selectedOrder.payments.map((payment) => (
                                        <div
                                            key={payment.id}
                                            className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2 text-sm"
                                        >
                                            <div>
                                                <p className="text-slate-200">
                                                    {paymentTypeLabels[payment.payment_type] ||
                                                        'Pembayaran'}
                                                    {' · '}
                                                    {paymentMethodLabels[payment.method] ||
                                                        payment.method}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {payment.payment_number} ·{' '}
                                                    {dateFormat(payment.paid_at)}
                                                </p>
                                            </div>
                                            <span className="font-semibold text-emerald-400">
                                                {money(payment.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {selectedOrder.notes && (
                            <p className="text-sm text-slate-400 mt-5">Catatan: {selectedOrder.notes}</p>
                        )}

                        <ShipmentPanel
                            order={selectedOrder}
                            canEdit={canEdit}
                            onUpdated={setSelectedOrder}
                        />

                        <div className="flex flex-wrap justify-between gap-3 mt-6">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => window.print()}
                            >
                                <Printer size={16} />
                                {selectedOrder.quote_status === 'approved'
                                    ? 'Cetak Invoice'
                                    : 'Cetak Penawaran'}
                            </button>
                            <button type="button" className="secondary-button" onClick={() => setSelectedOrder(null)}>
                                Tutup
                            </button>
                        </div>
                        <InvoicePrintDocument
                            order={selectedOrder}
                            documentType={
                                selectedOrder.quote_status === 'approved'
                                    ? 'INVOICE'
                                    : 'PENAWARAN HARGA'
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
