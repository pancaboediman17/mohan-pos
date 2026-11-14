import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    Download,
    FileSpreadsheet,
    FileText,
    Factory,
    Package,
    RefreshCw,
    Receipt,
    TrendingUp,
    Wallet,
} from "lucide-react";
import api from "../services/api";

const localDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

const number = (value) => new Intl.NumberFormat("id-ID").format(Number(value) || 0);

const statusLabels = {
    waiting_design: "Menunggu desain",
    queued: "Antrean",
    printing: "Cetak",
    finishing: "Finishing",
    quality_check: "Pemeriksaan QC",
    ready: "Siap diambil",
    completed: "Selesai",
};

const datasetLabels = {
    sales: "Penjualan",
    finance: "Keuangan",
    production: "Produksi",
    inventory: "Inventori",
};

const formatLabels = {
    csv: "CSV",
    xlsx: "Excel",
    pdf: "PDF",
};

function columnName(number) {
    let result = "";
    let value = number;

    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }

    return result;
}

function parseCsvReport(csv, Papa) {
    const parsed = Papa.parse(csv, {
        dynamicTyping: true,
        header: true,
        skipEmptyLines: true,
    });

    if (parsed.errors.length) {
        throw new Error("Data CSV laporan tidak dapat dibaca untuk ekspor.");
    }

    return {
        headers: parsed.meta.fields || [],
        rows: parsed.data,
    };
}

async function createExcelReport(csv, dataset, filters, branchName) {
    const [excelModule, papaModule] = await Promise.all([
        import("exceljs"),
        import("papaparse"),
    ]);
    const ExcelJS = excelModule.default || excelModule;
    const Papa = papaModule.default || papaModule;
    const { headers, rows } = parseCsvReport(csv, Papa);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MOHAN Digital Lab's";
    workbook.subject = `Laporan ${datasetLabels[dataset]}`;
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(datasetLabels[dataset]);
    worksheet.columns = headers.map((header, index) => ({
        key: `column_${index}`,
        width: Math.min(42, Math.max(14, header.length + 3)),
    }));
    worksheet.addRow([`Laporan ${datasetLabels[dataset]}`]);
    worksheet.addRow([`Periode: ${filters.from} s.d. ${filters.to}`]);
    worksheet.addRow([`Cabang: ${branchName || "Semua cabang"}`]);
    worksheet.addRow([]);
    const headerRow = worksheet.addRow(headers);
    rows.forEach((row) =>
        worksheet.addRow(headers.map((header) => row[header] ?? "")),
    );
    worksheet.views = [{ state: "frozen", ySplit: 5 }];
    worksheet.autoFilter = {
        from: "A5",
        to: `${columnName(headers.length)}${Math.max(5, rows.length + 5)}`,
    };
    worksheet.getRow(1).font = { bold: true, size: 16 };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE10613" },
    };
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = { vertical: "middle" };
            if (typeof cell.value === "number") {
                cell.numFmt = "#,##0.##;[Red]-#,##0.##";
            }
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}

async function createPdfReport(csv, dataset, filters, branchName) {
    const [pdfModule, tableModule, papaModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
        import("papaparse"),
    ]);
    const jsPDF =
        pdfModule.jsPDF ||
        pdfModule.default?.jsPDF ||
        pdfModule.default ||
        pdfModule;
    const autoTable = tableModule.default || tableModule;
    const Papa = papaModule.default || papaModule;
    const { headers, rows } = parseCsvReport(csv, Papa);
    const document = new jsPDF({
        orientation: headers.length > 6 ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
    });
    const pageWidth = document.internal.pageSize.getWidth();
    const margin = 12;

    document.setFontSize(15);
    document.text(`Laporan ${datasetLabels[dataset]}`, margin, 16);
    document.setFontSize(9);
    document.text(
        `Periode: ${filters.from} s.d. ${filters.to}  |  Cabang: ${branchName || "Semua cabang"}`,
        margin,
        23,
    );

    autoTable(document, {
        head: [headers],
        body: rows.map((row) =>
            headers.map((header) => String(row[header] ?? "")),
        ),
        startY: 29,
        margin: { left: margin, right: margin },
        styles: { fontSize: headers.length > 7 ? 6 : 8, cellPadding: 2 },
        headStyles: { fillColor: [225, 6, 19] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didDrawPage: () => {
            document.setFontSize(8);
            document.text(
                `MOHAN Digital Lab's · ${datasetLabels[dataset]}`,
                margin,
                document.internal.pageSize.getHeight() - 7,
            );
        },
    });

    const pageCount = document.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
        document.setPage(page);
        document.text(
            `Halaman ${page} dari ${pageCount}`,
            pageWidth - margin,
            document.internal.pageSize.getHeight() - 7,
            { align: "right" },
        );
    }

    return document.output("blob");
}

