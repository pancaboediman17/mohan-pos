import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

export default function DashboardOrderValueChart({
    data,
    dateLabel,
    formatRupiah,
}) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient
                        id="adminOrderValueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor="#1479FF"
                            stopOpacity={0.32}
                        />
                        <stop
                            offset="100%"
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
                    dataKey="date"
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickFormatter={(value) =>
                        dateLabel(value, {
                            day: "numeric",
                            month: "short",
                        })
                    }
                />
                <YAxis
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(value) =>
                        new Intl.NumberFormat("id-ID", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                        }).format(value)
                    }
                />
                <Tooltip
                    labelFormatter={(value) =>
                        dateLabel(value, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                        })
                    }
                    contentStyle={{
                        background: "#111827",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        color: "#fff",
                    }}
                    formatter={(value) => [formatRupiah(value), "Nilai pesanan"]}
                />
                <Area
                    type="monotone"
                    dataKey="order_value"
                    stroke="#1479FF"
                    strokeWidth={2.5}
                    fill="url(#adminOrderValueGradient)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
