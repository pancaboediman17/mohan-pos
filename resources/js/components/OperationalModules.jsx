import React from "react";
import Orders from "./Orders";
import Payments from "./Payments";
import {
    BarChart3,
    ClipboardList,
    CreditCard,
    Factory,
    FileText,
    MessageCircle,
    PackageSearch,
    Settings,
    Store,
    Plus,
    Download,
    Send,
    TrendingUp,
    CheckCircle2,
    Clock3,
    AlertTriangle,
    ArrowUpRight,
    Users,
    Wallet,
} from "lucide-react";

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);

const orders = [
    [
        "PF-2026-006",
        "PT Cipta Karya",
        "Company Profile",
        "Rp 1.250.000",
        "Menunggu DP",
    ],
    ["PF-2026-005", "Andi Saputra", "Spanduk 5 x 1 Meter", "Rp 275.000", "QC"],
    ["PF-2026-004", "Toko Kreatif", "Sticker Vinyl", "Rp 325.000", "Diproses"],
    [
        "PF-2026-003",
        "CV Maju Jaya",
        "Brosur A4 500 pcs",
        "Rp 850.000",
        "Selesai",
    ],
];

const production = [
    ["PF-2026-004", "Company Profile", "Desain", "Dimas", "14:30"],
    ["PF-2026-005", "Spanduk 5 x 1 Meter", "Cetak", "Rian", "15:00"],
    ["PF-2026-006", "Company Profile", "Finishing", "Sari", "16:30"],
];

const inventory = [
    ["Kertas Art Paper 150 gsm", "Lembar", "1.250", "500", "Aman"],
    ["Tinta Eco Solvent Cyan", "Liter", "3,5", "2", "Aman"],
    ["Vinyl Glossy", "Meter", "18", "25", "Menipis"],
    ["Laminasi Doff", "Meter", "42", "20", "Aman"],
];

const tone = (status) => {
    if (["Selesai", "Aman", "Lunas"].includes(status))
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (["Menunggu DP", "Menipis", "Jatuh tempo"].includes(status))
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
};

function Badge({ children }) {
    return <span className={`status-badge ${tone(children)}`}>{children}</span>;
}

function SummaryCard({ icon: Icon, label, value, note, warning = false }) {
    return (
        <div className="stat-card">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="text-2xl font-bold text-white mt-2">
                        {value}
                    </p>
                </div>
                <div className={`stat-icon ${warning ? "text-amber-400" : ""}`}>
                    <Icon size={21} />
                </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">{note}</p>
        </div>
    );
}

function Title({ title, description, action = "Tambah Baru" }) {
    return (
        <div className="welcome-row">
            <div>
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
            </div>
            <button type="button" className="primary-button">
                <Plus size={16} />
                {action}
            </button>
        </div>
    );
}

