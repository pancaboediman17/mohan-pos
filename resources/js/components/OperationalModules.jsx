import { useCallback, useEffect, useRef, useState } from "react";
import Orders from "./Orders";
import Payments from "./Payments";
import { AlertCircle, Check, RefreshCw, Save, Send } from "lucide-react";
import ProductionWorkOrders from "./ProductionWorkOrders";
import InventoryManagement from "./InventoryManagement";
import ReportsDashboard from "./ReportsDashboard";
import HRManagement from "./HRManagement";
import api from "../services/api";

const messageTime = (value) =>
    new Date(value).toLocaleString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    });

function Chat() {
    const [messages, setMessages] = useState([]);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sendError, setSendError] = useState("");
    const lastMessageId = useRef(0);
    const requestInFlight = useRef(false);
    const messageList = useRef(null);

    const loadMessages = useCallback(async (initial = false) => {
        if (requestInFlight.current) return;
        requestInFlight.current = true;
        const shouldScroll =
            initial ||
            !messageList.current ||
            messageList.current.scrollHeight -
                messageList.current.scrollTop -
                messageList.current.clientHeight <
                80;

        try {
            const response = await api.get("/api/v1/chat/messages", {
                params: lastMessageId.current
                    ? { after_id: lastMessageId.current }
                    : {},
            });
            const incoming = response.data?.data || [];
            setError("");

            if (incoming.length) {
                lastMessageId.current = Math.max(
                    lastMessageId.current,
                    ...incoming.map((message) => message.id),
                );
                setMessages((current) => {
                    const knownIds = new Set(current.map((message) => message.id));

                    return [
                        ...current,
                        ...incoming.filter((message) => !knownIds.has(message.id)),
                    ];
                });
                if (shouldScroll) {
                    window.requestAnimationFrame(() => {
                        if (messageList.current) {
                            messageList.current.scrollTop =
                                messageList.current.scrollHeight;
                        }
                    });
                }
            }
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Pesan chat gagal dimuat. Coba muat ulang.",
            );
        } finally {
            requestInFlight.current = false;
            if (initial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMessages(true);
        const interval = window.setInterval(() => loadMessages(), 8000);

        return () => window.clearInterval(interval);
    }, [loadMessages]);

    const sendMessage = async (event) => {
        event.preventDefault();
        const content = body.trim();
        if (!content || sending) return;

        setSending(true);
        setSendError("");
        try {
            const response = await api.post("/api/v1/chat/messages", {
                body: content,
            });
            const message = response.data?.data;
            if (message) {
                lastMessageId.current = Math.max(
                    lastMessageId.current,
                    message.id,
                );
                setMessages((current) =>
                    current.some((item) => item.id === message.id)
                        ? current
                        : [...current, message],
                );
                window.requestAnimationFrame(() => {
                    if (messageList.current) {
                        messageList.current.scrollTop =
                            messageList.current.scrollHeight;
                    }
                });
            }
            setBody("");
        } catch (requestError) {
            setSendError(
                requestError.response?.data?.errors?.body?.[0] ||
                    requestError.response?.data?.message ||
                    "Pesan gagal dikirim. Silakan coba lagi.",
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">Chat Internal</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Ruang komunikasi tim. Pesan baru disinkronkan otomatis.
                    </p>
                </div>
                <button
                    type="button"
                    className="secondary-button"
                    onClick={() => loadMessages()}
                    disabled={loading}
                >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    Muat Ulang
                </button>
            </div>
            <div className="panel max-w-4xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="panel-title">Ruang Tim</h3>
                        <p className="panel-subtitle mt-1">
                            Perbarui setiap 8 detik · Pesan terbaru
                        </p>
                    </div>
                </div>
                {error && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                <div
                    ref={messageList}
                    className="my-5 flex max-h-[28rem] min-h-64 flex-col gap-3 overflow-y-auto pr-1"
                    aria-live="polite"
                    aria-label="Riwayat pesan"
                >
                    {loading ? (
                        <p className="m-auto text-sm text-slate-500">Memuat pesan...</p>
                    ) : messages.length ? (
                        messages.map((message) => (
                            <article
                                key={message.id}
                                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                    message.is_mine
                                        ? "ml-auto bg-blue-500/15 text-blue-50"
                                        : "mr-auto bg-slate-800 text-slate-100"
                                }`}
                            >
                                <div className="mb-1 flex items-baseline justify-between gap-5">
                                    <span className="text-xs font-semibold text-slate-300">
                                        {message.is_mine ? "Anda" : message.sender_name}
                                    </span>
                                    <time
                                        className="text-[11px] text-slate-500"
                                        dateTime={message.created_at}
                                    >
                                        {messageTime(message.created_at)}
                                    </time>
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm">
                                    {message.body}
                                </p>
                            </article>
                        ))
                    ) : (
                        <p className="m-auto text-center text-sm text-slate-500">
                            Belum ada pesan. Mulai percakapan tim di sini.
                        </p>
                    )}
                </div>
                {sendError && (
                    <p className="mb-3 text-sm text-rose-300" role="alert">
                        {sendError}
                    </p>
                )}
                <form className="flex items-end gap-3 border-t border-slate-800 pt-4" onSubmit={sendMessage}>
                    <label className="form-field flex-1">
                        <span className="sr-only">Tulis pesan</span>
                        <textarea
                            className="form-input min-h-12 max-h-32 resize-y"
                            placeholder="Tulis pesan untuk tim..."
                            value={body}
                            maxLength={2000}
                            onChange={(event) => setBody(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    event.currentTarget.form?.requestSubmit();
                                }
                            }}
                            disabled={sending}
                        />
                    </label>
                    <button
                        type="submit"
                        className="primary-button"
                        disabled={sending || !body.trim()}
                    >
                        <Send size={16} />
                        {sending ? "Mengirim..." : "Kirim"}
                    </button>
                </form>
            </div>
        </div>
    );
}

function SettingsPage() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/api/v1/business-profile");
            setProfile(response.data?.data || null);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    "Profil usaha gagal dimuat.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const saveProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const response = await api.put("/api/v1/business-profile", profile);
            const updatedProfile = response.data?.data || profile;
            setProfile(updatedProfile);
            window.dispatchEvent(
                new CustomEvent("business-profile-updated", {
                    detail: updatedProfile,
                }),
            );
            setSuccess(response.data?.message || "Profil usaha berhasil disimpan.");
        } catch (requestError) {
            const validationError = Object.values(
                requestError.response?.data?.errors || {},
            )[0]?.[0];
            setError(
                validationError ||
                    requestError.response?.data?.message ||
                    "Profil usaha gagal disimpan.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">Pengaturan</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Kelola informasi profil usaha yang tersimpan di sistem.
                    </p>
                </div>
            </div>
            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status">
                    <Check size={17} className="mt-0.5 shrink-0" />
                    <span>{success}</span>
                </div>
            )}
            <form className="panel max-w-3xl" onSubmit={saveProfile}>
                <h3 className="panel-title">Profil Usaha</h3>
                <p className="panel-subtitle mt-1">
                    Data ini dapat diperbarui tanpa mengubah data cabang.
                </p>
                {loading ? (
                    <p className="py-8 text-sm text-slate-400">Memuat profil usaha...</p>
                ) : profile ? (
                    <>
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="form-field sm:col-span-2">
                                <span>Nama Usaha</span>
                                <input
                                    className="form-input"
                                    value={profile.business_name || ""}
                                    maxLength={120}
                                    required
                                    onChange={(event) =>
                                        setProfile((current) => ({
                                            ...current,
                                            business_name: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="form-field">
                                <span>Nomor Telepon</span>
                                <input
                                    className="form-input"
                                    value={profile.phone || ""}
                                    maxLength={30}
                                    onChange={(event) =>
                                        setProfile((current) => ({
                                            ...current,
                                            phone: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="form-field">
                                <span>Email</span>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={profile.email || ""}
                                    maxLength={255}
                                    onChange={(event) =>
                                        setProfile((current) => ({
                                            ...current,
                                            email: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="form-field sm:col-span-2">
                                <span>Alamat</span>
                                <textarea
                                    className="form-input min-h-24"
                                    value={profile.address || ""}
                                    maxLength={1000}
                                    onChange={(event) =>
                                        setProfile((current) => ({
                                            ...current,
                                            address: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button type="submit" className="primary-button" disabled={saving}>
                                <Save size={16} />
                                {saving ? "Menyimpan..." : "Simpan Profil"}
                            </button>
                        </div>
                    </>
                ) : (
                    <button type="button" className="secondary-button mt-5" onClick={loadProfile}>
                        <RefreshCw size={15} />
                        Muat Ulang Profil
                    </button>
                )}
            </form>
        </div>
    );
}

export default function OperationalModules({
    active,
    canCreateOrder = false,
    canEditOrder = false,
    canCreatePayment = false,
    canManageProduction = false,
    canManageDesigns = false,
    canManageInventory = false,
    canConsumeInventory = false,
    canManageHr = false,
    openOrderCreate = false,
    openPaymentCreate = false,
    onOrderCreateOpened,
    onPaymentCreateOpened,
}) {
    const pages = {
        orders: (
            <Orders
                canCreate={canCreateOrder}
                canEdit={canEditOrder}
                autoOpenCreate={openOrderCreate}
                onAutoOpenHandled={onOrderCreateOpened}
            />
        ),
        payments: (
            <Payments
                canCreate={canCreatePayment}
                autoOpenCreate={openPaymentCreate}
                onAutoOpenHandled={onPaymentCreateOpened}
            />
        ),
        production: (
            <ProductionWorkOrders
                canManageProduction={canManageProduction}
                canManageDesigns={canManageDesigns}
                canConsumeInventory={canConsumeInventory}
            />
        ),
        inventory: <InventoryManagement canManage={canManageInventory} />,
        reports: <ReportsDashboard />,
        hr: <HRManagement canManage={canManageHr} />,
        chat: <Chat />,
        settings: <SettingsPage />,
    };

    return pages[active] || null;
}