function Metric({ icon: Icon, label, value, detail }) {
    return (
        <div className="panel">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                    {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
                </div>
                <div className="stat-icon">
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
}

function Section({ title, subtitle, children, action }) {
    return (
        <section className="panel">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="panel-title">{title}</h3>
                    {subtitle && <p className="panel-subtitle mt-1">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function EmptyTable({ columns, message = "Belum ada data pada periode ini." }) {
    return (
        <tr>
            <td colSpan={columns} className="py-8 text-center text-sm text-slate-500">
                {message}
            </td>
        </tr>
    );
}

export default function ReportsDashboard() {
    const today = new Date();
    const [filters, setFilters] = useState({
        from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: localDate(today),
        branch_id: "",
    });
    const [appliedFilters, setAppliedFilters] = useState(filters);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState("");
    const [error, setError] = useState("");

    const loadReport = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/reports", {
                params: {
                    ...appliedFilters,
                    branch_id: appliedFilters.branch_id || undefined,
                },
            });
            setReport(response.data.data);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Laporan gagal dimuat. Periksa akses dan rentang tanggal.",
            );
        } finally {
            setLoading(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const exportReport = async (dataset, format) => {
        const exportKey = `${dataset}-${format}`;
        setExporting(exportKey);
        setError("");
        try {
            const response = await api.get("/api/v1/reports/export", {
                params: {
                    ...appliedFilters,
                    branch_id: appliedFilters.branch_id || undefined,
                    dataset,
                },
                responseType: "blob",
            });
            let file = response.data;
            if (format !== "csv") {
                const csv = await response.data.text();
                file =
                    format === "xlsx"
                        ? await createExcelReport(
                              csv,
                              dataset,
                              appliedFilters,
                              report?.filters?.branch_name,
                          )
                        : await createPdfReport(
                              csv,
                              dataset,
                              appliedFilters,
                              report?.filters?.branch_name,
                          );
            }

            const url = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = url;
            link.download = `mohan-digital-labs-${dataset}-${appliedFilters.from}-${appliedFilters.to}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    requestError.message ||
                    "Ekspor gagal diunduh. Silakan coba lagi.",
            );
        } finally {
            setExporting("");
        }
    };

    const summary = report?.summary;
    const downloadButton = (dataset, format) => (
        <button
            type="button"
            className="secondary-button !px-2 !py-1.5 !text-xs"
            onClick={() => exportReport(dataset, format)}
            disabled={Boolean(exporting) || loading}
            aria-label={`Ekspor ${datasetLabels[dataset]} ke ${formatLabels[format]}`}
        >
            {format === "xlsx" ? (
                <FileSpreadsheet size={14} />
            ) : format === "pdf" ? (
                <FileText size={14} />
            ) : (
                <Download size={14} />
            )}
            {exporting === `${dataset}-${format}`
                ? "Menyiapkan..."
                : formatLabels[format]}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">Laporan</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Pantau penjualan, pembayaran, produksi, dan pergerakan bahan dari data operasional.
                    </p>
                </div>
                <button
                    type="button"
                    className="secondary-button"
                    onClick={loadReport}
                    disabled={loading}
                >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    Muat Ulang
                </button>
            </div>

            <form
                className="panel grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    setAppliedFilters(filters);
                }}
            >
                <label className="form-field">
                    <span>Dari tanggal</span>
                    <input
                        type="date"
                        className="form-input"
                        value={filters.from}
                        max={filters.to}
                        onChange={(event) =>
                            setFilters((current) => ({ ...current, from: event.target.value }))
                        }
                    />
                </label>
                <label className="form-field">
                    <span>Sampai tanggal</span>
                    <input
                        type="date"
                        className="form-input"
                        value={filters.to}
                        min={filters.from}
                        onChange={(event) =>
                            setFilters((current) => ({ ...current, to: event.target.value }))
                        }
                    />
                </label>
                <label className="form-field">
                    <span>Cabang</span>
                    <select
                        className="form-input"
                        value={filters.branch_id}
                        onChange={(event) =>
                            setFilters((current) => ({ ...current, branch_id: event.target.value }))
                        }
                    >
                        <option value="">Semua cabang yang diizinkan</option>
                        {(report?.branches || []).map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                </label>
                <button type="submit" className="primary-button">
                    <TrendingUp size={16} />
                    Terapkan Filter
                </button>
                <p className="text-xs text-slate-500 sm:col-span-2 xl:col-span-4">
                    Filter cabang mengikuti konteks data: pesanan dan piutang memakai cabang pesanan, Work Order memakai cabang produksi, dan inventori memakai cabang stok.
                </p>
            </form>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {loading && !report ? (
                <div className="panel py-12 text-center text-sm text-slate-400">
                    Memuat laporan...
                </div>
            ) : report && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-400">
                            Periode {report.filters.from} s.d. {report.filters.to}
                            {" · "}{report.filters.branch_name}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(datasetLabels).map(([dataset, label]) => (
                            <div
                                key={dataset}
                                className="panel !p-3"
                            >
                                <p className="mb-3 text-sm font-semibold text-white">
                                    {label}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {["csv", "xlsx", "pdf"].map((format) =>
                                        downloadButton(dataset, format),
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric icon={Receipt} label="Pesanan disetujui" value={number(summary.order_count)} detail={`Nilai pesanan ${money(summary.order_value)}`} />
                        <Metric icon={Wallet} label="Pembayaran diterima" value={money(summary.payments_received)} detail={`Piutang terbuka saat ini ${money(summary.open_balance)}`} />
                        <Metric icon={TrendingUp} label="Rata-rata pesanan" value={money(summary.average_order_value)} detail="Dari pesanan disetujui dalam periode" />
                        <Metric icon={Factory} label="Work Order selesai" value={number(summary.work_orders_completed)} detail={`${number(summary.work_orders_created)} dibuat dalam periode`} />
                    </div>

                    <Section
                        title="Penjualan & pembayaran harian"
                        subtitle="Nilai pesanan dihitung dari tanggal pesanan; pembayaran dari tanggal transaksi pembayaran."
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead className="text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="pb-3 pr-4">Tanggal</th>
                                        <th className="pb-3 pr-4">Pesanan</th>
                                        <th className="pb-3 pr-4">Nilai pesanan</th>
                                        <th className="pb-3">Pembayaran diterima</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {report.daily.map((day) => (
                                        <tr key={day.date} className="text-slate-300">
                                            <td className="py-3 pr-4">{day.date}</td>
                                            <td className="py-3 pr-4">{number(day.order_count)}</td>
                                            <td className="py-3 pr-4">{money(day.order_value)}</td>
                                            <td className="py-3">{money(day.payments_received)}</td>
                                        </tr>
                                    ))}
                                    {!report.daily.length && <EmptyTable columns={4} />}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <Section title="Performa cabang" subtitle="Pesanan yang dibuat pada periode terpilih.">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[420px] text-left text-sm">
                                    <thead className="text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="pb-3 pr-4">Cabang</th>
                                            <th className="pb-3 pr-4">Pesanan</th>
                                            <th className="pb-3">Nilai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {report.branch_performance.map((branch) => (
                                            <tr key={branch.branch_id || branch.branch_name} className="text-slate-300">
                                                <td className="py-3 pr-4">{branch.branch_name}</td>
                                                <td className="py-3 pr-4">{number(branch.order_count)}</td>
                                                <td className="py-3">{money(branch.order_value)}</td>
                                            </tr>
                                        ))}
                                        {!report.branch_performance.length && <EmptyTable columns={3} />}
                                    </tbody>
                                </table>
                            </div>
                        </Section>

                        <Section title="Work Order per status" subtitle="Work Order yang dibuat pada periode terpilih.">
                            <div className="space-y-3">
                                {report.production_by_status.map((item) => (
                                    <div key={item.status} className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-slate-300">{statusLabels[item.status] || item.status}</span>
                                        <span className="font-semibold text-white">{number(item.total)}</span>
                                    </div>
                                ))}
                                {!report.production_by_status.length && (
                                    <p className="py-4 text-sm text-slate-500">Belum ada Work Order pada periode ini.</p>
                                )}
                            </div>
                        </Section>

                        <Section
                            title="Pergerakan inventori"
                            subtitle="Penerimaan dan konsumsi ditampilkan sebagai kuantitas positif; penyesuaian adalah nilai neto."
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {[
                                    ["Penerimaan", report.inventory_by_type.receipt],
                                    ["Konsumsi", report.inventory_by_type.consumption],
                                    ["Penyesuaian neto", report.inventory_by_type.adjustment],
                                ].map(([label, item]) => (
                                    <div key={label} className="rounded-xl bg-slate-900/70 p-4">
                                        <p className="text-xs text-slate-500">{label}</p>
                                        <p className="mt-2 text-lg font-semibold text-white">{number(item.quantity)}</p>
                                        <p className="mt-1 text-xs text-slate-500">{number(item.count)} mutasi</p>
                                    </div>
                                ))}
                            </div>
                        </Section>

                        <Section
                            title="Posisi stok saat ini"
                            subtitle="Saldo seluruh cabang digabung jika filter cabang menampilkan semua cabang."
                        >
                            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl bg-slate-900/70 p-4">
                                    <p className="text-xs text-slate-500">Bahan aktif</p>
                                    <p className="mt-2 text-lg font-semibold text-white">
                                        {number(report.stock_summary.material_count)}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-900/70 p-4">
                                    <p className="text-xs text-slate-500">Stok minimum / habis</p>
                                    <p className="mt-2 text-lg font-semibold text-white">
                                        {number(report.stock_summary.low_stock_count)}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-900/70 p-4">
                                    <p className="text-xs text-slate-500">Estimasi nilai stok</p>
                                    <p className="mt-2 text-lg font-semibold text-white">
                                        {money(report.stock_summary.estimated_value)}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {report.low_stock_materials.map((material) => (
                                    <div key={material.id} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-200">{material.name}</p>
                                            <p className="text-xs text-slate-500">{material.sku}</p>
                                        </div>
                                        <span className="shrink-0 text-right text-xs text-amber-300">
                                            {number(material.on_hand)} / min. {number(material.minimum_stock)} {material.unit || ""}
                                        </span>
                                    </div>
                                ))}
                                {!report.low_stock_materials.length && (
                                    <p className="py-2 text-sm text-slate-500">Tidak ada bahan di bawah stok minimum.</p>
                                )}
                            </div>
                        </Section>

                        <Section title="Bahan paling banyak dikonsumsi" subtitle="Berdasarkan mutasi Work Order pada periode terpilih.">
                            <div className="space-y-3">
                                {report.materials_consumed.map((material) => (
                                    <div key={material.id} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Package size={17} className="shrink-0 text-slate-500" />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-200">{material.name}</p>
                                                <p className="text-xs text-slate-500">{material.sku}</p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-sm text-white">
                                            {number(material.quantity)} {material.unit || ""}
                                        </span>
                                    </div>
                                ))}
                                {!report.materials_consumed.length && (
                                    <p className="py-4 text-sm text-slate-500">Belum ada konsumsi bahan pada periode ini.</p>
                                )}
                            </div>
                        </Section>

                        <Section title="Pembayaran terbaru" subtitle="Maksimal 10 pembayaran pada periode dan cabang terpilih.">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-left text-sm">
                                    <thead className="text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="pb-3 pr-4">Pembayaran</th>
                                            <th className="pb-3 pr-4">Pesanan</th>
                                            <th className="pb-3 pr-4">Pelanggan</th>
                                            <th className="pb-3 pr-4">Metode</th>
                                            <th className="pb-3">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {report.recent_payments.map((payment) => (
                                            <tr key={payment.id} className="text-slate-300">
                                                <td className="py-3 pr-4">
                                                    <span className="block">{payment.payment_number}</span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(payment.paid_at).toLocaleString("id-ID")}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">{payment.order?.order_number || "—"}</td>
                                                <td className="py-3 pr-4">{payment.order?.customer?.name || "Pelanggan Umum"}</td>
                                                <td className="py-3 pr-4">{payment.method}</td>
                                                <td className="py-3 font-medium text-white">{money(payment.amount)}</td>
                                            </tr>
                                        ))}
                                        {!report.recent_payments.length && (
                                            <EmptyTable columns={5} message="Belum ada pembayaran pada periode ini." />
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Section>
                    </div>
                </>
            )}
        </div>
    );
}
