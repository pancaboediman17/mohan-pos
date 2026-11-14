import { lazy, Suspense, useCallback, useState, useEffect } from "react";
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
    LogOut,
    Plus,
    Clock,
    Truck,
    CreditCard,
    FileText,
    CircleDollarSign,
    CalendarDays,
    ArrowRight,
    Receipt,
    ScanLine,
    Sun,
    Moon,
    Tags,
    RefreshCw,
    AlertCircle,
} from "lucide-react";

const Login = lazy(() => import("./components/Login"));
const UserManagement = lazy(() => import("./components/UserManagement"));
const Customers = lazy(() => import("./components/Customers"));
const Products = lazy(() => import("./components/Products"));
const ProductMasters = lazy(() => import("./components/ProductMasters"));
const BranchManagement = lazy(() => import("./components/BranchManagement"));
const SupplierManagement = lazy(() => import("./components/SupplierManagement"));
const MachineManagement = lazy(() => import("./components/MachineManagement"));
const FinishingTypes = lazy(() => import("./components/FinishingTypes"));
const OperationalModules = lazy(
    () => import("./components/OperationalModules"),
);
const DashboardOrderValueChart = lazy(
    () => import("./components/DashboardOrderValueChart"),
);
const PublicQuoteApproval = lazy(
    () => import("./components/PublicQuoteApproval"),
);
const PublicDesignApproval = lazy(
    () => import("./components/PublicDesignApproval"),
);

function ModuleLoading() {
    return (
        <div
            role="status"
            className="flex min-h-40 items-center justify-center text-sm text-slate-400"
        >
            Memuat modul...
        </div>
    );
}

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
            },
        ],
    },
    {
        title: "HRD",
        items: [
            { id: "hr", label: "HR & Karyawan", icon: Users },
        ],
    },
    {
        title: "PENGATURAN",
        items: [
            { id: "users", label: "Manajemen Pengguna", icon: Users },
            { id: "branches", label: "Multi-Cabang", icon: Truck },
            { id: "suppliers", label: "Master Supplier", icon: Truck },
            { id: "machines", label: "Master Mesin Produksi", icon: Printer },
            { id: "finishing-types", label: "Master Jenis Finishing", icon: Tags },
            { id: "settings", label: "Pengaturan", icon: Settings },
        ],
    },
];

const permissionMap = {
    dashboard: "dashboard.view",
    users: "users.view",
    orders: "orders.view",
    customers: "customers.view",
    products: "products.view",
    "product-masters": "products.view",
    production: "production.view",
    inventory: "inventory.view",
    payments: "payments.view",
    reports: "reports.view",
    chat: "chat.access",
    hr: "hr.manage",
    branches: "branches.view",
    suppliers: "suppliers.view",
    machines: "production.view",
    "finishing-types": "production.view",
    settings: "settings.manage",
};

function getVisibleMenuItems(role, user) {
    return menuItems
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                const permission = permissionMap[item.id];

                return (
                    role === "Owner" ||
                    (permission && user?.permissions?.includes(permission))
                );
            }),
        }))
        .filter((group) => group.items.length > 0);
}

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

function DashboardMetricCard({ title, value, caption, icon: Icon, tone }) {
    return (
        <div className="stat-card">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm text-slate-400">{title}</p>
                    <p className="mt-3 break-words text-2xl font-bold text-white">
                        {value}
                    </p>
                </div>
                <div className={`stat-icon ${tone || ""}`}>
                    <Icon size={21} />
                </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">{caption}</p>
        </div>
    );
}

// ==========================================
// SIDEBAR
// ==========================================

