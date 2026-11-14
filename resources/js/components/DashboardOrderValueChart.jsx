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
                            stopColor="var(--mohan-red)"
                            stopOpacity={0.32}
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--mohan-red)"
                            stopOpacity={0}
                        />
                    </linearGradient>
                </defs>
                <CartesianGrid
                    stroke="var(--mohan-grid)"
                    strokeDasharray="4 4"
                    vertical={false}
                />
                <XAxis
                    dataKey="date"
                    stroke="var(--mohan-axis)"
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
                    stroke="var(--mohan-axis)"
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
                        background: "var(--mohan-card)",
                        border: "1px solid var(--mohan-border)",
                        borderRadius: "10px",
                        color: "var(--mohan-text)",
                    }}
                    formatter={(value) => [formatRupiah(value), "Nilai pesanan"]}
                />
                <Area
                    type="monotone"
                    dataKey="order_value"
                    stroke="var(--mohan-red)"
                    strokeWidth={2.5}
                    fill="url(#adminOrderValueGradient)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
