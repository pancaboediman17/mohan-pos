import { useEffect, useState } from "react";
import {
    AlertCircle,
    ArrowDownToLine,
    ArrowUpFromLine,
    CheckCircle2,
    ClipboardList,
    PackagePlus,
    RefreshCw,
    TriangleAlert,
} from "lucide-react";
import api from "../services/api";

const initialMaterial = {
    sku: "",
    name: "",
    unit_id: "",
    minimum_stock: "0",
    unit_cost: "0",
    is_active: true,
};

const initialMovement = {
    material_id: "",
    movement_type: "receipt",
    quantity: "",
    unit_cost: "",
    notes: "",
};

const currency = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const formatNumber = (value) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(
        Number(value || 0),
    );

const getError = (error, fallback) => {
    const errors = error.response?.data?.errors;
    return errors
        ? Object.values(errors).flat().join(" ")
        : error.response?.data?.message || fallback;
};

export default function InventoryManagement({ canManage = false }) {
    const [branches, setBranches] = useState([]);
    const [units, setUnits] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [movements, setMovements] = useState([]);
    const [summary, setSummary] = useState({});
    const [branchId, setBranchId] = useState("");
    const [materialForm, setMaterialForm] = useState(initialMaterial);
    const [movementForm, setMovementForm] = useState(initialMovement);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [showMaterialForm, setShowMaterialForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const load = async (targetBranch = branchId) => {
        setLoading(true);
        setError("");
        try {
            const [branchResponse, unitResponse] = await Promise.all([
                api.get("/api/v1/inventory/branches"),
                api.get("/api/v1/inventory/units"),
            ]);
            const availableBranches = branchResponse.data.data || [];
            setBranches(availableBranches);
            setUnits(unitResponse.data.data || []);

            const selected =
                targetBranch ||
                String(
                    availableBranches.find((branch) => branch.is_production_hub)?.id ||
                        availableBranches[0]?.id ||
                        "",
                );
            if (selected !== branchId) setBranchId(selected);

            const params = selected ? { branch_id: selected } : {};
            const [materialResponse, movementResponse] = await Promise.all([
                api.get("/api/v1/inventory/materials", {
                    params: { ...params, per_page: 100 },
                }),
                api.get("/api/v1/inventory/movements", {
                    params: { ...params, per_page: 10 },
                }),
            ]);
            setMaterials(materialResponse.data.data || []);
            setSummary(materialResponse.data.summary || {});
            setMovements(movementResponse.data.data || []);
        } catch (requestError) {
            setError(getError(requestError, "Gagal memuat data inventori."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load("");
    }, []);

    const saveMaterial = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const payload = {
                ...materialForm,
                unit_id: Number(materialForm.unit_id),
                minimum_stock: Number(materialForm.minimum_stock || 0),
                unit_cost: Number(materialForm.unit_cost || 0),
            };
            if (editingMaterial) {
                await api.patch(
                    `/api/v1/inventory/materials/${editingMaterial.id}`,
                    payload,
                );
            } else {
                await api.post("/api/v1/inventory/materials", payload);
            }
            setMaterialForm(initialMaterial);
            setEditingMaterial(null);
            setShowMaterialForm(false);
            setSuccess("Data bahan berhasil disimpan.");
            await load(branchId);
        } catch (requestError) {
            setError(getError(requestError, "Gagal menyimpan data bahan."));
        } finally {
            setSaving(false);
        }
    };

    const recordMovement = async (event) => {
        event.preventDefault();
        if (!branchId) {
            setError("Pilih cabang sebelum mencatat mutasi stok.");
            return;
        }
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            await api.post("/api/v1/inventory/movements", {
                ...movementForm,
                branch_id: Number(branchId),
                material_id: Number(movementForm.material_id),
                quantity: Number(movementForm.quantity),
                unit_cost: movementForm.unit_cost
                    ? Number(movementForm.unit_cost)
                    : null,
            });
            setMovementForm(initialMovement);
            setSuccess("Mutasi stok berhasil dicatat.");
            await load(branchId);
        } catch (requestError) {
            setError(getError(requestError, "Gagal mencatat mutasi stok."));
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (material) => {
        setEditingMaterial(material);
        setMaterialForm({
            sku: material.sku,
            name: material.name,
            unit_id: String(material.unit_id),
            minimum_stock: String(material.minimum_stock),
            unit_cost: String(material.unit_cost),
            is_active: material.is_active,
        });
        setShowMaterialForm(true);
    };

    const openMovement = (material, movementType) => {
        setMovementForm({
            ...initialMovement,
            material_id: String(material.id),
            movement_type: movementType,
        });
    };

    const cancelMaterialForm = () => {
        setShowMaterialForm(false);
        setEditingMaterial(null);
        setMaterialForm(initialMaterial);
    };

    const lowStock = materials.filter((material) => material.is_low_stock).length;

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">Inventori Bahan</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Stok dihitung dari ledger penerimaan, penyesuaian, dan pemakaian Work Order.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select
                        className="form-input min-w-48"
                        value={branchId}
                        onChange={(event) => {
                            setBranchId(event.target.value);
                            load(event.target.value);
                        }}
                        aria-label="Pilih cabang inventori"
                    >
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                                {branch.is_production_hub ? " · Pusat produksi" : ""}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => load(branchId)}
                        disabled={loading}
                    >
                        <RefreshCw size={15} />
                        Muat ulang
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                                cancelMaterialForm();
                                setShowMaterialForm(true);
                            }}
                        >
                            <PackagePlus size={16} />
                            Bahan baru
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div role="alert" className="flex gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertCircle size={17} className="shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div role="status" className="flex gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    <CheckCircle2 size={17} className="shrink-0" />
                    {success}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Bahan aktif</p>
                            <p className="mt-2 text-2xl font-bold text-white">
                                {summary.total_materials || 0}
                            </p>
                        </div>
                        <div className="stat-icon"><ClipboardList size={20} /></div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Di bawah minimum</p>
                            <p className="mt-2 text-2xl font-bold text-white">
                                {summary.low_stock ?? lowStock}
                            </p>
                        </div>
                        <div className="stat-icon text-amber-400"><TriangleAlert size={20} /></div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Estimasi nilai stok</p>
                            <p className="mt-2 text-2xl font-bold text-white">
                                {currency(summary.estimated_value)}
                            </p>
                        </div>
                        <div className="stat-icon"><ArrowDownToLine size={20} /></div>
                    </div>
                </div>
            </div>

            {showMaterialForm && canManage && (
                <form className="panel space-y-4" onSubmit={saveMaterial}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="panel-title">
                                {editingMaterial ? "Ubah data bahan" : "Tambah bahan"}
                            </h3>
                            <p className="panel-subtitle mt-1">
                                Saldo awal dicatat terpisah sebagai penerimaan atau penyesuaian stok.
                            </p>
                        </div>
                        <button type="button" className="secondary-button" onClick={cancelMaterialForm}>
                            Batal
                        </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="form-field">
                            <span>Kode bahan</span>
                            <input className="form-input" required maxLength={40} value={materialForm.sku} onChange={(event) => setMaterialForm({ ...materialForm, sku: event.target.value })} />
                        </label>
                        <label className="form-field">
                            <span>Nama bahan</span>
                            <input className="form-input" required maxLength={150} value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} />
                        </label>
                        <label className="form-field">
                            <span>Satuan</span>
                            <select className="form-input" required value={materialForm.unit_id} onChange={(event) => setMaterialForm({ ...materialForm, unit_id: event.target.value })}>
                                <option value="">Pilih satuan</option>
                                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}
                            </select>
                        </label>
                        <label className="form-field">
                            <span>Stok minimum</span>
                            <input className="form-input" type="number" min="0" step="0.001" value={materialForm.minimum_stock} onChange={(event) => setMaterialForm({ ...materialForm, minimum_stock: event.target.value })} />
                        </label>
                        <label className="form-field">
                            <span>Harga pokok / satuan</span>
                            <input className="form-input" type="number" min="0" step="0.01" value={materialForm.unit_cost} onChange={(event) => setMaterialForm({ ...materialForm, unit_cost: event.target.value })} />
                        </label>
                        {editingMaterial && (
                            <label className="flex items-center gap-2 text-sm text-slate-300">
                                <input type="checkbox" checked={materialForm.is_active} onChange={(event) => setMaterialForm({ ...materialForm, is_active: event.target.checked })} />
                                Bahan aktif
                            </label>
                        )}
                    </div>
                    <button type="submit" className="primary-button" disabled={saving}>
                        {saving ? "Menyimpan..." : "Simpan bahan"}
                    </button>
                </form>
            )}

            {movementForm.material_id && canManage && (
                <form className="panel space-y-4" onSubmit={recordMovement}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="panel-title">
                                {movementForm.movement_type === "receipt" ? "Penerimaan stok" : "Penyesuaian stok"}
                            </h3>
                            <p className="panel-subtitle mt-1">
                                {materials.find((material) => String(material.id) === movementForm.material_id)?.name}
                                {" · "}
                                Penyesuaian berkurang ditulis dengan jumlah negatif.
                            </p>
                        </div>
                        <button type="button" className="secondary-button" onClick={() => setMovementForm(initialMovement)}>
                            Batal
                        </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="form-field">
                            <span>Jenis mutasi</span>
                            <select className="form-input" value={movementForm.movement_type} onChange={(event) => setMovementForm({ ...movementForm, movement_type: event.target.value })}>
                                <option value="receipt">Penerimaan</option>
                                <option value="adjustment">Penyesuaian</option>
                            </select>
                        </label>
                        <label className="form-field">
                            <span>Jumlah {movementForm.movement_type === "adjustment" ? "(+ / -)" : ""}</span>
                            <input className="form-input" type="number" step="0.001" min={movementForm.movement_type === "receipt" ? "0.001" : undefined} required value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} />
                        </label>
                        <label className="form-field">
                            <span>Harga pokok satuan</span>
                            <input className="form-input" type="number" min="0" step="0.01" value={movementForm.unit_cost} onChange={(event) => setMovementForm({ ...movementForm, unit_cost: event.target.value })} />
                        </label>
                        <label className="form-field">
                            <span>Catatan</span>
                            <input className="form-input" maxLength={1000} value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} />
                        </label>
                    </div>
                    <button type="submit" className="primary-button" disabled={saving}>
                        Simpan mutasi
                    </button>
                </form>
            )}

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Saldo bahan</h3>
                        <p className="panel-subtitle">
                            {branches.find((branch) => String(branch.id) === String(branchId))?.name || "Semua cabang"}
                        </p>
                    </div>
                </div>
                {loading ? (
                    <p role="status" className="py-8 text-center text-sm text-slate-400">Memuat saldo stok...</p>
                ) : materials.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">Belum ada bahan. Tambahkan bahan terlebih dahulu.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Kode / bahan</th>
                                    <th>Satuan</th>
                                    <th>Stok</th>
                                    <th>Minimum</th>
                                    <th>Status</th>
                                    {canManage && <th>Aksi</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {materials.map((material) => (
                                    <tr key={material.id}>
                                        <td>
                                            <span className="font-medium text-white">{material.name}</span>
                                            <span className="block text-xs text-slate-500">{material.sku}</span>
                                        </td>
                                        <td>{material.unit?.symbol || material.unit?.name}</td>
                                        <td className="font-semibold text-white">{formatNumber(material.on_hand)}</td>
                                        <td>{formatNumber(material.minimum_stock)}</td>
                                        <td>
                                            <span className={`status-badge ${material.is_low_stock ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>
                                                {material.is_low_stock ? "Stok rendah" : "Aman"}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td>
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" className="secondary-button" onClick={() => openMovement(material, "receipt")}>
                                                        <ArrowDownToLine size={14} /> Terima
                                                    </button>
                                                    <button type="button" className="secondary-button" onClick={() => openMovement(material, "adjustment")}>
                                                        <ArrowUpFromLine size={14} /> Opname
                                                    </button>
                                                    <button type="button" className="secondary-button" onClick={() => startEdit(material)}>
                                                        Ubah
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Mutasi terbaru</h3>
                        <p className="panel-subtitle">Riwayat stok cabang terpilih</p>
                    </div>
                </div>
                {movements.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">Belum ada mutasi stok.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th>Jumlah</th><th>Work Order / catatan</th><th>Petugas</th></tr>
                            </thead>
                            <tbody>
                                {movements.map((movement) => (
                                    <tr key={movement.id}>
                                        <td>{new Date(movement.created_at).toLocaleString("id-ID")}</td>
                                        <td>{movement.material?.name}</td>
                                        <td>{movement.movement_type === "receipt" ? "Penerimaan" : movement.movement_type === "consumption" ? "Pemakaian" : "Penyesuaian"}</td>
                                        <td className={Number(movement.quantity) < 0 ? "text-amber-300" : "text-emerald-300"}>
                                            {formatNumber(movement.quantity)} {movement.material?.unit?.symbol}
                                        </td>
                                        <td>{movement.work_order?.order?.order_number || movement.notes || "-"}</td>
                                        <td>{movement.creator?.name || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