function Sidebar({ active, setActive, role, user, onLogout, businessProfile }) {
    const avatar = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";
    const visibleMenuItems = getVisibleMenuItems(role, user);

    const roleLabels = {
        Owner: "Pemilik Sistem",
        Admin: "Administrator",
        HR: "Human Resources",
        Kasir: "Kasir Cabang",
        "Operator Produksi": "Operator Produksi",
        Desainer: "Tim Desain",
    };

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-logo">P</div>
                <div>
                    <h1>{businessProfile?.business_name || "PRINTFLOW POS"}</h1>
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
    businessProfile,
    theme,
    onToggleTheme,
    setActive,
    onLogout,
}) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [notifications, setNotifications] = useState({ count: 0, items: [] });
    const [notificationLoading, setNotificationLoading] = useState(true);
    const [notificationError, setNotificationError] = useState("");
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
        hr: "HR & Karyawan",
        branches: "Multi-Cabang",
        suppliers: "Master Supplier",
        machines: "Master Mesin Produksi",
        "finishing-types": "Master Jenis Finishing",
        settings: "Pengaturan",
    };

    const avatar = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";
    const canAccessSettings =
        role === "Owner" || user?.permissions?.includes("settings.manage");
    const canViewNotifications =
        role === "Owner" || user?.permissions?.includes("dashboard.view");
    const loadNotifications = useCallback(async () => {
        setNotificationLoading(true);
        setNotificationError("");
        try {
            const response = await api.get("/api/v1/notifications");
            setNotifications(response.data?.data || { count: 0, items: [] });
        } catch (requestError) {
            setNotificationError(
                requestError.response?.data?.message ||
                    "Notifikasi gagal dimuat.",
            );
        } finally {
            setNotificationLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!canViewNotifications) {
            setNotificationLoading(false);
            return undefined;
        }

        loadNotifications();
        const interval = window.setInterval(loadNotifications, 60000);

        return () => window.clearInterval(interval);
    }, [loadNotifications, canViewNotifications]);

    const matchedMenus = getVisibleMenuItems(role, user)
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
                    {businessProfile?.business_name || "PRINTFLOW POS"} /{" "}
                    {titles[active] || "Dashboard"}
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

                {canViewNotifications && (
                <div className="relative">
                    <button
                        type="button"
                        className="notification-button"
                        onClick={() => {
                            const nextOpen = !notificationOpen;
                            setNotificationOpen(nextOpen);
                            if (nextOpen) loadNotifications();
                            setProfileOpen(false);
                        }}
                        aria-label={
                            notifications.count
                                ? `Notifikasi, ${notifications.count} perlu perhatian`
                                : "Notifikasi"
                        }
                        aria-expanded={notificationOpen}
                    >
                        <Bell size={19} />
                        {notifications.count > 0 && (
                            <span className="notification-count absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">
                                {notifications.count > 99
                                    ? "99+"
                                    : notifications.count}
                            </span>
                        )}
                    </button>
                    {notificationOpen && (
                        <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-2 pb-3">
                                <div>
                                    <p className="font-semibold text-white">
                                        Perlu perhatian
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Ringkasan aktivitas yang masih terbuka
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                                    onClick={loadNotifications}
                                    disabled={notificationLoading}
                                    aria-label="Muat ulang notifikasi"
                                >
                                    <RefreshCw
                                        size={15}
                                        className={notificationLoading ? "animate-spin" : ""}
                                    />
                                </button>
                            </div>
                            {notificationError ? (
                                <p className="px-2 py-4 text-sm text-rose-300" role="alert">
                                    {notificationError}
                                </p>
                            ) : notificationLoading ? (
                                <p className="px-2 py-4 text-sm text-slate-400" role="status">
                                    Memuat notifikasi...
                                </p>
                            ) : notifications.items.length ? (
                                <>
                                    <div className="max-h-80 space-y-1 overflow-y-auto py-2">
                                        {notifications.items.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    setActive(item.target);
                                                    setNotificationOpen(false);
                                                }}
                                                className="w-full rounded-lg p-3 text-left hover:bg-slate-800"
                                            >
                                                <span className="flex items-start justify-between gap-3">
                                                    <span className="text-sm font-medium text-white">
                                                        {item.title}
                                                    </span>
                                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                                                        {item.count}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block text-xs leading-5 text-slate-400">
                                                    {item.description}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="border-t border-slate-800 px-2 pt-3 text-xs text-slate-500">
                                        {notifications.count} item perlu ditindaklanjuti
                                    </p>
                                </>
                            ) : (
                                <p className="px-2 py-4 text-sm text-slate-400">
                                    Tidak ada aktivitas yang perlu ditindaklanjuti.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                )}

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
                        {canAccessSettings && (
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
                        )}
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

function AdminDashboard({ user, setActive }) {
    const [days, setDays] = useState(7);
    const [branchId, setBranchId] = useState(() => {
        const id = user?.branch_id ?? user?.branch?.id;
        return id ? String(id) : "";
    });
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = { days };
            if (branchId) params.branch_id = branchId;
            const response = await api.get("/api/v1/admin-dashboard", {
                params,
            });
            setDashboard(response.data.data);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Gagal memuat ringkasan dashboard.",
            );
        } finally {
            setLoading(false);
        }
    }, [branchId, days]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const summary = dashboard?.summary;
    const branches = dashboard?.branches || [];
    const statusCounts = dashboard?.status_counts || {};
    const comparisonText = (value) => {
        if (value === null || value === undefined)
            return "Belum ada data pembanding";
        if (value > 0) return `Naik ${value}% dibanding periode sebelumnya`;
        if (value < 0)
            return `Turun ${Math.abs(value)}% dibanding periode sebelumnya`;
        return "Sama dengan periode sebelumnya";
    };
    const dateLabel = (value, options) =>
        new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", options);
    const periodLabel = `${days} hari terakhir`;
    const statusItems = [
        { key: "pending", label: "Menunggu", color: "#f59e0b" },
        { key: "processing", label: "Diproses", color: "#3b82f6" },
        { key: "completed", label: "Selesai", color: "#10b981" },
        { key: "cancelled", label: "Dibatalkan", color: "#64748b" },
    ];
    const statusTotal = statusItems.reduce(
        (total, item) => total + Number(statusCounts[item.key] || 0),
        0,
    );
    const canOpenOrders = user?.permissions?.includes("orders.view");
    const canOpenPayments = user?.permissions?.includes("payments.view");

    return (
        <div className="space-y-6">
            <section className="welcome-row">
                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-red-400">
                        Ringkasan bisnis
                    </p>
                    <h2 className="text-2xl font-bold text-white">
                        Selamat datang, {user?.name || "Admin"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Pantau pesanan, pembayaran, dan operasional cabang.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="dashboard-period">
                        Periode dashboard
                    </label>
                    <select
                        id="dashboard-period"
                        className="dark-select"
                        value={days}
                        onChange={(event) => setDays(Number(event.target.value))}
                    >
                        <option value={7}>7 hari terakhir</option>
                        <option value={30}>30 hari terakhir</option>
                    </select>
                    {branches.length > 1 && (
                        <>
                            <label className="sr-only" htmlFor="dashboard-branch">
                                Filter cabang
                            </label>
                            <select
                                id="dashboard-branch"
                                className="dark-select"
                                value={branchId}
                                onChange={(event) =>
                                    setBranchId(event.target.value)
                                }
                            >
                                <option value="">Semua cabang</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={loadDashboard}
                        disabled={loading}
                        aria-label="Muat ulang dashboard"
                    >
                        <RefreshCw
                            size={15}
                            className={loading ? "animate-spin" : ""}
                        />
                    </button>
                </div>
            </section>

            {error && (
                <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
                >
                    <span>
                        <AlertCircle size={16} className="mr-2 inline" />
                        {error}
                    </span>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={loadDashboard}
                        disabled={loading}
                    >
                        Coba lagi
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <DashboardMetricCard
                    title="Total pesanan"
                    value={summary ? summary.total_orders : "—"}
                    caption={
                        summary
                            ? comparisonText(
                                  dashboard?.comparison?.total_orders_percent,
                              )
                            : `Pesanan aktif dalam ${periodLabel}`
                    }
                    icon={ShoppingCart}
                    tone="text-blue-400"
                />
                <DashboardMetricCard
                    title="Nilai pesanan"
                    value={
                        summary ? formatRupiah(summary.order_value) : "—"
                    }
                    caption={
                        summary
                            ? comparisonText(
                                  dashboard?.comparison?.order_value_percent,
                              )
                            : `Nilai order dibuat dalam ${periodLabel}`
                    }
                    icon={CircleDollarSign}
                    tone="text-emerald-400"
                />
                <DashboardMetricCard
                    title="Pembayaran masuk"
                    value={
                        summary
                            ? formatRupiah(summary.payments_received)
                            : "—"
                    }
                    caption={
                        summary
                            ? comparisonText(
                                  dashboard?.comparison
                                      ?.payments_received_percent,
                              )
                            : `Pembayaran diterima dalam ${periodLabel}`
                    }
                    icon={Wallet}
                    tone="text-violet-400"
                />
                <DashboardMetricCard
                    title="Sisa tagihan"
                    value={
                        summary
                            ? formatRupiah(summary.outstanding_balance)
                            : "—"
                    }
                    caption={
                        summary
                            ? `${summary.production_queue} pesanan dalam antrean produksi`
                            : "Tagihan aktif yang belum lunas"
                    }
                    icon={Clock}
                    tone="text-amber-400"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <section className="panel xl:col-span-2">
                    <div className="panel-header">
                        <div>
                            <h3 className="panel-title">Nilai pesanan</h3>
                            <p className="panel-subtitle">
                                Total nilai order per hari · {periodLabel}
                            </p>
                        </div>
                        <span className="date-button">
                            <CalendarDays size={15} />
                            {dashboard?.filters?.branch_name || "Semua cabang"}
                        </span>
                    </div>
                    <div className="mt-5 h-72">
                        <Suspense
                            fallback={
                                <div
                                    role="status"
                                    className="flex h-full items-center justify-center text-sm text-slate-400"
                                >
                                    Memuat grafik...
                                </div>
                            }
                        >
                            <DashboardOrderValueChart
                                data={dashboard?.sales_chart || []}
                                dateLabel={dateLabel}
                                formatRupiah={formatRupiah}
                            />
                        </Suspense>
                    </div>
                </section>

                <div className="space-y-4">
                    <section className="panel">
                        <div className="panel-header">
                            <div>
                                <h3 className="panel-title">
                                    Alur pesanan
                                </h3>
                                <p className="panel-subtitle">
                                    Status order · {periodLabel}
                                </p>
                            </div>
                            <Printer size={19} className="text-slate-500" />
                        </div>
                        <div className="mt-5 space-y-4">
                            {statusItems.map((item) => {
                                const count = Number(
                                    statusCounts[item.key] || 0,
                                );
                                const percentage = statusTotal
                                    ? (count / statusTotal) * 100
                                    : 0;

                                return (
                                    <div key={item.key}>
                                        <div className="mb-2 flex items-center justify-between text-sm">
                                            <span className="text-slate-400">
                                                {item.label}
                                            </span>
                                            <span className="font-semibold text-white">
                                                {count}
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: item.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="panel">
                        <div className="panel-header">
                            <div>
                                <h3 className="panel-title">
                                    Perlu perhatian
                                </h3>
                                <p className="panel-subtitle">
                                    Ringkasan tindakan operasional
                                </p>
                            </div>
                            <AlertCircle
                                size={19}
                                className="text-amber-400"
                            />
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-slate-300">
                                        Pesanan melewati tenggat
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Belum selesai dan jatuh tempo
                                    </p>
                                </div>
                                <span
                                    className={`text-lg font-bold ${
                                        summary?.overdue_orders
                                            ? "text-red-400"
                                            : "text-emerald-400"
                                    }`}
                                >
                                    {summary ? summary.overdue_orders : "—"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                                <div>
                                    <p className="text-sm text-slate-300">
                                        Antrean produksi
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Menunggu atau sedang diproses
                                    </p>
                                </div>
                                <span className="text-lg font-bold text-blue-400">
                                    {summary ? summary.production_queue : "—"}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                                {canOpenOrders && (
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => setActive("orders")}
                                    >
                                        Tinjau pesanan
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                                {canOpenPayments && (
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => setActive("payments")}
                                    >
                                        Pembayaran
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <section className="panel xl:col-span-2">
                    <div className="panel-header mb-5">
                        <div>
                            <h3 className="panel-title">Pesanan terbaru</h3>
                            <p className="panel-subtitle">
                                Order aktif lintas cabang
                            </p>
                        </div>
                        {canOpenOrders && (
                            <button
                                type="button"
                                className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
                                onClick={() => setActive("orders")}
                            >
                                Lihat semua <ArrowRight size={15} />
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Pesanan</th>
                                    <th>Pelanggan / cabang</th>
                                    <th>Nilai</th>
                                    <th>Status</th>
                                    <th>Tenggat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboard?.recent_orders?.length ? (
                                    dashboard.recent_orders.map((order) => {
                                        const orderStatus = {
                                            pending: {
                                                label: "Menunggu",
                                                color: "yellow",
                                            },
                                            processing: {
                                                label: "Diproses",
                                                color: "blue",
                                            },
                                            completed: {
                                                label: "Selesai",
                                                color: "green",
                                            },
                                            cancelled: {
                                                label: "Dibatalkan",
                                                color: "purple",
                                            },
                                        }[order.status] || {
                                            label: order.status,
                                            color: "blue",
                                        };

                                        return (
                                            <tr key={order.id}>
                                                <td>
                                                    <p className="font-semibold text-white">
                                                        {order.order_number}
                                                    </p>
                                                    <p className="mt-1 max-w-48 truncate text-xs text-slate-500">
                                                        {order.items
                                                            ?.slice(0, 2)
                                                            .map(
                                                                (item) =>
                                                                    item.product_name,
                                                            )
                                                            .join(", ") ||
                                                            "Tanpa rincian produk"}
                                                    </p>
                                                </td>
                                                <td>
                                                    <p className="text-slate-200">
                                                        {order.customer?.name ||
                                                            "Pelanggan Umum"}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {order.branch?.name ||
                                                            "Tanpa cabang"}
                                                    </p>
                                                </td>
                                                <td className="whitespace-nowrap text-white">
                                                    {formatRupiah(order.total)}
                                                </td>
                                                <td>
                                                    <StatusBadge
                                                        status={
                                                            orderStatus.label
                                                        }
                                                        color={
                                                            orderStatus.color
                                                        }
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    {order.due_date
                                                        ? dateLabel(
                                                              order.due_date,
                                                              {
                                                                  day: "2-digit",
                                                                  month: "short",
                                                              },
                                                          )
                                                        : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="py-8 text-center text-slate-500"
                                        >
                                            {loading
                                                ? "Memuat pesanan..."
                                                : "Belum ada pesanan aktif."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h3 className="panel-title">Performa cabang</h3>
                            <p className="panel-subtitle">
                                Nilai dan jumlah order · {periodLabel}
                            </p>
                        </div>
                        <Truck size={19} className="text-slate-500" />
                    </div>
                    <div className="mt-4 space-y-1">
                        {dashboard?.branch_performance?.length ? (
                            dashboard.branch_performance.map((branch) => (
                                <div
                                    key={branch.branch_id || branch.branch_name}
                                    className="flex items-center justify-between gap-3 border-b border-slate-800 py-3 last:border-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-200">
                                            {branch.branch_name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {branch.order_count} pesanan
                                        </p>
                                    </div>
                                    <p className="whitespace-nowrap text-sm font-semibold text-white">
                                        {formatRupiah(branch.order_value)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="py-8 text-center text-sm text-slate-500">
                                {loading
                                    ? "Memuat performa cabang..."
                                    : "Belum ada data cabang."}
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

// ==========================================
// DASHBOARD KASIR
// ==========================================

function CashierDashboard({
    user,
    canCreateOrder,
    canCreatePayment,
    onNewOrder,
    onOpenPayments,
    onViewOrders,
}) {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get("/api/v1/cashier-dashboard");
            setDashboard(response.data.data);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Gagal memuat ringkasan kasir.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const orderStatus = {
        pending: { label: "Menunggu", color: "yellow" },
        processing: { label: "Diproses", color: "blue" },
        completed: { label: "Selesai", color: "green" },
        cancelled: { label: "Dibatalkan", color: "purple" },
    };
    const paymentStatus = {
        unpaid: { label: "Belum Dibayar", color: "yellow" },
        partial: { label: "Dibayar Sebagian", color: "yellow" },
        paid: { label: "Lunas", color: "green" },
    };
    const transactions = Number(dashboard?.today_transactions || 0);
    const sales = Number(dashboard?.today_sales || 0);

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Halo, {user?.name || "Kasir"}!
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Selamat bekerja. Siap melayani pelanggan hari ini?
                    </p>
                </div>
                <div className="date-button">
                    <CalendarDays size={16} />
                    <span>
                        {new Intl.DateTimeFormat("id-ID", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        }).format(new Date())}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                    type="button"
                    className="cashier-action red-action"
                    onClick={onNewOrder}
                    disabled={!canCreateOrder}
                >
                    <Plus size={27} />
                    <span>Pesanan Baru</span>
                    <small>Input transaksi pelanggan</small>
                </button>
                <button
                    type="button"
                    className="cashier-action green-action"
                    onClick={onOpenPayments}
                    disabled={!canCreatePayment}
                >
                    <CreditCard size={27} />
                    <span>Pembayaran</span>
                    <small>DP dan pelunasan</small>
                </button>
                <button
                    type="button"
                    className="cashier-action blue-action"
                    onClick={onViewOrders}
                >
                    <ScanLine size={27} />
                    <span>Cek Status Pesanan</span>
                    <small>Lihat perkembangan pesanan</small>
                </button>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                    <span>
                        <AlertCircle size={16} className="mr-2 inline" />
                        {error}
                    </span>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={loadDashboard}
                        disabled={loading}
                    >
                        Coba lagi
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Transaksi Hari Ini
                            </p>
                            <h3 className="mt-2 text-2xl font-bold text-white">
                                {!dashboard ? "—" : transactions}
                            </h3>
                        </div>
                        <div className="stat-icon">
                            <Receipt size={21} />
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                        Pesanan aktif yang dibuat hari ini
                    </p>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Nilai Pesanan Hari Ini
                            </p>
                            <h3 className="mt-2 text-xl font-bold text-white">
                                {!dashboard
                                    ? "—"
                                    : formatRupiah(sales)}
                            </h3>
                        </div>
                        <div className="stat-icon">
                            <Wallet size={21} />
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                        Total pesanan aktif di cabang
                    </p>
                </div>
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-400">
                                Menunggu Pelunasan
                            </p>
                            <h3 className="mt-2 text-2xl font-bold text-white">
                                {!dashboard
                                    ? "—"
                                    : Number(dashboard?.outstanding_orders || 0)}
                            </h3>
                        </div>
                        <div className="stat-icon text-amber-400">
                            <Clock size={21} />
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                        Sisa tagihan{" "}
                        {!dashboard
                            ? "—"
                            : formatRupiah(
                                  dashboard?.outstanding_balance || 0,
                              )}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="panel xl:col-span-2">
                    <div className="panel-header mb-5">
                        <div>
                            <h3 className="panel-title">Pesanan Aktif</h3>
                            <p className="panel-subtitle">
                                Pesanan terbaru di {dashboard?.branch_name || user?.branch?.name || "cabang Anda"}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="text-red-400 text-sm"
                            onClick={onViewOrders}
                        >
                            Lihat semua →
                        </button>
                    </div>

                    <div className="mb-4 flex justify-end">
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={loadDashboard}
                            disabled={loading}
                        >
                            <RefreshCw
                                size={15}
                                className={loading ? "animate-spin" : ""}
                            />
                            Muat Ulang
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No. Pesanan</th>
                                    <th>Pelanggan</th>
                                    <th>Total</th>
                                    <th>Status Pesanan</th>
                                    <th>Pembayaran</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!dashboard ? (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="py-8 text-center"
                                        >
                                            {loading
                                                ? "Memuat pesanan..."
                                                : "Data pesanan belum tersedia."}
                                        </td>
                                    </tr>
                                ) : dashboard?.recent_orders?.length ? (
                                    dashboard.recent_orders.map((order) => {
                                        const orderState =
                                            orderStatus[order.status] || {
                                                label: order.status,
                                                color: "blue",
                                            };
                                        const paymentState =
                                            paymentStatus[order.payment_status] || {
                                                label: order.payment_status,
                                                color: "blue",
                                            };

                                        return (
                                            <tr key={order.id}>
                                                <td className="font-semibold text-white">
                                                    {order.order_number}
                                                </td>
                                                <td>
                                                    {order.customer?.name ||
                                                        "Pelanggan Umum"}
                                                </td>
                                                <td className="text-white">
                                                    {formatRupiah(order.total)}
                                                </td>
                                                <td>
                                                    <StatusBadge
                                                        status={orderState.label}
                                                        color={orderState.color}
                                                    />
                                                </td>
                                                <td>
                                                    <StatusBadge
                                                        status={paymentState.label}
                                                        color={paymentState.color}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="py-8 text-center text-slate-500"
                                        >
                                            Belum ada pesanan aktif di cabang ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="panel">
                    <h3 className="panel-title">Ringkasan Hari Ini</h3>
                    <p className="panel-subtitle">
                        {dashboard?.branch_name || user?.branch?.name || "Semua Cabang"}
                    </p>

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
                                        {!dashboard
                                            ? "—"
                                            : transactions}
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
                                        {!dashboard
                                            ? "—"
                                            : formatRupiah(sales)}
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
                                        {!dashboard
                                            ? "—"
                                            : formatRupiah(
                                                  transactions
                                                      ? sales / transactions
                                                      : 0,
                                              )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
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
    const [businessProfile, setBusinessProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [active, setActive] = useState("dashboard");
    const [openOrderCreate, setOpenOrderCreate] = useState(false);
    const [openPaymentCreate, setOpenPaymentCreate] = useState(false);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("printflow_theme") || "light";
    });

    useEffect(() => {
        if (
            user &&
            !user.permissions?.includes("dashboard.view") &&
            user.permissions?.includes("hr.manage")
        ) {
            setActive("hr");
        }
    }, [user]);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("printflow_theme", theme);
    }, [theme]);

    const handleToggleTheme = () => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    };

    const handleNewOrder = () => {
        setActive("orders");
        setOpenOrderCreate(true);
    };

    const handleOpenPayments = () => {
        setActive("payments");
        setOpenPaymentCreate(true);
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

    useEffect(() => {
        if (!user) {
            setBusinessProfile(null);
            return undefined;
        }

        let mounted = true;
        const handleProfileUpdate = (event) => {
            setBusinessProfile(event.detail);
        };
        window.addEventListener("business-profile-updated", handleProfileUpdate);

        api.get("/api/v1/public/business-profile")
            .then((response) => {
                if (mounted) setBusinessProfile(response.data?.data || null);
            })
            .catch((error) => {
                console.error("Profil usaha gagal dimuat:", error);
            });

        return () => {
            mounted = false;
            window.removeEventListener(
                "business-profile-updated",
                handleProfileUpdate,
            );
        };
    }, [user]);

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
        return (
            <Suspense fallback={<ModuleLoading />}>
                <Login onLogin={setUser} />
            </Suspense>
        );
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
                businessProfile={businessProfile}
            />

            <main className="main-content">
                <Header
                    role={role}
                    active={active}
                    user={user}
                    businessProfile={businessProfile}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                    setActive={setActive}
                    onLogout={handleLogout}
                />

                <div className="page-content">
                    <Suspense fallback={<ModuleLoading />}>
                        {active === "dashboard" &&
                            (role === "Kasir" ? (
                                <CashierDashboard
                                    user={user}
                                    canCreateOrder={
                                        role === "Owner" ||
                                        user.permissions?.includes(
                                            "orders.create",
                                        )
                                    }
                                    canCreatePayment={
                                        role === "Owner" ||
                                        user.permissions?.includes(
                                            "payments.create",
                                        )
                                    }
                                    canManageProduction={
                                        role === "Owner" ||
                                        user.permissions?.includes(
                                            "production.manage",
                                        )
                                    }
                                    canManageDesigns={
                                        role === "Owner" ||
                                        user.permissions?.includes("designs.manage")
                                    }
                                    canManageInventory={
                                        role === "Owner" ||
                                        user.permissions?.includes("inventory.manage")
                                    }
                                    canConsumeInventory={
                                        role === "Owner" ||
                                        user.permissions?.includes("inventory.consume")
                                    }
                                    onNewOrder={handleNewOrder}
                                    onOpenPayments={handleOpenPayments}
                                    onViewOrders={() => setActive("orders")}
                                />
                            ) : (
                                <AdminDashboard
                                    user={user}
                                    setActive={setActive}
                                />
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
                                    user.permissions?.includes(
                                        "customers.manage",
                                    )
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
                                    user.permissions?.includes(
                                        "products.manage",
                                    )
                                }
                            />
                        )}

                        {active === "branches" && (
                            <BranchManagement
                                canManage={
                                    role === "Owner" ||
                                    user.permissions?.includes(
                                        "branches.manage",
                                    )
                                }
                            />
                        )}

                        {active === "suppliers" && (
                            <SupplierManagement
                                canManage={
                                    role === "Owner" ||
                                    user.permissions?.includes(
                                        "suppliers.manage",
                                    )
                                }
                            />
                        )}

                        {active === "machines" && (
                            <MachineManagement
                                canManage={
                                    role === "Owner" ||
                                    user.permissions?.includes(
                                        "production.manage",
                                    )
                                }
                            />
                        )}

                        {active === "finishing-types" && (
                            <FinishingTypes
                                canManage={
                                    role === "Owner" ||
                                    user.permissions?.includes(
                                        "production.manage",
                                    )
                                }
                            />
                        )}

                        {![
                            "branches",
                            "suppliers",
                            "machines",
                            "finishing-types",
                        ].includes(active) && (
                            <OperationalModules
                                active={active}
                                canManageHr={
                                    role === "Owner" ||
                                    user.permissions?.includes("hr.manage")
                                }
                                canCreateOrder={
                                    role === "Owner" ||
                                    user.permissions?.includes("orders.create")
                                }
                                canEditOrder={
                                    role === "Owner" ||
                                    user.permissions?.includes("orders.edit")
                                }
                                canCreatePayment={
                                    role === "Owner" ||
                                    user.permissions?.includes(
                                        "payments.create",
                                    )
                                }
                                openOrderCreate={openOrderCreate}
                                openPaymentCreate={openPaymentCreate}
                                onOrderCreateOpened={() =>
                                    setOpenOrderCreate(false)
                                }
                                onPaymentCreateOpened={() =>
                                    setOpenPaymentCreate(false)
                                }
                            />
                        )}
                    </Suspense>
                </div>

                <footer className="app-footer">
                    {businessProfile?.business_name || "PRINTFLOW POS"} © {new Date().getFullYear()}
                    {" · "}Smart Print Business, One Flow
                </footer>
            </main>
        </div>
    );
}

const quoteToken = new URLSearchParams(window.location.search).get("quote");
const designToken = new URLSearchParams(window.location.search).get("design");

createRoot(document.getElementById("app")).render(
    quoteToken ? (
        <Suspense fallback={<ModuleLoading />}>
            <PublicQuoteApproval token={quoteToken} />
        </Suspense>
    ) : designToken ? (
        <Suspense fallback={<ModuleLoading />}>
            <PublicDesignApproval token={designToken} />
        </Suspense>
    ) : (
        <App />
    ),
);