function OrdersLegacy() {
    return (
        <div className="space-y-6">
            <Title
                title="Manajemen Pesanan"
                description="Pantau pesanan pelanggan dari masuk sampai selesai."
                action="Pesanan Baru"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <SummaryCard
                    icon={ClipboardList}
                    label="Pesanan Baru"
                    value="12"
                    note="4 pesanan perlu dikonfirmasi"
                />
                <SummaryCard
                    icon={Clock3}
                    label="Dalam Proses"
                    value="32"
                    note="Sedang dikerjakan produksi"
                />
                <SummaryCard
                    icon={CheckCircle2}
                    label="Selesai Hari Ini"
                    value="18"
                    note="Naik 20% dari kemarin"
                />
                <SummaryCard
                    icon={Wallet}
                    label="Menunggu Pembayaran"
                    value="Rp 4,8 Jt"
                    note="8 invoice belum lunas"
                    warning
                />
            </div>
            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Pesanan Terkini</h3>
                        <p className="panel-subtitle">
                            Daftar pesanan yang perlu ditindaklanjuti
                        </p>
                    </div>
                    <button className="secondary-button">
                        <Download size={15} /> Ekspor
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Pesanan</th>
                                <th>Pelanggan</th>
                                <th>Produk</th>
                                <th>Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((row) => (
                                <tr key={row[0]}>
                                    {row.map((cell, i) => (
                                        <td key={i}>
                                            {i === 4 ? (
                                                <Badge>{cell}</Badge>
                                            ) : (
                                                cell
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Production() {
    return (
        <div className="space-y-6">
            <Title
                title="Produksi Pusat"
                description="Atur antrean kerja dan pantau proses produksi."
                action="Buat Job Produksi"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    icon={Factory}
                    label="Antrean Hari Ini"
                    value="14"
                    note="3 pekerjaan prioritas"
                />
                <SummaryCard
                    icon={Clock3}
                    label="Sedang Diproduksi"
                    value="8"
                    note="Estimasi selesai hari ini"
                />
                <SummaryCard
                    icon={CheckCircle2}
                    label="Menunggu QC"
                    value="5"
                    note="Perlu pemeriksaan akhir"
                />
            </div>
            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Antrean Produksi</h3>
                        <p className="panel-subtitle">
                            Jadwal kerja aktif di pusat produksi
                        </p>
                    </div>
                    <button className="secondary-button">Lihat Kalender</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Pesanan</th>
                                <th>Produk</th>
                                <th>Tahap</th>
                                <th>Petugas</th>
                                <th>Target</th>
                            </tr>
                        </thead>
                        <tbody>
                            {production.map((row) => (
                                <tr key={row[0]}>
                                    {row.map((cell, i) => (
                                        <td key={i}>
                                            {i === 2 ? (
                                                <Badge>{cell}</Badge>
                                            ) : (
                                                cell
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Inventory() {
    return (
        <div className="space-y-6">
            <Title
                title="Inventori"
                description="Kelola stok bahan baku dan kebutuhan produksi."
                action="Tambah Stok"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    icon={PackageSearch}
                    label="Total Item"
                    value="86"
                    note="Bahan dan perlengkapan aktif"
                />
                <SummaryCard
                    icon={AlertTriangle}
                    label="Stok Menipis"
                    value="4"
                    note="Perlu pengadaan segera"
                    warning
                />
                <SummaryCard
                    icon={TrendingUp}
                    label="Nilai Persediaan"
                    value="Rp 24,6 Jt"
                    note="Estimasi stok saat ini"
                />
            </div>
            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Stok Bahan</h3>
                        <p className="panel-subtitle">
                            Persediaan bahan yang digunakan dalam produksi
                        </p>
                    </div>
                    <button className="secondary-button">
                        <Download size={15} /> Stok Opname
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nama Bahan</th>
                                <th>Satuan</th>
                                <th>Stok</th>
                                <th>Stok Minimum</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventory.map((row) => (
                                <tr key={row[0]}>
                                    {row.map((cell, i) => (
                                        <td key={i}>
                                            {i === 4 ? (
                                                <Badge>{cell}</Badge>
                                            ) : (
                                                cell
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function PaymentsLegacy() {
    const invoices = [
        [
            "INV-2026-006",
            "PT Cipta Karya",
            "Rp 1.250.000",
            "20 Nov 2026",
            "Menunggu DP",
        ],
        [
            "INV-2026-005",
            "Andi Saputra",
            "Rp 275.000",
            "18 Nov 2026",
            "Jatuh tempo",
        ],
        ["INV-2026-003", "CV Maju Jaya", "Rp 850.000", "10 Nov 2026", "Lunas"],
    ];
    return (
        <div className="space-y-6">
            <Title
                title="Pembayaran"
                description="Rekam pembayaran dan pantau tagihan pelanggan."
                action="Catat Pembayaran"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    icon={CreditCard}
                    label="Penerimaan Hari Ini"
                    value="Rp 6,4 Jt"
                    note="12 transaksi berhasil"
                />
                <SummaryCard
                    icon={FileText}
                    label="Piutang Aktif"
                    value="Rp 8,2 Jt"
                    note="16 invoice belum lunas"
                />
                <SummaryCard
                    icon={AlertTriangle}
                    label="Jatuh Tempo"
                    value="3"
                    note="Invoice perlu ditagih"
                    warning
                />
            </div>
            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Invoice Terbaru</h3>
                        <p className="panel-subtitle">
                            Tagihan yang memerlukan tindak lanjut
                        </p>
                    </div>
                    <button className="secondary-button">Semua Invoice</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Invoice</th>
                                <th>Pelanggan</th>
                                <th>Nilai</th>
                                <th>Jatuh Tempo</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((row) => (
                                <tr key={row[0]}>
                                    {row.map((cell, i) => (
                                        <td key={i}>
                                            {i === 4 ? (
                                                <Badge>{cell}</Badge>
                                            ) : (
                                                cell
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Reports() {
    const reportCards = [
        [
            "Laporan Penjualan",
            "Omzet, pesanan, dan performa per periode",
            BarChart3,
        ],
        ["Laporan Produksi", "Status pekerjaan dan produktivitas tim", Factory],
        ["Laporan Keuangan", "Penerimaan, piutang, dan ringkasan kas", Wallet],
    ];
    return (
        <div className="space-y-6">
            <Title
                title="Laporan"
                description="Pilih laporan untuk memantau performa usaha."
                action="Ekspor Laporan"
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {reportCards.map(([title, text, Icon]) => (
                    <div className="panel" key={title}>
                        <div className="stat-icon mb-5">
                            <Icon size={22} />
                        </div>
                        <h3 className="panel-title">{title}</h3>
                        <p className="panel-subtitle mt-2 min-h-10">{text}</p>
                        <button className="secondary-button mt-5">
                            Buka Laporan <ArrowUpRight size={15} />
                        </button>
                    </div>
                ))}
            </div>
            <div className="panel">
                <h3 className="panel-title">Ringkasan Bulan Ini</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
                    <div>
                        <p className="text-sm text-slate-400">Total Omzet</p>
                        <p className="text-2xl font-bold text-white mt-2">
                            {money(48500000)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">
                            Pesanan Selesai
                        </p>
                        <p className="text-2xl font-bold text-white mt-2">
                            186
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">
                            Rata-rata Nilai Pesanan
                        </p>
                        <p className="text-2xl font-bold text-white mt-2">
                            {money(265000)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Chat() {
    return (
        <div className="space-y-6">
            <Title
                title="Chat Internal"
                description="Komunikasi cepat antar anggota tim."
                action="Pesan Baru"
            />
            <div className="panel max-w-4xl">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                    <div className="profile-avatar">T</div>
                    <div>
                        <h3 className="panel-title">Tim Produksi</h3>
                        <p className="panel-subtitle">5 anggota aktif</p>
                    </div>
                </div>
                <div className="py-8 space-y-5">
                    <div className="flex gap-3">
                        <div className="profile-avatar">R</div>
                        <div>
                            <p className="text-sm text-white font-semibold">
                                Rian{" "}
                                <span className="text-slate-500 font-normal">
                                    09:20
                                </span>
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                Banner pesanan PF-2026-005 sudah masuk tahap
                                cetak.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="profile-avatar">S</div>
                        <div>
                            <p className="text-sm text-white font-semibold">
                                Sari{" "}
                                <span className="text-slate-500 font-normal">
                                    09:35
                                </span>
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                Siap, saya lanjutkan finishing setelah proses
                                cetak selesai.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <input
                        className="form-input flex-1"
                        placeholder="Tulis pesan untuk tim..."
                    />
                    <button className="primary-button">
                        <Send size={16} /> Kirim
                    </button>
                </div>
            </div>
        </div>
    );
}

function Branches() {
    return (
        <div className="space-y-6">
            <Title
                title="Multi-Cabang"
                description="Kelola lokasi operasional dan akses cabang."
                action="Tambah Cabang"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                    [
                        "Kantor Pusat",
                        "Jl. Sudirman No. 45, Jakarta",
                        "12 pengguna aktif",
                    ],
                    [
                        "Cabang Bandung",
                        "Jl. Asia Afrika No. 18, Bandung",
                        "6 pengguna aktif",
                    ],
                ].map(([name, address, users]) => (
                    <div className="panel" key={name}>
                        <div className="flex justify-between gap-4">
                            <div>
                                <div className="stat-icon mb-4">
                                    <Store size={21} />
                                </div>
                                <h3 className="panel-title">{name}</h3>
                                <p className="panel-subtitle mt-2">{address}</p>
                            </div>
                            <Badge>Aman</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-6">
                            <Users size={16} />
                            {users}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SettingsPage() {
    return (
        <div className="space-y-6">
            <Title
                title="Pengaturan"
                description="Atur informasi usaha dan preferensi sistem."
                action="Simpan Perubahan"
            />
            <div className="panel max-w-3xl">
                <h3 className="panel-title">Profil Usaha</h3>
                <p className="panel-subtitle mt-1">
                    Informasi ini akan digunakan pada dokumen dan laporan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <label className="form-field">
                        <span>Nama Usaha</span>
                        <input
                            className="form-input"
                            defaultValue="PRINTFLOW POS"
                        />
                    </label>
                    <label className="form-field">
                        <span>Nomor Telepon</span>
                        <input
                            className="form-input"
                            defaultValue="021-555-0123"
                        />
                    </label>
                    <label className="form-field sm:col-span-2">
                        <span>Alamat</span>
                        <textarea
                            className="form-input min-h-24"
                            defaultValue="Jl. Sudirman No. 45, Jakarta"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}

export default function OperationalModules({
    active,
    user,
    canCreateOrder = false,
    canCreatePayment = false,
}) {
    const pages = {
        orders: <Orders user={user} canCreate={canCreateOrder} />,
        payments: <Payments canCreate={canCreatePayment} />,
        production: <Production />,
        inventory: <Inventory />,
        reports: <Reports />,
        chat: <Chat />,
        branches: <Branches />,
        settings: <SettingsPage />,
    };

    return pages[active] || null;
}
