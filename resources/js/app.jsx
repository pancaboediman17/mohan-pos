import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import UserManagement from "./components/UserManagement";
import Customers from "./components/Customers";
import Products from "./components/Products";
import ProductMasters from "./components/ProductMasters";
import BranchManagement from "./components/BranchManagement";
import SupplierManagement from "./components/SupplierManagement";
import MachineManagement from "./components/MachineManagement";
import OperationalModules from "./components/OperationalModules";
import api, { setAuthToken } from "./services/api";
import { createRoot } from "react-dom/client";
import {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Package,
    Printer,
    ClipboardList,
    Wallet,
    BarChart3,
    MessageCircle,
    Settings,
    Bell,
    Search,
    ChevronDown,
    Menu,
    LogOut,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    Truck,
    CreditCard,
    FileText,
    CircleDollarSign,
    CalendarDays,
    MoreHorizontal,
    ArrowRight,
    X,
    Receipt,
    ScanLine,
    Sun,
    Moon,
    Tags,
} from "lucide-react";

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
} from "recharts";

// ==========================================
// DATA SIMULASI
// ==========================================

const salesData = [
    { day: "Sen", sales: 3200000 },
    { day: "Sel", sales: 4500000 },
    { day: "Rab", sales: 3800000 },
    { day: "Kam", sales: 6200000 },
    { day: "Jum", sales: 5100000 },
    { day: "Sab", sales: 7800000 },
    { day: "Min", sales: 6800000 },
];

const categoryData = [
    { name: "Digital Printing", value: 40, color: "#1479FF" },
    { name: "Offset Printing", value: 35, color: "#FF9A3D" },
    { name: "Large Format", value: 25, color: "#8B5CF6" },
];

const orders = [
    {
        id: "PF-2026-001",
        customer: "CV Maju Jaya",
        product: "Banner 3x1 Meter",
        total: "Rp 450.000",
        status: "Diproses",
        color: "blue",
    },
    {
        id: "PF-2026-002",
        customer: "Budi Printing",
        product: "Brosur A4 500 Pcs",
        total: "Rp 850.000",
        status: "Menunggu DP",
        color: "yellow",
    },
    {
        id: "PF-2026-003",
        customer: "Toko Kreatif",
        product: "Sticker Vinyl",
        total: "Rp 325.000",
        status: "Selesai",
        color: "green",
    },
    {
        id: "PF-2026-004",
        customer: "PT Sejahtera",
        product: "Company Profile",
        total: "Rp 1.500.000",
        status: "Antrean Produksi",
        color: "purple",
    },
    {
        id: "PF-2026-005",
        customer: "Andi Saputra",
        product: "Spanduk 5x1 Meter",
        total: "Rp 275.000",
        status: "QC",
        color: "blue",
    },
];

const menuItems = [
    {
        title: "MENU UTAMA",
        items: [
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "orders", label: "Pesanan", icon: ShoppingCart },
            { id: "customers", label: "Pelanggan", icon: Users },
            { id: "products", label: "Produk & Jasa", icon: Package },
            {
                id: "product-masters",
                label: "Master Kategori & Satuan",
                icon: Tags,
            },
        ],
    },
    {
        title: "OPERASIONAL",
        items: [
            { id: "production", label: "Produksi Pusat", icon: Printer },
            { id: "inventory", label: "Inventory", icon: ClipboardList },
            { id: "payments", label: "Pembayaran", icon: Wallet },
            { id: "reports", label: "Laporan", icon: BarChart3 },
        ],
    },
    {
        title: "KOMUNIKASI",
        items: [
            {
                id: "chat",
                label: "Chat Internal",
                icon: MessageCircle,
                badge: "3",
            },
        ],
    },
    {
        title: "PENGATURAN",
        items: [
            { id: "users", label: "Manajemen Pengguna", icon: Users },
            { id: "branches", label: "Multi-Cabang", icon: Truck },
            { id: "suppliers", label: "Master Supplier", icon: Truck },
            { id: "machines", label: "Master Mesin Produksi", icon: Printer },
            { id: "settings", label: "Pengaturan", icon: Settings },
        ],
    },
];

// ==========================================
// KOMPONEN BANTUAN
// ==========================================

