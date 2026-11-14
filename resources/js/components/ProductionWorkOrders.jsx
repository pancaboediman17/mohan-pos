import { useEffect, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ClipboardCheck,
    Clock3,
    Factory,
    FileImage,
    RefreshCw,
    Upload,
} from "lucide-react";
import api from "../services/api";

const stages = {
    waiting_design: "Menunggu desain",
    design_approval: "Menunggu persetujuan desain",
    design_revision: "Perlu revisi desain",
    queued: "Antrean cetak",
    printing: "Sedang dicetak",
    finishing: "Finishing",
    quality_check: "Pemeriksaan QC",
    ready: "Siap diambil",
    completed: "Selesai",
};

const nextStage = {
    queued: ["printing", "Mulai cetak"],
    printing: ["finishing", "Lanjut finishing"],
    finishing: ["quality_check", "Kirim ke QC"],
    quality_check: ["ready", "Lulus QC"],
    ready: ["completed", "Tandai selesai"],
};

const badgeStyle = (status) => {
    if (["completed", "ready"].includes(status))
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    if (["design_revision", "quality_check"].includes(status))
        return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    if (["printing", "finishing"].includes(status))
        return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    return "border-slate-700 bg-slate-800/70 text-slate-300";
};

const errorMessage = (error, fallback) => {
    const errors = error.response?.data?.errors;
    return errors
        ? Object.values(errors).flat().join(" ")
        : error.response?.data?.message || fallback;
};

