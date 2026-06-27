// src/pages/Analytics.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Analytics page — S2-BR-022 baseline metrics
//
// Business rules satisfied:
//   S2-BR-022  baseline metrics are stage counts and response tracking only
//   S2-BR-023  metric values computed from persisted job records, not UI state
//
// Layout:
//   1. Stat cards — total, active, response rate, offer rate
//   2. Bar chart (left) + Pipeline Flow (right)
//   3. Donut chart — click a slice to filter job list
//   4. Sankey diagram — click a node to filter job list
//   5. Job list — filterable by stage dropdown or chart clicks
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";

const BASE = import.meta.env.VITE_API_BASE_URL;

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_CONFIG = [
  { key: "interested", label: "Interested", color: "#9CA3AF" },
  { key: "applied", label: "Applied", color: "#046A97" },
  { key: "interview", label: "Interview", color: "#FF6138" },
  { key: "offer", label: "Offer", color: "#22c55e" },
  { key: "rejected", label: "Rejected", color: "#DC2626" },
  { key: "archived", label: "Archived", color: "#6B7280" },
];

const normalizeStage = (s) => s?.toLowerCase() ?? "interested";

function fromApi(job) {
  return {
    id: job.id,
    company: job.company ?? "",
    title: job.title ?? "",
    stage: normalizeStage(job.stage),
    lastActivity: (job.updated_at ?? job.created_at)?.split("T")[0] ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomTooltip
// ─────────────────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div
      style={{
        backgroundColor: "var(--bg-card,#fff)",
        border: "1px solid var(--color-border-default,#e5e7eb)",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "13px",
        color: "var(--color-heading,#003C78)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <strong>{name}</strong>: {value} job{value !== 1 ? "s" : ""}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, highlight }) {
  return (
    <div
      style={{
        backgroundColor: highlight ? "#003C78" : "var(--bg-card,#fff)",
        border: "1px solid var(--color-border-default,#e5e7eb)",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "var(--shadow)",
        flex: "1 1 160px",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: "12px",
          color: highlight ? "rgba(255,255,255,0.7)" : "var(--color-subtext,#6b7280)",
          margin: "0 0 8px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "36px",
          fontWeight: 700,
          color: highlight ? "white" : "var(--color-heading,#003C78)",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          style={{
            fontSize: "12px",
            color: highlight ? "rgba(255,255,255,0.6)" : "var(--color-subtext,#6b7280)",
            margin: "6px 0 0",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PipelineFlow
// ─────────────────────────────────────────────────────────────────────────────
function PipelineFlow({ counts, total }) {
  const funnelStages = STAGE_CONFIG.filter((s) =>
    ["interested", "applied", "interview", "offer"].includes(s.key)
  );
  return (
    <div
      style={{
        backgroundColor: "var(--bg-card,#fff)",
        border: "1px solid var(--color-border-default,#e5e7eb)",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: "var(--shadow)",
      }}
    >
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--color-heading,#003C78)",
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        Application Pipeline
      </h2>
      <p style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)", marginBottom: "28px" }}>
        How many applications made it through each stage.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {funnelStages.map((stage, i) => {
          const count = counts[stage.key] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const prev = i > 0 ? (counts[funnelStages[i - 1].key] ?? 0) : null;
          const dropOff =
            prev !== null && prev > 0 ? Math.round(((prev - count) / prev) * 100) : null;
          return (
            <div key={stage.key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-heading,#003C78)",
                  }}
                >
                  {stage.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {dropOff !== null && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#DC2626",
                        backgroundColor: "#FEE2E2",
                        borderRadius: "999px",
                        padding: "2px 8px",
                      }}
                    >
                      -{dropOff}% from prev
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--color-subtext,#6b7280)",
                      minWidth: "50px",
                      textAlign: "right",
                    }}
                  >
                    {count} job{count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div
                style={{
                  height: "12px",
                  borderRadius: "999px",
                  backgroundColor: "var(--color-border-default,#e5e7eb)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: stage.color,
                    borderRadius: "999px",
                    transition: "width 0.4s ease",
                    minWidth: count > 0 ? "8px" : "0",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: "24px",
          marginTop: "24px",
          paddingTop: "20px",
          borderTop: "1px solid var(--color-border-default,#e5e7eb)",
        }}
      >
        <p style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)", margin: 0 }}>
          <span style={{ color: "#DC2626", fontWeight: 700 }}>{counts.rejected ?? 0}</span> Rejected
        </p>
        <p style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)", margin: 0 }}>
          <span style={{ color: "#6B7280", fontWeight: 700 }}>{counts.archived ?? 0}</span> Archived
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DonutChart
// ─────────────────────────────────────────────────────────────────────────────
function DonutChart({ chartData, activeStage, onSliceClick }) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-card,#fff)",
        border: "1px solid var(--color-border-default,#e5e7eb)",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: "var(--shadow)",
      }}
    >
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading,#003C78)",
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        Stage Distribution
      </h2>
      <p style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)", marginBottom: "8px" }}>
        Click a slice to filter the job list below.
      </p>
      {activeStage && (
        <button
          onClick={() => onSliceClick(null)}
          style={{
            fontSize: "12px",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid var(--color-border-default,#e5e7eb)",
            backgroundColor: "transparent",
            color: "var(--color-subtext,#6b7280)",
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          ✕ Clear filter
        </button>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            dataKey="value"
            nameKey="name"
            paddingAngle={2}
            onClick={(data) => onSliceClick(data.key === activeStage ? null : data.key)}
            style={{ cursor: "pointer" }}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.key}
                fill={entry.color}
                opacity={activeStage && entry.key !== activeStage ? 0.4 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value} jobs`, name]}
            contentStyle={{
              backgroundColor: "var(--bg-card,#fff)",
              border: "1px solid var(--color-border-default,#e5e7eb)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Inline legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "12px 20px",
          marginTop: "8px",
        }}
      >
        {chartData.map((entry) => (
          <div
            key={entry.key}
            onClick={() => onSliceClick(entry.key === activeStage ? null : entry.key)}
            style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: entry.color,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-subtext,#6b7280)",
                fontWeight: activeStage === entry.key ? 700 : 400,
              }}
            >
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SankeyChart — computes layout with useMemo, no setState needed
// ─────────────────────────────────────────────────────────────────────────────
function SankeyChart({ counts, activeStage, onNodeClick }) {
  const svgRef = useRef(null);
  const [width, setWidth] = useState(600);
  const height = 320;

  // Get SVG width on mount
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const { width: w } = el.getBoundingClientRect();
    if (w > 0) setWidth(w);
  }, []);

  // Compute sankey layout — pure derivation, no setState
  const { paths, nodes } = useMemo(() => {
    const nodeList = [
      { id: "interested", label: "Interested", color: "#9CA3AF" },
      { id: "applied", label: "Applied", color: "#046A97" },
      { id: "interview", label: "Interview", color: "#FF6138" },
      { id: "offer", label: "Offer", color: "#22c55e" },
      { id: "rejected", label: "Rejected", color: "#DC2626" },
      { id: "archived", label: "Archived", color: "#6B7280" },
    ];

    const interested = counts.interested ?? 0;
    const applied = counts.applied ?? 0;
    const interview = counts.interview ?? 0;
    const offer = counts.offer ?? 0;
    const rejected = counts.rejected ?? 0;
    const archived = counts.archived ?? 0;

    const linkList = [];
    if (interested > 0 && applied > 0)
      linkList.push({ source: 0, target: 1, value: Math.min(applied, interested) });
    if (applied > 0 && interview > 0)
      linkList.push({ source: 1, target: 2, value: Math.min(interview, applied) });
    if (interview > 0 && offer > 0)
      linkList.push({ source: 2, target: 3, value: Math.min(offer, interview) });
    if (rejected > 0) linkList.push({ source: 1, target: 4, value: rejected });
    if (archived > 0) linkList.push({ source: 3, target: 5, value: archived });

    if (linkList.length === 0) return { paths: [], nodes: [] };

    try {
      const result = sankey()
        .nodeWidth(20)
        .nodePadding(24)
        .extent([
          [24, 16],
          [width - 24, height - 16],
        ])({
        nodes: nodeList.map((n) => ({ ...n })),
        links: linkList.map((l) => ({ ...l })),
      });
      return { paths: result.links, nodes: result.nodes };
    } catch (e) {
      console.warn("Sankey layout error:", e);
      return { paths: [], nodes: [] };
    }
  }, [counts, width]);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card,#fff)",
        border: "1px solid var(--color-border-default,#e5e7eb)",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: "var(--shadow)",
        marginBottom: "32px",
      }}
    >
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--color-heading,#003C78)",
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        Application Flow
      </h2>
      <p style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)", marginBottom: "20px" }}>
        How your applications flowed between stages. Click a stage to filter the job list.
      </p>

      {paths.length === 0 ? (
        <p style={{ color: "var(--color-subtext)", textAlign: "center", padding: "40px 0" }}>
          Add more applications across different stages to see the flow diagram.
        </p>
      ) : (
        <svg ref={svgRef} width="100%" height={height} style={{ overflow: "visible" }}>
          {paths.map((link, i) => (
            <path
              key={i}
              d={sankeyLinkHorizontal()(link)}
              fill="none"
              stroke={link.source.color ?? "#9CA3AF"}
              strokeWidth={Math.max(1, link.width ?? 4)}
              strokeOpacity={0.35}
            />
          ))}
          {nodes.map((node, i) => {
            const isActive = activeStage === node.id;
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? 20;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? 40;
            const nh = Math.max(y1 - y0, 4);
            const lx = x1 + 8;
            const onRight = x1 > width * 0.75;
            return (
              <g
                key={i}
                onClick={() => onNodeClick(node.id === activeStage ? null : node.id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={nh}
                  fill={node.color ?? "#9CA3AF"}
                  opacity={activeStage && !isActive ? 0.4 : 1}
                  rx={4}
                />
                {(counts[node.id] ?? 0) > 0 && (
                  <>
                    <text
                      x={onRight ? x0 - 8 : lx}
                      y={y0 + nh / 2}
                      textAnchor={onRight ? "end" : "start"}
                      dominantBaseline="middle"
                      fontSize="12"
                      fontWeight={isActive ? "700" : "500"}
                      fill="var(--color-heading,#003C78)"
                    >
                      {node.label}
                    </text>
                    <text
                      x={onRight ? x0 - 8 : lx}
                      y={y0 + nh / 2 + 14}
                      textAnchor={onRight ? "end" : "start"}
                      dominantBaseline="middle"
                      fontSize="11"
                      fill="var(--color-subtext,#6b7280)"
                    >
                      {counts[node.id] ?? 0} jobs
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {(counts.rejected > 0 || counts.archived > 0) && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "24px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border-default,#e5e7eb)",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {counts.rejected > 0 && (
            <span style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)" }}>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>{counts.rejected}</span> Rejected
            </span>
          )}
          {counts.archived > 0 && (
            <span style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)" }}>
              <span style={{ color: "#6B7280", fontWeight: 700 }}>{counts.archived}</span> Archived
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — main page
// ─────────────────────────────────────────────────────────────────────────────
function Analytics() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null);
  const [listFilter, setListFilter] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = await getToken({ skipCache: true });
        const res = await fetch(`${BASE}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setJobs(data.map(fromApi));
        }
      } catch (err) {
        console.error("Failed to fetch jobs for analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [getToken]);

  const counts = useMemo(() => {
    const c = {};
    STAGE_CONFIG.forEach((s) => (c[s.key] = 0));
    jobs.forEach((job) => {
      const k = normalizeStage(job.stage);
      if (k in c) c[k]++;
    });
    return c;
  }, [jobs]);

  const total = jobs.length;
  const active = (counts.interview ?? 0) + (counts.offer ?? 0);
  const responseRate =
    counts.applied > 0 ? Math.round(((counts.interview ?? 0) / counts.applied) * 100) : 0;
  const offerRate =
    counts.interview > 0 ? Math.round(((counts.offer ?? 0) / counts.interview) * 100) : 0;

  const chartData = STAGE_CONFIG.map((s) => ({
    name: s.label,
    count: counts[s.key] ?? 0,
    color: s.color,
  }));

  const donutData = STAGE_CONFIG.filter((s) => (counts[s.key] ?? 0) > 0).map((s) => ({
    key: s.key,
    name: s.label,
    value: counts[s.key] ?? 0,
    color: s.color,
  }));

  const handleChartFilter = (stageKey) => {
    setActiveStage(stageKey);
    setListFilter(stageKey ?? "");
  };

  const effectiveFilter = listFilter || activeStage || "";

  const filteredJobs = useMemo(() => {
    if (!effectiveFilter) return jobs;
    return jobs.filter((j) => j.stage === effectiveFilter);
  }, [jobs, effectiveFilter]);

  if (loading) {
    return (
      <div style={{ padding: "40px 60px", color: "var(--color-subtext)", fontSize: "14px" }}>
        Loading analytics...
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg,#F8FAFC)",
        minHeight: "100vh",
        padding: "40px 60px",
        maxWidth: "1100px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: "var(--color-heading,#003C78)",
          fontSize: "40px",
          fontWeight: 700,
          marginBottom: "8px",
          lineHeight: 1.2,
        }}
      >
        Analytics
      </h1>
      <p style={{ color: "var(--color-subtext,#6b7280)", fontSize: "16px", marginBottom: "32px" }}>
        View your stats, track your progress, and see where every application stands.
      </p>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "32px" }}>
        <StatCard label="Total Applications" value={total} highlight />
        <StatCard label="Active" value={active} sub="Interview + Offer" />
        <StatCard
          label="Response Rate"
          value={`${responseRate}%`}
          sub="Interviews per application"
        />
        <StatCard label="Offer Rate" value={`${offerRate}%`} sub="Offers per interview" />
      </div>

      {/* Bar chart + Pipeline */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--bg-card,#fff)",
            border: "1px solid var(--color-border-default,#e5e7eb)",
            borderRadius: "12px",
            padding: "28px",
            boxShadow: "var(--shadow)",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--color-heading,#003C78)",
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            Applications by Stage
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-subtext,#6b7280)",
              marginBottom: "24px",
            }}
          >
            Distribution across each stage.
          </p>
          {total === 0 ? (
            <p style={{ color: "var(--color-subtext)", textAlign: "center", padding: "40px 0" }}>
              No applications yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 32, left: 16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--color-border-default,#e5e7eb)"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "var(--color-subtext,#6b7280)" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ fontSize: 12, fill: "var(--color-heading,#003C78)", fontWeight: 500 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <PipelineFlow counts={counts} total={total} />
      </div>

      {/* Donut */}
      <div style={{ marginBottom: "32px" }}>
        <DonutChart
          chartData={donutData}
          activeStage={activeStage}
          onSliceClick={handleChartFilter}
        />
      </div>

      {/* Sankey */}
      <SankeyChart counts={counts} activeStage={activeStage} onNodeClick={handleChartFilter} />

      {/* Job list */}
      <div
        style={{
          backgroundColor: "var(--bg-card,#fff)",
          border: "1px solid var(--color-border-default,#e5e7eb)",
          borderRadius: "12px",
          padding: "28px",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--color-heading,#003C78)",
                margin: 0,
              }}
            >
              {effectiveFilter
                ? `${STAGE_CONFIG.find((s) => s.key === effectiveFilter)?.label} Jobs`
                : "All Jobs"}
            </h2>
            <p
              style={{ fontSize: "13px", color: "var(--color-subtext,#6b7280)", margin: "4px 0 0" }}
            >
              {filteredJobs.length} application{filteredJobs.length !== 1 ? "s" : ""}
              {effectiveFilter ? " in this stage" : " total"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={listFilter}
              onChange={(e) => {
                setListFilter(e.target.value);
                setActiveStage(e.target.value || null);
              }}
              aria-label="Filter job list by stage"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--color-border-default,#e5e7eb)",
                backgroundColor: "var(--bg,#F8FAFC)",
                color: "var(--color-heading,#003C78)",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <option value="">All Stages</option>
              {STAGE_CONFIG.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label} ({counts[s.key] ?? 0})
                </option>
              ))}
            </select>
            {effectiveFilter && (
              <button
                onClick={() => {
                  setActiveStage(null);
                  setListFilter("");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border-default,#e5e7eb)",
                  backgroundColor: "transparent",
                  color: "var(--color-subtext,#6b7280)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <p
            style={{
              color: "var(--color-subtext)",
              fontSize: "14px",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            No jobs in this stage yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {filteredJobs.map((job, i) => {
              const stageConf = STAGE_CONFIG.find((s) => s.key === job.stage);
              return (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/jobs/${job.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${job.title} at ${job.company}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: "8px",
                    borderLeft: `3px solid ${stageConf?.color ?? "#9CA3AF"}`,
                    backgroundColor: i % 2 === 0 ? "var(--bg,#F8FAFC)" : "var(--bg-card,#fff)",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "var(--color-heading,#003C78)",
                      }}
                    >
                      {job.title}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "13px",
                        color: "var(--color-subtext,#6b7280)",
                      }}
                    >
                      {job.company}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        backgroundColor: stageConf?.color ?? "#9CA3AF",
                        color: "white",
                        borderRadius: "999px",
                        padding: "3px 10px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {stageConf?.label ?? job.stage}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--color-subtext,#6b7280)",
                        minWidth: "80px",
                        textAlign: "right",
                      }}
                    >
                      {job.lastActivity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
