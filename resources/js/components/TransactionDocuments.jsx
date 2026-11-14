import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../services/api";

const money = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const dateTime = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const date = (value) => {
    if (!value) return "-";

    const dateValue =
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00`
            : value;

    return new Date(dateValue).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
};

const paymentMethods = {
    cash: "Tunai",
    transfer: "Transfer Bank",
    qris: "QRIS",
    debit: "Kartu Debit",
    credit: "Kartu Kredit",
    other: "Lainnya",
};

const paymentStatuses = {
    unpaid: "Belum dibayar",
    partial: "Dibayar sebagian",
    paid: "Lunas",
};

function DocumentHeader({ documentType, number, branch }) {
    const [businessProfile, setBusinessProfile] = useState(null);
    const [profileError, setProfileError] = useState(false);

    useEffect(() => {
        let mounted = true;
        api.get("/api/v1/public/business-profile")
            .then((response) => {
                if (mounted) setBusinessProfile(response.data?.data || null);
            })
            .catch(() => {
                if (mounted) setProfileError(true);
            });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <header className="transaction-document__header">
            <div>
                <p className="transaction-document__brand">
                    {businessProfile?.business_name ||
                        (profileError ? "Profil usaha tidak tersedia" : "Memuat profil usaha...")}
                </p>
                <p className="transaction-document__tagline">
                    Printing Management System
                </p>
                {(businessProfile?.address ||
                    businessProfile?.phone ||
                    businessProfile?.email) && (
                    <div className="transaction-document__branch">
                        {businessProfile.address && <span>{businessProfile.address}</span>}
                        {businessProfile.phone && <span>Telp. {businessProfile.phone}</span>}
                        {businessProfile.email && <span>{businessProfile.email}</span>}
                    </div>
                )}
                {branch && (
                    <div className="transaction-document__branch">
                        <strong>{branch.name}</strong>
                        {branch.address && <span>{branch.address}</span>}
                        {branch.phone && <span>Telp. {branch.phone}</span>}
                    </div>
                )}
            </div>
            <div className="transaction-document__number">
                <p>{documentType}</p>
                <strong>{number}</strong>
            </div>
        </header>
    );
}

function DocumentParty({ title, name, address, phone, email }) {
    return (
        <section className="transaction-document__party">
            <p className="transaction-document__label">{title}</p>
            <strong>{name || "Pelanggan Umum"}</strong>
            {address && <span>{address}</span>}
            {phone && <span>{phone}</span>}
            {email && <span>{email}</span>}
        </section>
    );
}

function DocumentTotals({ order, isQuote = false }) {
    return (
        <div className="transaction-document__totals">
            <div>
                <span>Subtotal</span>
                <span>{money(order.subtotal)}</span>
            </div>
            <div>
                <span>Diskon</span>
                <span>-{money(order.discount)}</span>
            </div>
            <div className="transaction-document__total">
                <strong>{isQuote ? "Total penawaran" : "Total pesanan"}</strong>
                <strong>{money(order.total)}</strong>
            </div>
            {!isQuote && (
                <>
                    <div>
                        <span>Sudah dibayar</span>
                        <span>{money(order.paid_amount)}</span>
                    </div>
                    <div className="transaction-document__balance">
                        <strong>Sisa tagihan</strong>
                        <strong>{money(order.balance)}</strong>
                    </div>
                </>
            )}
        </div>
    );
}

function PrintDocumentPortal({ className = "", children }) {
    if (typeof document === "undefined") return null;

    return createPortal(
        <article
            className={`print-document ${className}`.trim()}
            aria-hidden="true"
        >
            {children}
        </article>,
        document.body,
    );
}

export function InvoicePrintDocument({ order, documentType = "INVOICE" }) {
    if (!order) return null;

    const customer = order.customer || {};
    const isQuote = documentType === "PENAWARAN HARGA";

    return (
        <PrintDocumentPortal className="print-document--invoice">
            <div className="transaction-document transaction-document--invoice">
                <DocumentHeader
                    documentType={documentType}
                    number={order.order_number}
                    branch={order.branch}
                />

                <div className="transaction-document__meta">
                    <DocumentParty
                        title="Ditagihkan kepada"
                        name={customer.name}
                        address={customer.address}
                        phone={customer.phone}
                        email={customer.email}
                    />
                    <div className="transaction-document__dates">
                        <div>
                            <span>{isQuote ? "Tanggal penawaran" : "Tanggal invoice"}</span>
                            <strong>{dateTime(order.created_at)}</strong>
                        </div>
                        <div>
                            <span>Jatuh tempo</span>
                            <strong>{date(order.due_date)}</strong>
                        </div>
                        <div>
                            <span>{isQuote ? "Status persetujuan" : "Status pembayaran"}</span>
                            <strong>
                                {isQuote
                                    ? order.quote_status === "approved"
                                        ? "Disetujui"
                                        : order.quote_status === "rejected"
                                          ? "Ditolak"
                                          : "Menunggu persetujuan"
                                    : paymentStatuses[order.payment_status] ||
                                      order.payment_status ||
                                      "-"}
                            </strong>
                        </div>
                    </div>
                </div>

                <table className="transaction-document__table">
                    <thead>
                        <tr>
                            <th>Deskripsi</th>
                            <th>Kuantitas</th>
                            <th>Harga satuan</th>
                            <th>Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(order.items || []).map((item, index) => {
                            const details = [
                                item.specifications,
                                item.width && item.height
                                    ? `${item.width} × ${item.height}`
                                    : null,
                                item.finishings?.length
                                    ? `Finishing: ${item.finishings
                                          .map((finishing) => finishing.finishing_name)
                                          .join(", ")}`
                                    : null,
                                item.notes,
                            ].filter(Boolean);

                            return (
                                <tr key={item.id || `${item.product_code}-${index}`}>
                                    <td>
                                        <strong>{item.product_name}</strong>
                                        {details.length > 0 && (
                                            <small>{details.join(" · ")}</small>
                                        )}
                                    </td>
                                    <td>
                                        {Number(item.quantity)}{" "}
                                        {item.unit_name || ""}
                                    </td>
                                    <td>{money(item.unit_price)}</td>
                                    <td>{money(item.subtotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <DocumentTotals order={order} isQuote={isQuote} />

                {order.notes && (
                    <div className="transaction-document__notes">
                        <strong>Catatan pesanan</strong>
                        <p>{order.notes}</p>
                    </div>
                )}

                <div className="transaction-document__signatures">
                    <div>
                        <span>Pelanggan</span>
                        <strong>{customer.name || "Pelanggan Umum"}</strong>
                    </div>
                    <div>
                        <span>Petugas</span>
                        <strong>{order.creator?.name || "Kasir"}</strong>
                    </div>
                </div>
                <footer className="transaction-document__footer">
                    {isQuote
                        ? "Penawaran ini menunggu persetujuan pelanggan. Pembayaran DP dapat diterima sebelum persetujuan, tetapi produksi menunggu persetujuan penawaran."
                        : "Mohon lakukan pembayaran sebelum tanggal jatuh tempo. Invoice ini merupakan dokumen penagihan untuk pesanan di atas."}
                </footer>
            </div>
        </PrintDocumentPortal>
    );
}

export function PaymentReceiptPrintDocument({ payment }) {
    if (!payment) return null;

    const order = payment.order || {};
    const customer = order.customer || {};

    return (
        <PrintDocumentPortal className="print-document--receipt">
            <div className="transaction-document transaction-document--receipt">
                <DocumentHeader
                    documentType="BUKTI PEMBAYARAN"
                    number={payment.payment_number}
                    branch={order.branch}
                />

                <div className="transaction-document__receipt-title">
                    <span>Pembayaran diterima</span>
                    <strong>{money(payment.amount)}</strong>
                </div>

                <div className="transaction-document__receipt-details">
                    <div>
                        <span>Tanggal</span>
                        <strong>{dateTime(payment.paid_at)}</strong>
                    </div>
                    <div>
                        <span>No. pesanan</span>
                        <strong>{order.order_number || "-"}</strong>
                    </div>
                    <div>
                        <span>Pelanggan</span>
                        <strong>{customer.name || "Pelanggan Umum"}</strong>
                    </div>
                    <div>
                        <span>Metode</span>
                        <strong>
                            {paymentMethods[payment.method] ||
                                payment.method ||
                                "-"}
                        </strong>
                    </div>
                    <div>
                        <span>No. referensi</span>
                        <strong>{payment.reference_number || "-"}</strong>
                    </div>
                    <div>
                        <span>Petugas</span>
                        <strong>{payment.receiver?.name || "Kasir"}</strong>
                    </div>
                </div>

                <div className="transaction-document__totals">
                    <div>
                        <span>Total pesanan</span>
                        <span>{money(order.total)}</span>
                    </div>
                    <div>
                        <span>Total dibayar</span>
                        <span>{money(order.paid_amount)}</span>
                    </div>
                    <div className="transaction-document__balance">
                        <strong>Sisa tagihan</strong>
                        <strong>{money(order.balance)}</strong>
                    </div>
                </div>

                {payment.notes && (
                    <div className="transaction-document__notes">
                        <strong>Catatan</strong>
                        <p>{payment.notes}</p>
                    </div>
                )}

                <footer className="transaction-document__footer">
                    Simpan bukti pembayaran ini sebagai referensi transaksi.
                    Status tagihan:{" "}
                    {paymentStatuses[order.payment_status] ||
                        order.payment_status ||
                        "-"}
                    .
                </footer>
            </div>
        </PrintDocumentPortal>
    );
}

export function PayrollSlipPrintDocument({ payroll }) {
    if (!payroll) return null;

    const employee = payroll.employee || {};
    const positiveItems = (payroll.items || []).filter(
        (item) => item.type !== "deduction",
    );
    const deductions = (payroll.items || []).filter(
        (item) => item.type === "deduction",
    );

    return (
        <PrintDocumentPortal className="print-document--invoice">
            <div className="transaction-document transaction-document--invoice">
                <DocumentHeader
                    documentType="SLIP GAJI"
                    number={`${employee.employee_code || "KARYAWAN"}-${payroll.period}`}
                    branch={employee.branch}
                />

                <div className="transaction-document__meta">
                    <DocumentParty
                        title="Data karyawan"
                        name={employee.name}
                    />
                    <div className="transaction-document__dates">
                        <div>
                            <span>Periode</span>
                            <strong>{payroll.period}</strong>
                        </div>
                        <div>
                            <span>Departemen</span>
                            <strong>{employee.department || "-"}</strong>
                        </div>
                        <div>
                            <span>Jabatan</span>
                            <strong>{employee.position || "-"}</strong>
                        </div>
                        <div>
                            <span>Status</span>
                            <strong>
                                {payroll.status === "paid" ? "Dibayar" : "Disetujui"}
                            </strong>
                        </div>
                    </div>
                </div>

                <table className="transaction-document__table">
                    <thead>
                        <tr>
                            <th>Komponen penghasilan</th>
                            <th>Nominal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Gaji pokok</strong></td>
                            <td>{money(payroll.base_salary)}</td>
                        </tr>
                        {positiveItems.map((item) => (
                            <tr key={item.id}>
                                <td>{item.type === "bonus" ? "Bonus" : "Tunjangan"} · {item.label}</td>
                                <td>{money(item.amount)}</td>
                            </tr>
                        ))}
                        {deductions.map((item) => (
                            <tr key={item.id}>
                                <td>Potongan · {item.label}</td>
                                <td>-{money(item.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="transaction-document__totals">
                    <div className="transaction-document__total">
                        <span>Total penghasilan</span>
                        <span>{money(payroll.total_earnings)}</span>
                    </div>
                    <div className="transaction-document__total">
                        <span>Total potongan</span>
                        <span>{money(payroll.total_deductions)}</span>
                    </div>
                    <div className="transaction-document__balance">
                        <strong>Gaji bersih</strong>
                        <strong>{money(payroll.net_pay)}</strong>
                    </div>
                </div>

                <div className="transaction-document__notes">
                    <strong>Persetujuan</strong>
                    <p>
                        Disetujui oleh {payroll.approver?.name || "HR"}
                        {payroll.approved_at ? ` pada ${dateTime(payroll.approved_at)}` : ""}.
                        {payroll.paid_at ? ` Pembayaran dicatat pada ${dateTime(payroll.paid_at)}.` : ""}
                    </p>
                </div>
                <footer className="transaction-document__footer">
                    Dokumen internal dan rahasia. Pajak serta BPJS tidak dihitung otomatis.
                </footer>
            </div>
        </PrintDocumentPortal>
    );
}