export default function ProductionWorkOrders({
    canManageProduction = false,
    canManageDesigns = false,
    canConsumeInventory = false,
}) {
    const [workOrders, setWorkOrders] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [counts, setCounts] = useState({ queued: 0, running: 0, qc: 0 });
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busyOrder, setBusyOrder] = useState(null);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [approvalLinks, setApprovalLinks] = useState({});
    const [consumptionForms, setConsumptionForms] = useState({});

    const load = async (targetPage = page) => {
        setLoading(true);
        setError("");
        try {
            const requests = [
                api.get("/api/v1/work-orders", {
                    params: { page: targetPage, per_page: 30 },
                }),
                api.get("/api/v1/production-machines"),
            ];
            if (canConsumeInventory) {
                requests.push(
                    api.get("/api/v1/inventory/materials", {
                        params: { per_page: 100 },
                    }),
                );
            }
            const [ordersResponse, machinesResponse, materialResponse] =
                await Promise.all(requests);
            const payload = ordersResponse.data;
            setWorkOrders(payload.data || []);
            const summary = payload.summary || {};
            setCounts({
                queued:
                    Number(summary.waiting_design || 0) +
                    Number(summary.design_approval || 0) +
                    Number(summary.design_revision || 0) +
                    Number(summary.queued || 0),
                running:
                    Number(summary.printing || 0) +
                    Number(summary.finishing || 0),
                qc: Number(summary.quality_check || 0),
            });
            setPagination({
                currentPage: payload.current_page,
                lastPage: payload.last_page,
                total: payload.total,
            });
            setMachines(
                (machinesResponse.data.data || []).filter(
                    (machine) => machine.is_active,
                ),
            );
            setMaterials(materialResponse?.data.data || []);
            setPage(payload.current_page || 1);
        } catch (requestError) {
            setError(
                errorMessage(requestError, "Gagal memuat Work Order."),
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, []);

    const updateWorkOrder = async (workOrder, payload) => {
        setBusyOrder(workOrder.id);
        setError("");
        setSuccess("");
        try {
            await api.patch(`/api/v1/work-orders/${workOrder.id}`, payload);
            await load(page);
            setSuccess("Work Order berhasil diperbarui.");
        } catch (requestError) {
            setError(
                errorMessage(requestError, "Gagal memperbarui Work Order."),
            );
        } finally {
            setBusyOrder(null);
        }
    };

    const uploadDesign = async (workOrder, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append("design_file", file);
        setBusyOrder(workOrder.id);
        setError("");
        setSuccess("");

        try {
            const response = await api.post(
                `/api/v1/order-items/${workOrder.item.id}/designs`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } },
            );
            setApprovalLinks((current) => ({
                ...current,
                [workOrder.item.id]: response.data.approval_url,
            }));
            await load(page);
            setSuccess("Desain diunggah. Bagikan tautan untuk meminta persetujuan pelanggan.");
        } catch (requestError) {
            setError(errorMessage(requestError, "Gagal mengunggah desain."));
        } finally {
            setBusyOrder(null);
        }
    };

    const createDesignLink = async (workOrder) => {
        setBusyOrder(workOrder.id);
        setError("");
        try {
            const response = await api.post(
                `/api/v1/order-items/${workOrder.item.id}/design-link`,
            );
            setApprovalLinks((current) => ({
                ...current,
                [workOrder.item.id]: response.data.approval_url,
            }));
        } catch (requestError) {
            setError(
                errorMessage(requestError, "Gagal membuat tautan desain."),
            );
        } finally {
            setBusyOrder(null);
        }
    };

    const copyLink = async (orderItemId) => {
        try {
            await navigator.clipboard.writeText(
                approvalLinks[orderItemId],
            );
            setSuccess("Tautan persetujuan disalin.");
        } catch {
            setError("Tautan tidak dapat disalin. Salin alamat yang ditampilkan secara manual.");
        }
    };

    const consumeMaterial = async (workOrder) => {
        const form = consumptionForms[workOrder.id] || {};
        if (!form.material_id || !form.quantity) {
            setError("Pilih bahan dan jumlah yang digunakan.");
            return;
        }
        setBusyOrder(workOrder.id);
        setError("");
        setSuccess("");
        try {
            await api.post(`/api/v1/work-orders/${workOrder.id}/materials`, {
                material_id: Number(form.material_id),
                quantity: Number(form.quantity),
            });
            setConsumptionForms((current) => ({
                ...current,
                [workOrder.id]: { material_id: "", quantity: "" },
            }));
            await load(page);
            setSuccess("Pemakaian bahan dicatat pada Work Order.");
        } catch (requestError) {
            setError(
                errorMessage(requestError, "Gagal mencatat pemakaian bahan."),
            );
        } finally {
            setBusyOrder(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Work Order Produksi
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Satu Work Order untuk setiap item pesanan, dari persetujuan desain hingga selesai.
                    </p>
                </div>
                <button
                    type="button"
                    className="secondary-button"
                    onClick={() => load(page)}
                    disabled={loading}
                >
                    <RefreshCw size={15} />
                    Muat ulang
                </button>
            </div>

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                    {success}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    [Factory, "Antrean desain / cetak", counts.queued],
                    [Clock3, "Sedang dikerjakan", counts.running],
                    [ClipboardCheck, "Menunggu pemeriksaan QC", counts.qc],
                ].map(([Icon, label, value]) => (
                    <div className="stat-card" key={label}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-slate-400">{label}</p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                    {value}
                                </p>
                            </div>
                            <div className="stat-icon">
                                <Icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div role="status" className="panel py-10 text-center text-sm text-slate-400">
                    Memuat Work Order...
                </div>
            ) : workOrders.length === 0 ? (
                <div className="panel py-12 text-center">
                    <Factory className="mx-auto text-slate-500" size={32} />
                    <p className="mt-3 font-semibold text-white">
                        Belum ada Work Order
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                        Work Order akan dibuat otomatis saat pelanggan menyetujui penawaran.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {workOrders.map((workOrder) => {
                        const item = workOrder.item;
                        const design = item?.latest_design;
                        const stage = nextStage[workOrder.status];
                        const link = approvalLinks[item?.id];
                        const canUpload =
                            canManageDesigns &&
                            ["waiting_design", "design_approval", "design_revision"].includes(
                                workOrder.status,
                            );

                        return (
                            <article className="panel" key={workOrder.id}>
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-white">
                                                {workOrder.order?.order_number}
                                            </span>
                                            <span className={`status-badge ${badgeStyle(workOrder.status)}`}>
                                                {stages[workOrder.status] || workOrder.status}
                                            </span>
                                            {workOrder.order?.due_date && (
                                                <span className="text-xs text-slate-500">
                                                    Target {new Date(workOrder.order.due_date).toLocaleDateString("id-ID")}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="mt-3 text-lg font-semibold text-white">
                                            {item?.product_name}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-400">
                                            {workOrder.order?.customer?.name || "Pelanggan Umum"}
                                            {" · "}
                                            {Number(item?.quantity || 0)} {item?.unit_name || ""}
                                            {item?.width && item?.height
                                                ? ` · ${item.width} × ${item.height}`
                                                : ""}
                                        </p>
                                        {(item?.specifications || item?.notes) && (
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                                                {[item.specifications, item.notes].filter(Boolean).join(" · ")}
                                            </p>
                                        )}
                                        <p className="mt-2 text-xs text-slate-500">
                                            Lokasi produksi: {workOrder.production_branch?.name || "Belum ditentukan"}
                                            {workOrder.machine
                                                ? ` · Mesin: ${workOrder.machine.name}`
                                                : ""}
                                        </p>

                                        {design && (
                                            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                                <FileImage size={17} className="text-slate-400" />
                                                <span className="text-sm text-slate-300">
                                                    Desain v{design.version}: {design.original_filename}
                                                </span>
                                                <span className={`status-badge ${badgeStyle(
                                                    design.status === "approved"
                                                        ? "completed"
                                                        : design.status === "revision_requested"
                                                          ? "design_revision"
                                                          : "design_approval",
                                                )}`}>
                                                    {design.status === "approved"
                                                        ? "Disetujui pelanggan"
                                                        : design.status === "revision_requested"
                                                          ? "Diminta revisi"
                                                          : design.status === "superseded"
                                                            ? "Digantikan versi baru"
                                                            : "Menunggu persetujuan"}
                                                </span>
                                                {design.customer_note && (
                                                    <p className="w-full text-sm text-amber-300">
                                                        Catatan pelanggan: {design.customer_note}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3 lg:w-72">
                                        {canUpload && (
                                            <label className="secondary-button cursor-pointer justify-center">
                                                <Upload size={15} />
                                                {busyOrder === workOrder.id
                                                    ? "Mengunggah..."
                                                    : "Unggah desain"}
                                                <input
                                                    type="file"
                                                    className="sr-only"
                                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                    disabled={busyOrder === workOrder.id}
                                                    onChange={(event) => {
                                                        uploadDesign(
                                                            workOrder,
                                                            event.target.files?.[0],
                                                        );
                                                        event.target.value = "";
                                                    }}
                                                />
                                            </label>
                                        )}

                                        {canManageDesigns &&
                                            workOrder.status === "design_approval" &&
                                            !link && (
                                                <button
                                                    type="button"
                                                    className="secondary-button justify-center"
                                                    disabled={busyOrder === workOrder.id}
                                                    onClick={() => createDesignLink(workOrder)}
                                                >
                                                    Buat tautan persetujuan
                                                </button>
                                            )}
                                        {link && (
                                            <div className="space-y-2">
                                                <input
                                                    className="form-input text-xs"
                                                    readOnly
                                                    value={link}
                                                    aria-label="Tautan persetujuan desain"
                                                />
                                                <button
                                                    type="button"
                                                    className="secondary-button w-full justify-center"
                                                    onClick={() => copyLink(item.id)}
                                                >
                                                    Salin tautan
                                                </button>
                                            </div>
                                        )}

                                        {canManageProduction && (
                                            <>
                                                <label className="form-field">
                                                    <span>Mesin produksi</span>
                                                    <select
                                                        className="form-input"
                                                        value={workOrder.production_machine_id || ""}
                                                        disabled={busyOrder === workOrder.id}
                                                        onChange={(event) =>
                                                            updateWorkOrder(workOrder, {
                                                                production_machine_id:
                                                                    event.target.value || null,
                                                            })
                                                        }
                                                    >
                                                        <option value="">Pilih mesin</option>
                                                        {machines
                                                            .filter(
                                                                (machine) =>
                                                                    !workOrder.production_branch_id ||
                                                                    machine.branch_id ===
                                                                        workOrder.production_branch_id,
                                                            )
                                                            .map((machine) => (
                                                                <option
                                                                    key={machine.id}
                                                                    value={machine.id}
                                                                >
                                                                    {machine.machine_code} · {machine.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </label>
                                                {stage && (
                                                    <button
                                                        type="button"
                                                        className="primary-button justify-center"
                                                        disabled={busyOrder === workOrder.id}
                                                        onClick={() =>
                                                            updateWorkOrder(workOrder, {
                                                                status: stage[0],
                                                            })
                                                        }
                                                    >
                                                        {stage[1]}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {canConsumeInventory &&
                                            ["printing", "finishing"].includes(
                                                workOrder.status,
                                            ) && (
                                                <div className="space-y-2 rounded-lg border border-slate-800 p-3">
                                                    <p className="text-sm font-medium text-slate-300">
                                                        Catat pemakaian bahan
                                                    </p>
                                                    <select
                                                        className="form-input"
                                                        value={
                                                            consumptionForms[
                                                                workOrder.id
                                                            ]?.material_id || ""
                                                        }
                                                        disabled={
                                                            busyOrder === workOrder.id
                                                        }
                                                        onChange={(event) =>
                                                            setConsumptionForms(
                                                                (current) => ({
                                                                    ...current,
                                                                    [workOrder.id]: {
                                                                        ...current[
                                                                            workOrder.id
                                                                        ],
                                                                        material_id:
                                                                            event.target.value,
                                                                    },
                                                                }),
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            Pilih bahan
                                                        </option>
                                                        {materials.map(
                                                            (material) => (
                                                                <option
                                                                    key={
                                                                        material.id
                                                                    }
                                                                    value={
                                                                        material.id
                                                                    }
                                                                >
                                                                    {material.name} (
                                                                    {material.unit
                                                                        ?.symbol ||
                                                                        material.unit
                                                                            ?.name}
                                                                    )
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <input
                                                        className="form-input"
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        placeholder="Jumlah digunakan"
                                                        value={
                                                            consumptionForms[
                                                                workOrder.id
                                                            ]?.quantity || ""
                                                        }
                                                        disabled={
                                                            busyOrder === workOrder.id
                                                        }
                                                        onChange={(event) =>
                                                            setConsumptionForms(
                                                                (current) => ({
                                                                    ...current,
                                                                    [workOrder.id]: {
                                                                        ...current[
                                                                            workOrder.id
                                                                        ],
                                                                        quantity:
                                                                            event.target.value,
                                                                    },
                                                                }),
                                                            )
                                                        }
                                                    />
                                                    <button
                                                        type="button"
                                                        className="secondary-button w-full justify-center"
                                                        disabled={
                                                            busyOrder === workOrder.id
                                                        }
                                                        onClick={() =>
                                                            consumeMaterial(
                                                                workOrder,
                                                            )
                                                        }
                                                    >
                                                        Simpan pemakaian
                                                    </button>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}

                    {pagination?.lastPage > 1 && (
                        <div className="flex items-center justify-between panel">
                            <p className="text-sm text-slate-400">
                                {pagination.total} Work Order
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={page <= 1}
                                    onClick={() => load(page - 1)}
                                >
                                    Sebelumnya
                                </button>
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={page >= pagination.lastPage}
                                    onClick={() => load(page + 1)}
                                >
                                    Berikutnya
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
