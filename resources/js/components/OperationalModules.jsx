import { useCallback, useEffect, useRef, useState } from "react";
import Orders from "./Orders";
import Payments from "./Payments";
import {
    AlertCircle,
    Check,
    MessageCircle,
    RefreshCw,
    Save,
    Search,
    Send,
    Users,
} from "lucide-react";
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
    const [mode, setMode] = useState("team");
    const [contacts, setContacts] = useState([]);
    const [contactsLoading, setContactsLoading] = useState(true);
    const [contactsError, setContactsError] = useState("");
    const [contactSearch, setContactSearch] = useState("");
    const [teamUnreadCount, setTeamUnreadCount] = useState(0);
    const [selectedContactId, setSelectedContactId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [readError, setReadError] = useState("");
    const [sendError, setSendError] = useState("");
    const lastMessageId = useRef(0);
    const requestsInFlight = useRef(new Set());
    const messageList = useRef(null);
    const selectedContact = contacts.find(
        (contact) => contact.id === selectedContactId,
    );
    const conversationKey =
        mode === "team"
            ? "team"
            : selectedContactId
              ? `direct:${selectedContactId}`
              : "direct:none";
    const activeConversationKey = useRef(conversationKey);
    activeConversationKey.current = conversationKey;

    const syncUnreadSummary = useCallback((summary) => {
        if (!summary) return;
        const directUnreadCounts = summary.direct_unread_counts || {};
        const totalUnreadCount = Number(summary.total_unread_count) || 0;

        setTeamUnreadCount(Number(summary.team_unread_count) || 0);
        setContacts((current) =>
            current.map((contact) => ({
                ...contact,
                unread_count:
                    Number(directUnreadCounts[contact.id]) || 0,
            })),
        );
        window.dispatchEvent(
            new CustomEvent("chat-unread-updated", {
                detail: totalUnreadCount,
            }),
        );
    }, []);

    const loadContacts = useCallback(async (initial = false) => {
        if (initial) setContactsLoading(true);
        setContactsError("");
        try {
            const response = await api.get("/api/v1/chat/contacts");
            setContacts(response.data?.data || []);
            syncUnreadSummary(response.data?.meta);
        } catch (requestError) {
            setContactsError(
                requestError.response?.data?.message ||
                    "Daftar pengguna gagal dimuat. Coba muat ulang.",
            );
        } finally {
            if (initial) setContactsLoading(false);
        }
    }, [syncUnreadSummary]);

    const loadMessages = useCallback(
        async (initial = false) => {
            const isDirect = mode === "direct";
            if (isDirect && !selectedContactId) {
                if (initial) setLoading(false);
                return;
            }
            if (requestsInFlight.current.has(conversationKey)) return;
            requestsInFlight.current.add(conversationKey);
            const shouldScroll =
                initial ||
                !messageList.current ||
                messageList.current.scrollHeight -
                    messageList.current.scrollTop -
                    messageList.current.clientHeight <
                    80;

            try {
                const params = {
                    ...(isDirect ? { conversation_with: selectedContactId } : {}),
                    ...(lastMessageId.current
                        ? { after_id: lastMessageId.current }
                        : {}),
                };
                const response = await api.get("/api/v1/chat/messages", {
                    params,
                });
                if (activeConversationKey.current !== conversationKey) return;

                const incoming = response.data?.data || [];
                setError("");
                if (incoming.length) {
                    lastMessageId.current = Math.max(
                        lastMessageId.current,
                        ...incoming.map((message) => message.id),
                    );
                    setMessages((current) => {
                        const knownIds = new Set(
                            current.map((message) => message.id),
                        );

                        return [
                            ...current,
                            ...incoming.filter(
                                (message) => !knownIds.has(message.id),
                            ),
                        ];
                    });
                    if (shouldScroll) {
                        window.requestAnimationFrame(() => {
                            if (
                                activeConversationKey.current === conversationKey &&
                                messageList.current
                            ) {
                                messageList.current.scrollTop =
                                    messageList.current.scrollHeight;
                            }
                        });
                    }
                }
                if (initial || incoming.length) {
                    try {
                        const readResponse = await api.post(
                            "/api/v1/chat/read",
                            isDirect
                                ? { conversation_with: selectedContactId }
                                : {},
                        );
                        if (
                            activeConversationKey.current === conversationKey
                        ) {
                            setReadError("");
                            syncUnreadSummary(readResponse.data?.data);
                        }
                    } catch (readRequestError) {
                        if (
                            activeConversationKey.current === conversationKey
                        ) {
                            setReadError(
                                readRequestError.response?.data?.message ||
                                    "Status pesan belum dibaca gagal diperbarui.",
                            );
                        }
                    }
                }
            } catch (requestError) {
                if (activeConversationKey.current === conversationKey) {
                    setError(
                        requestError.response?.data?.message ||
                            "Pesan chat gagal dimuat. Coba muat ulang.",
                    );
                }
            } finally {
                requestsInFlight.current.delete(conversationKey);
                if (
                    initial &&
                    activeConversationKey.current === conversationKey
                ) {
                    setLoading(false);
                }
            }
        },
        [conversationKey, mode, selectedContactId, syncUnreadSummary],
    );

    useEffect(() => {
        loadContacts(true);
        const interval = window.setInterval(() => loadContacts(), 15000);

        return () => window.clearInterval(interval);
    }, [loadContacts]);

    useEffect(() => {
        setMessages([]);
        setBody("");
        setError("");
        setReadError("");
        setSendError("");
        lastMessageId.current = 0;
        setLoading(true);
        loadMessages(true);
        const interval = window.setInterval(() => loadMessages(), 8000);

        return () => window.clearInterval(interval);
    }, [conversationKey, loadMessages]);

    const sendMessage = async (event) => {
        event.preventDefault();
        const content = body.trim();
        if (!content || sending || (mode === "direct" && !selectedContact)) return;
        const sentInConversation = conversationKey;

        setSending(true);
        setSendError("");
        try {
            const response = await api.post("/api/v1/chat/messages", {
                body: content,
                ...(mode === "direct"
                    ? { recipient_id: selectedContact.id }
                    : {}),
            });
            const message = response.data?.data;
            if (
                message &&
                activeConversationKey.current === sentInConversation
            ) {
                lastMessageId.current = Math.max(lastMessageId.current, message.id);
                setMessages((current) => {
                    return current.some((item) => item.id === message.id)
                        ? current
                        : [...current, message];
                });
                setBody("");
                window.requestAnimationFrame(() => {
                    if (messageList.current) {
                        messageList.current.scrollTop =
                            messageList.current.scrollHeight;
                    }
                });
            }
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

    const filteredContacts = contacts.filter((contact) =>
        `${contact.name} ${contact.branch_name || ""}`
            .toLowerCase()
            .includes(contactSearch.trim().toLowerCase()),
    );

    return (
        <div className="space-y-6">
            <div className="welcome-row">
                <div>
                    <h2 className="text-xl font-bold text-white">Chat Internal</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Chat tim dan percakapan pribadi antar pengguna.
                    </p>
                </div>
                <button
                    type="button"
                    className="secondary-button"
                    onClick={() => loadMessages()}
                    disabled={loading || (mode === "direct" && !selectedContact)}
                >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    Muat Ulang
                </button>
            </div>

            <div className="panel max-w-5xl">
                <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
                    <button
                        type="button"
                        className={`${
                            mode === "team"
                                ? "primary-button"
                                : "secondary-button"
                        } relative`}
                        onClick={() => setMode("team")}
                        aria-pressed={mode === "team"}
                    >
                        <Users size={16} />
                        Chat Tim
                        {teamUnreadCount > 0 && (
                            <span className="notification-count absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">
                                {teamUnreadCount > 99 ? "99+" : teamUnreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={mode === "direct" ? "primary-button" : "secondary-button"}
                        onClick={() => setMode("direct")}
                        aria-pressed={mode === "direct"}
                    >
                        <MessageCircle size={16} />
                        Pesan Pribadi
                    </button>
                </div>

                <div className="flex min-h-[30rem] flex-col gap-4 md:flex-row">
                    {mode === "direct" && (
                        <aside className="flex w-full shrink-0 flex-col rounded-xl border border-slate-800 p-3 md:w-64">
                            <label className="relative">
                                <span className="sr-only">Cari pengguna</span>
                                <Search
                                    size={15}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                                />
                                <input
                                    type="search"
                                    className="form-input pl-9"
                                    placeholder="Cari pengguna..."
                                    value={contactSearch}
                                    onChange={(event) =>
                                        setContactSearch(event.target.value)
                                    }
                                />
                            </label>
                            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
                                {contactsLoading ? (
                                    <p className="px-2 py-4 text-sm text-slate-500">
                                        Memuat pengguna...
                                    </p>
                                ) : contactsError ? (
                                    <div className="space-y-2 px-2 py-3 text-sm text-rose-300">
                                        <p>{contactsError}</p>
                                        <button
                                            type="button"
                                            className="text-xs underline"
                                            onClick={loadContacts}
                                        >
                                            Coba lagi
                                        </button>
                                    </div>
                                ) : filteredContacts.length ? (
                                    filteredContacts.map((contact) => (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            className={`w-full rounded-lg px-3 py-2 text-left transition ${
                                                selectedContactId === contact.id
                                                    ? "bg-rose-500/10 text-rose-300"
                                                    : "text-slate-300 hover:bg-slate-800"
                                            }`}
                                            onClick={() =>
                                                setSelectedContactId(contact.id)
                                            }
                                            aria-pressed={
                                                selectedContactId === contact.id
                                            }
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                                            contact.is_online
                                                                ? "bg-emerald-500"
                                                                : "bg-slate-500"
                                                        }`}
                                                        aria-label={
                                                            contact.is_online
                                                                ? "Online"
                                                                : "Offline"
                                                        }
                                                        title={
                                                            contact.is_online
                                                                ? "Online"
                                                                : "Offline"
                                                        }
                                                    />
                                                    <span className="truncate text-sm font-medium">
                                                        {contact.name}
                                                    </span>
                                                </span>
                                                {contact.unread_count > 0 && (
                                                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                                                        {contact.unread_count > 99
                                                            ? "99+"
                                                            : contact.unread_count}
                                                    </span>
                                                )}
                                            </span>
                                            {contact.branch_name && (
                                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                                    {contact.branch_name}
                                                </span>
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <p className="px-2 py-4 text-center text-sm text-slate-500">
                                        {contactSearch
                                            ? "Pengguna tidak ditemukan."
                                            : "Belum ada pengguna lain yang dapat dihubungi."}
                                    </p>
                                )}
                            </div>
                        </aside>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="panel-title">
                                    {mode === "team"
                                        ? "Ruang Tim"
                                        : selectedContact?.name || "Pesan Pribadi"}
                                </h3>
                                <p className="panel-subtitle mt-1">
                                    {mode === "team"
                                        ? "Pesan tim · diperbarui setiap 8 detik"
                                        : selectedContact
                                          ? `${selectedContact.is_online ? "Online" : "Offline"} · ${selectedContact.branch_name || "Pengguna"} · percakapan pribadi`
                                          : "Pilih pengguna untuk memulai percakapan"}
                                </p>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
                                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {readError && (
                            <p className="mt-3 text-sm text-amber-300" role="alert">
                                {readError}
                            </p>
                        )}
                        <div
                            ref={messageList}
                            className="my-5 flex max-h-[28rem] min-h-64 flex-1 flex-col gap-3 overflow-y-auto pr-1"
                            aria-live="polite"
                            aria-label={
                                mode === "team"
                                    ? "Riwayat pesan tim"
                                    : `Riwayat pesan dengan ${selectedContact?.name || "pengguna"}`
                            }
                        >
                            {mode === "direct" && !selectedContact ? (
                                <p className="m-auto max-w-sm text-center text-sm text-slate-500">
                                    Pilih pengguna di daftar untuk melihat atau memulai pesan pribadi.
                                </p>
                            ) : loading ? (
                                <p className="m-auto text-sm text-slate-500">
                                    Memuat pesan...
                                </p>
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
                                                {message.is_mine
                                                    ? "Anda"
                                                    : message.sender_name}
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
                                    {mode === "team"
                                        ? "Belum ada pesan. Mulai percakapan tim di sini."
                                        : "Belum ada pesan pribadi. Kirim pesan pertama untuk memulai."}
                                </p>
                            )}
                        </div>
                        {sendError && (
                            <p className="mb-3 text-sm text-rose-300" role="alert">
                                {sendError}
                            </p>
                        )}
                        {(mode === "team" || selectedContact) && (
                            <form
                                className="flex items-end gap-3 border-t border-slate-800 pt-4"
                                onSubmit={sendMessage}
                            >
                                <label className="form-field flex-1">
                                    <span className="sr-only">Tulis pesan</span>
                                    <textarea
                                        className="form-input min-h-12 max-h-32 resize-y"
                                        placeholder={
                                            mode === "team"
                                                ? "Tulis pesan untuk tim..."
                                                : `Kirim pesan ke ${selectedContact.name}...`
                                        }
                                        value={body}
                                        maxLength={2000}
                                        onChange={(event) =>
                                            setBody(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" &&
                                                !event.shiftKey
                                            ) {
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
                        )}
                    </div>
                </div>
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
    canSelectBranch = false,
    defaultBranchId = "",
    canManageProduction = false,
    canManageDesigns = false,
    canManageInventory = false,
    canConsumeInventory = false,
    canManageHr = false,
    openOrderCreate = false,
    orderCreateMode = "invoice",
    openPaymentCreate = false,
    onOrderCreateOpened,
    onPaymentCreateOpened,
}) {
    const pages = {
        orders: (
            <Orders
                canCreate={canCreateOrder}
                canEdit={canEditOrder}
                canCreatePayment={canCreatePayment}
                canSelectBranch={canSelectBranch}
                defaultBranchId={defaultBranchId}
                autoOpenCreate={openOrderCreate}
                autoOpenCreateMode={orderCreateMode}
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
