import { motion } from "framer-motion";
import { CheckCircle2, Database, Server, Workflow } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type HealthResponse = {
  service: string;
  environment: string;
  status: string;
  database: string;
};

const setupCards = [
  { label: "Flask API", value: "Initialized", icon: Server },
  { label: "PostgreSQL", value: "Configured", icon: Database },
  { label: "React Shell", value: "Routed", icon: Workflow },
];

export function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    api
      .get<HealthResponse>("/health")
      .then((response) => setHealth(response.data))
      .catch(() =>
        setHealth({
          service: "bizzbot-api",
          environment: "development",
          status: "offline",
          database: "unavailable",
        }),
      );
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace Status</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">
              Welcome, {user?.fullName ?? "builder"}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium">
            <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
            {health?.status ?? "checking"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {setupCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className="rounded-lg border border-border bg-card p-5 shadow-panel"
          >
            <card.icon size={20} className="text-primary" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
          </motion.div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Runtime</h3>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Service</dt>
            <dd className="font-medium">{health?.service ?? "checking"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Environment</dt>
            <dd className="font-medium">{health?.environment ?? "checking"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">API</dt>
            <dd className="font-medium">{health?.status ?? "checking"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Database</dt>
            <dd className="font-medium">{health?.database ?? "checking"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