function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);
}

function StatCard({
    title,
    value,
    change,
    icon: Icon,
    positive = true,
    subtitle,
}) {
    return (
        <div className="stat-card">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-400">{title}</p>
                    <h3 className="text-2xl font-bold text-white mt-2">
                        {value}
                    </h3>
                </div>
                <div className="stat-icon">
                    <Icon size={21} />
                </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs">
                <span className={positive ? "trend-up" : "trend-down"}>
                    {positive ? (
                        <ArrowUpRight size={14} />
                    ) : (
                        <ArrowDownRight size={14} />
                    )}
                    {change}
                </span>
                <span className="text-slate-500">
                    {subtitle || "dibanding periode sebelumnya"}
                </span>
            </div>
        </div>
    );
}

function StatusBadge({ status, color }) {
    const styles = {
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        yellow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    };

    return (
        <span className={`status-badge ${styles[color] || styles.blue}`}>
            {status}
        </span>
    );
}

// ==========================================
// SIDEBAR
// ==========================================

function Sidebar({ active, setActive, role, user, onLogout }) {
    const avatar = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

    const permissionMap = {
        dashboard: "dashboard.view",
        users: "users.view",
        orders: "orders.view",
        customers: "customers.view",
        products: "products.view",
        production: "production.view",
        inventory: "inventory.view",
        payments: "payments.view",
        reports: "reports.view",
        chat: "chat.access",
        branches: "branches.view",
        suppliers: "suppliers.view",
        machines: "production.view",
        settings: "settings.manage",
    };

    const visibleMenuItems = menuItems
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                const permission = permissionMap[item.id];

                return (
                    role === "Owner" || user?.permissions?.includes(permission)
                );
            }),
        }))
        .filter((group) => group.items.length > 0);

    const roleLabels = {
        Owner: "Pemilik Sistem",
        Admin: "Administrator",
        Kasir: "Kasir Cabang",
        "Operator Produksi": "Operator Produksi",
        Desainer: "Tim Desain",
    };

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-logo">P</div>
                <div>
                    <h1>Mohan POS</h1>
                    <p>Printing Management System</p>
                </div>
            </div>

            <div className="profile">
                <div className="profile-avatar">{avatar}</div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                        {user?.name || "Pengguna"}
                    </p>

                    <p className="text-xs text-slate-500 truncate">
                        {roleLabels[role] || role}
                    </p>
                </div>
            </div>

            <nav className="sidebar-nav">
                {visibleMenuItems.map((group) => (
                    <div key={group.title} className="mb-6">
                        <p className="menu-heading">{group.title}</p>

                        {group.items.map((item) => {
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActive(item.id)}
                                    className={`menu-link ${
                                        active === item.id ? "active" : ""
                                    }`}
                                >
                                    <Icon size={18} />
                                    <span>{item.label}</span>

                                    {item.badge && (
                                        <span className="menu-badge">
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="sidebar-bottom">
                <div className="system-status">
                    <span className="online-dot"></span>
                    <span>System Online</span>
                </div>

                <button className="menu-link w-full" onClick={onLogout}>
                    <LogOut size={18} />
                    <span>Keluar</span>
                </button>
            </div>
        </aside>
    );
}

// ==========================================
// HEADER
// ==========================================

function Header({
    role,
    active,
    user,
    theme,
    onToggleTheme,
    setActive,
    onLogout,
}) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const titles = {
        dashboard: "Dashboard",
        orders: "Manajemen Pesanan",
        customers: "Data Pelanggan",
        products: "Produk & Jasa",
        "product-masters": "Master Kategori & Satuan",
        production: "Produksi Pusat",
        inventory: "Inventory",
        payments: "Pembayaran",
        reports: "Laporan",
        chat: "Chat Internal",
        branches: "Multi-Cabang",
        suppliers: "Master Supplier",
        machines: "Master Mesin Produksi",
        settings: "Pengaturan",
    };

    const avatar = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";
    const matchedMenus = menuItems
        .flatMap((group) => group.items)
        .filter((item) =>
            item.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
        );
    const openMenu = (id) => {
        setActive(id);
        setSearchTerm("");
        setSearchOpen(false);
    };

    return (
        <header className="topbar">
            <div>
                <h2 className="text-lg font-bold text-white">
                    {titles[active] || "Dashboard"}
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                    Mohan POS / {titles[active] || "Dashboard"}
                </p>
            </div>

            <div className="relative flex items-center gap-3">
                <div className="hidden md:flex search-box relative">
                    <Search size={16} />
                    <input
                        value={searchTerm}
                        onFocus={() => setSearchOpen(true)}
                        onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setSearchOpen(true);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && matchedMenus.length)
                                openMenu(matchedMenus[0].id);
                            if (event.key === "Escape") setSearchOpen(false);
                        }}
                        placeholder="Cari menu..."
                        aria-label="Cari menu"
                    />
                    <span>⌘ K</span>
                </div>
                {searchOpen && (
                    <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                        <p className="px-3 py-2 text-xs text-slate-500">
                            Navigasi cepat
                        </p>
                        {matchedMenus.length ? (
                            matchedMenus.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onMouseDown={() => openMenu(item.id)}
                                        className="menu-link w-full text-left"
                                    >
                                        <Icon size={16} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })
                        ) : (
                            <p className="px-3 py-3 text-sm text-slate-400">
                                Menu tidak ditemukan.
                            </p>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    onClick={onToggleTheme}
                    className="theme-toggle"
                    title={
                        theme === "dark"
                            ? "Aktifkan Light Mode"
                            : "Aktifkan Dark Mode"
                    }
                    aria-label="Ganti tema tampilan"
                >
                    {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
                    <span className="hidden sm:inline">
                        {theme === "dark" ? "Light" : "Dark"}
                    </span>
                </button>

                <div className="relative">
                    <button
                        type="button"
                        className="notification-button"
                        onClick={() => {
                            setNotificationOpen(!notificationOpen);
                            setProfileOpen(false);
                        }}
                        aria-label="Buka notifikasi"
                        aria-expanded={notificationOpen}
                    >
                        <Bell size={19} />
                        <span className="notification-dot"></span>
                    </button>
                    {notificationOpen && (
                        <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
                            <div className="flex items-center justify-between px-2 pb-3">
                                <p className="font-semibold text-white">
                                    Notifikasi
                                </p>
                                <span className="text-xs text-red-400">
                                    3 baru
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    openMenu("orders");
                                    setNotificationOpen(false);
                                }}
                                className="w-full rounded-lg p-2 text-left hover:bg-slate-800"
                            >
                                <p className="text-sm text-white">
                                    Pesanan baru menunggu konfirmasi
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    PF-2026-006 · baru saja
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    openMenu("inventory");
                                    setNotificationOpen(false);
                                }}
                                className="w-full rounded-lg p-2 text-left hover:bg-slate-800"
                            >
                                <p className="text-sm text-white">
                                    Stok Vinyl Glossy menipis
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Perlu pengadaan
                                </p>
                            </button>
                        </div>
                    )}
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-800"></div>

                <span className="role-select">{role}</span>

                <button
                    type="button"
                    className="top-avatar"
                    onClick={() => {
                        setProfileOpen(!profileOpen);
                        setNotificationOpen(false);
                    }}
                    aria-label="Buka menu profil"
                    aria-expanded={profileOpen}
                >
                    {avatar}
                </button>
                {profileOpen && (
                    <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                        <div className="border-b border-slate-800 px-3 py-2">
                            <p className="text-sm font-semibold text-white">
                                {user?.name || "Pengguna"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {role}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                openMenu("settings");
                                setProfileOpen(false);
                            }}
                            className="menu-link w-full"
                        >
                            <Settings size={17} />
                            <span>Pengaturan</span>
                        </button>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="menu-link w-full text-red-400"
                        >
                            <LogOut size={17} />
                            <span>Keluar</span>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

// ==========================================
// DASHBOARD ADMIN
// ==========================================

function AdminDashboard() {
    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Selamat datang, Admin! 👋
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Berikut ringkasan aktivitas bisnis PRINTFLOW hari ini.
                    </p>
                </div>
                <button className="date-button">
                    <CalendarDays size={16} />
                    10 November 2026
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    title="Total Pesanan"
                    value="248"
                    change="+12.5%"
                    icon={ShoppingCart}
                />
                <StatCard
                    title="Omzet Bulan Ini"
                    value="Rp 48,5 Jt"
                    change="+18.2%"
                    icon={CircleDollarSign}
                />
                <StatCard
                    title="Dalam Produksi"
                    value="32"
                    change="+8.4%"
                    icon={Printer}
                />
                <StatCard
                    title="Selesai Produksi"
                    value="186"
                    change="+15.3%"
                    icon={CheckCircle2}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="panel xl:col-span-2">
                    <div className="panel-header">
                        <div>
                            <h3 className="panel-title">Grafik Penjualan</h3>
                            <p className="panel-subtitle">
                                Performa penjualan 7 hari terakhir
                            </p>
                        </div>
                        <select className="dark-select">
                            <option>7 Hari Terakhir</option>
                            <option>30 Hari Terakhir</option>
                        </select>
                    </div>

                    <div className="h-72 mt-5">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient
                                        id="salesGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#1479FF"
                                            stopOpacity={0.35}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#1479FF"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    stroke="#263244"
                                    strokeDasharray="4 4"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="day"
                                    stroke="#64748b"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v / 1000000} jt`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "#111827",
                                        border: "1px solid #334155",
                                        borderRadius: "10px",
                                        color: "#fff",
                                    }}
                                    formatter={(value) => [
                                        formatRupiah(value),
                                        "Penjualan",
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#1479FF"
                                    strokeWidth={3}
                                    fill="url(#salesGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h3 className="panel-title">Kategori Pesanan</h3>
                            <p className="panel-subtitle">
                                Distribusi jenis layanan
                            </p>
                        </div>
                        <MoreHorizontal size={20} className="text-slate-500" />
                    </div>

                    <div className="h-56 relative mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={62}
                                    outerRadius={88}
                                    paddingAngle={5}
                                    stroke="none"
                                >
                                    {categoryData.map((item) => (
                                        <Cell
                                            key={item.name}
                                            fill={item.color}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: "#111827",
                                        border: "1px solid #334155",
                                        borderRadius: "8px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-white">
                                    248
                                </p>
                                <p className="text-xs text-slate-500">
                                    Pesanan
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mt-2">
                        {categoryData.map((item) => (
                            <div
                                key={item.name}
                                className="flex items-center justify-between text-sm"
                            >
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ background: item.color }}
                                    ></span>
                                    {item.name}
                                </div>
                                <span className="text-white font-semibold">
                                    {item.value}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="panel xl:col-span-2">
                    <div className="panel-header mb-5">
                        <div>
                            <h3 className="panel-title">Pesanan Terbaru</h3>
                            <p className="panel-subtitle">
                                Aktivitas pesanan dari seluruh cabang
                            </p>
                        </div>
                        <button className="text-red-400 text-sm flex items-center gap-1">
                            Lihat semua <ArrowRight size={15} />
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
                                {orders.map((order) => (
                                    <tr key={order.id}>
                                        <td className="font-semibold text-white">
                                            {order.id}
                                        </td>
                                        <td>{order.customer}</td>
                                        <td>{order.product}</td>
                                        <td className="text-white">
                                            {order.total}
                                        </td>
                                        <td>
                                            <StatusBadge
                                                status={order.status}
                                                color={order.color}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h3 className="panel-title">Aktivitas Terbaru</h3>
                            <p className="panel-subtitle">Aktivitas sistem</p>
                        </div>
                    </div>

                    <div className="space-y-5 mt-6">
                        {[
                            {
                                icon: ShoppingCart,
                                title: "Pesanan baru diterima",
                                desc: "Cabang Bogor · PF-2026-006",
                                time: "5 menit lalu",
                                color: "text-blue-400",
                            },
                            {
                                icon: Wallet,
                                title: "Pembayaran diterima",
                                desc: "DP Rp 500.000 · PF-2026-004",
                                time: "20 menit lalu",
                                color: "text-emerald-400",
                            },
                            {
                                icon: Printer,
                                title: "Produksi dimulai",
                                desc: "Banner CV Maju Jaya",
                                time: "35 menit lalu",
                                color: "text-red-400",
                            },
                            {
                                icon: CheckCircle2,
                                title: "Quality control selesai",
                                desc: "Sticker Vinyl · PF-2026-003",
                                time: "1 jam lalu",
                                color: "text-purple-400",
                            },
                        ].map((activity, index) => {
                            const Icon = activity.icon;
                            return (
                                <div key={index} className="flex gap-3">
                                    <div
                                        className={`activity-icon ${activity.color}`}
                                    >
                                        <Icon size={17} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-200">
                                            {activity.title}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {activity.desc}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {activity.time}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    {
                        title: "Cabang Aktif",
                        value: "4 Cabang",
                        icon: Truck,
                        desc: "Semua cabang terhubung",
                    },
                    {
                        title: "Stok Bahan",
                        value: "86 Item",
                        icon: Package,
                        desc: "12 item perlu diperiksa",
                    },
                    {
                        title: "Chat Belum Dibaca",
                        value: "3 Pesan",
                        icon: MessageCircle,
                        desc: "Dari tim dan cabang",
                    },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            className="panel flex items-center gap-4"
                            key={item.title}
                        >
                            <div className="stat-icon">
                                <Icon size={22} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">
                                    {item.title}
                                </p>
                                <p className="text-lg font-bold text-white mt-1">
                                    {item.value}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ==========================================
// DASHBOARD KASIR
// ==========================================

function CashierDashboard() {
    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Halo, Kasir! 👋
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Selamat bekerja. Siap melayani pelanggan hari ini?
                    </p>
                </div>
                <div className="date-button">
                    <Clock size={16} />
                    <span>10 November 2026</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button className="cashier-action red-action">
                    <Plus size={27} />
                    <span>Pesanan Baru</span>
                    <small>Input transaksi pelanggan</small>
                </button>
                <button className="cashier-action green-action">
                    <CreditCard size={27} />
                    <span>Pembayaran</span>
                    <small>DP dan pelunasan</small>
                </button>
                <button className="cashier-action blue-action">
                    <ScanLine size={27} />
                    <span>Cek Status Pesanan</span>
                    <small>Tracking pekerjaan</small>
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    title="Transaksi Hari Ini"
                    value="24"
                    change="+8.2%"
                    icon={Receipt}
                />
                <StatCard
                    title="Omzet Hari Ini"
                    value="Rp 5,2 Jt"
                    change="+12.4%"
                    icon={Wallet}
                />
                <StatCard
                    title="Menunggu Pelunasan"
                    value="8"
                    change="3 jatuh tempo"
                    positive={false}
                    icon={Clock}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="panel xl:col-span-2">
                    <div className="panel-header mb-5">
                        <div>
                            <h3 className="panel-title">Pesanan Aktif</h3>
                            <p className="panel-subtitle">
                                Daftar transaksi cabang Anda
                            </p>
                        </div>
                        <button className="text-red-400 text-sm">
                            Lihat semua →
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No. Pesanan</th>
                                    <th>Pelanggan</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.slice(0, 4).map((order) => (
                                    <tr key={order.id}>
                                        <td className="font-semibold text-white">
                                            {order.id}
                                        </td>
                                        <td>{order.customer}</td>
                                        <td className="text-white">
                                            {order.total}
                                        </td>
                                        <td>
                                            <StatusBadge
                                                status={order.status}
                                                color={order.color}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="panel">
                    <h3 className="panel-title">Ringkasan Hari Ini</h3>
                    <p className="panel-subtitle">Cabang Bogor</p>

                    <div className="space-y-5 mt-6">
                        <div className="flex justify-between items-center">
                            <div className="flex gap-3 items-center">
                                <div className="stat-icon">
                                    <ShoppingCart size={19} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Total Transaksi
                                    </p>
                                    <p className="text-lg text-white font-bold">
                                        24
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex gap-3 items-center">
                                <div className="stat-icon">
                                    <Wallet size={19} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Total Omzet
                                    </p>
                                    <p className="text-lg text-white font-bold">
                                        Rp 5.200.000
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex gap-3 items-center">
                                <div className="stat-icon">
                                    <FileText size={19} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Rata-rata Transaksi
                                    </p>
                                    <p className="text-lg text-white font-bold">
                                        Rp 216.667
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h3 className="panel-title">Informasi Produksi</h3>
                        <p className="panel-subtitle">
                            Update dari pusat produksi
                        </p>
                    </div>
                    <Printer className="text-red-400" />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-between mt-5">
                    <div>
                        <p className="text-sm text-white font-semibold">
                            PF-2026-001 · Banner CV Maju Jaya
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Pesanan sudah masuk proses cetak di pusat produksi.
                        </p>
                    </div>
                    <StatusBadge status="Sedang Dicetak" color="blue" />
                </div>
            </div>
        </div>
    );
}

// ==========================================
// APP UTAMA
// ==========================================

// ==========================================
// APP UTAMA - AUTHENTICATION
// ==========================================

function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [active, setActive] = useState("dashboard");
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("printflow_theme") || "light";
    });

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("printflow_theme", theme);
    }, [theme]);

    const handleToggleTheme = () => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    };

    // Memeriksa sesi login ketika aplikasi dibuka
    useEffect(() => {
        const checkAuth = async () => {
            const token = sessionStorage.getItem("printflow_token");

            if (!token) {
                setAuthLoading(false);
                return;
            }

            try {
                const response = await api.get("/api/v1/me");
                setUser(response.data.user);
            } catch (error) {
                setAuthToken(null);
                setUser(null);
            } finally {
                setAuthLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Logout
    const handleLogout = async () => {
        try {
            await api.post("/api/v1/logout");
        } catch (error) {
            console.error("Logout API:", error);
        } finally {
            setAuthToken(null);
            setUser(null);
            setActive("dashboard");
        }
    };

    // Loading awal
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
                <div className="text-center">
                    <Printer
                        size={36}
                        className="text-red-500 mx-auto mb-4 animate-pulse"
                    />
                    <p className="text-slate-400 text-sm">
                        Memeriksa sesi PRINTFLOW...
                    </p>
                </div>
            </div>
        );
    }

    // Belum login
    if (!user) {
        return <Login onLogin={setUser} />;
    }

    // Role asli dari database
    const role = user.roles?.[0] || "User";

    return (
        <div className="app-shell" data-theme={theme}>
            <Sidebar
                active={active}
                setActive={setActive}
                role={role}
                user={user}
                onLogout={handleLogout}
            />

            <main className="main-content">
                <Header
                    role={role}
                    active={active}
                    user={user}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    setActive={setActive}
                    onLogout={handleLogout}
                />

                <div className="page-content">
                    {active === "dashboard" &&
                        active !== "users" &&
                        (role === "Kasir" ? (
                            <CashierDashboard />
                        ) : (
                            <AdminDashboard />
                        ))}
                    {active === "users" && (
                        <UserManagement
                            user={user}
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("users.manage")
                            }
                        />
                    )}

                    {active === "customers" && (
                        <Customers
                            user={user}
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("customers.manage")
                            }
                        />
                    )}

                    {active === "products" && (
                        <Products
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("products.manage")
                            }
                        />
                    )}

                    {active === "product-masters" && (
                        <ProductMasters
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("products.manage")
                            }
                        />
                    )}

                    {active === "branches" && (
                        <BranchManagement
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("branches.manage")
                            }
                        />
                    )}

                    {active === "suppliers" && (
                        <SupplierManagement
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("suppliers.manage")
                            }
                        />
                    )}

                    {active === "machines" && (
                        <MachineManagement
                            canManage={
                                role === "Owner" ||
                                user.permissions?.includes("production.manage")
                            }
                        />
                    )}

                    {!["branches", "suppliers", "machines"].includes(
                        active,
                    ) && (
                        <OperationalModules
                            active={active}
                            user={user}
                            canCreateOrder={
                                role === "Owner" ||
                                user.permissions?.includes("orders.create")
                            }
                            canCreatePayment={
                                role === "Owner" ||
                                user.permissions?.includes("payments.create")
                            }
                        />
                    )}
                </div>

                <footer className="app-footer">
                    Mohan-POS © 2026 · Smart Print Business, One Flow
                </footer>
            </main>
        </div>
    );
}

createRoot(document.getElementById("app")).render(<App />);
