"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type WindowStats = {
  conversations: number;
  visitors: number;
  with_messages: number;
  messages: number;
};

type RecentConversation = {
  id: string;
  visitor_name: string;
  mode: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  is_active: boolean;
  message_count: number;
  preview: {
    visitor: string;
    twin: string;
  };
};

type AdminStats = {
  generated_at: string;
  windows: {
    last_hour: WindowStats;
    last_24_hours: WindowStats;
    last_7_days: WindowStats;
  };
  totals: {
    loaded_conversations: number;
    active_conversations: number;
    distinct_visitors_7_days: number;
  };
  recent: RecentConversation[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Open";
  }

  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}

function MetricCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadStats(nextPassword = savedPassword) {
    if (!nextPassword) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/stats", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password: nextPassword }),
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Unable to load dashboard.");
      }

      setStats(data as AdminStats);
      setSavedPassword(nextPassword);
      window.sessionStorage.setItem("martin-admin-password", nextPassword);
    } catch (caughtError) {
      setStats(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadStats(password);
  }

  useEffect(() => {
    const storedPassword = window.sessionStorage.getItem("martin-admin-password") ?? "";
    if (storedPassword) {
      setPassword(storedPassword);
      setSavedPassword(storedPassword);
      void loadStats(storedPassword);
    }
  }, []);

  const lastUpdated = useMemo(() => (stats ? formatDate(stats.generated_at) : ""), [stats]);

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-header">
          <div>
            <p>Martin Virtual Twin</p>
            <h1>Visitor Dashboard</h1>
          </div>
          {stats ? (
            <button type="button" onClick={() => void loadStats()} disabled={isLoading}>
              {isLoading ? "Refreshing" : "Refresh"}
            </button>
          ) : null}
        </header>

        {!stats ? (
          <form className="admin-login" onSubmit={submitPassword}>
            <h2>Admin Access</h2>
            <p>Enter the dashboard password configured in Vercel.</p>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Dashboard password"
            />
            <button type="submit" disabled={!password || isLoading}>
              {isLoading ? "Checking" : "Open Dashboard"}
            </button>
            {error ? <p className="admin-error">{error}</p> : null}
          </form>
        ) : (
          <>
            <section className="admin-grid" aria-label="Visitor statistics">
              <MetricCard label="Last hour" value={stats.windows.last_hour.visitors} detail={`${stats.windows.last_hour.conversations} conversations`} />
              <MetricCard label="Last 24 hours" value={stats.windows.last_24_hours.visitors} detail={`${stats.windows.last_24_hours.messages} messages`} />
              <MetricCard label="Last 7 days" value={stats.windows.last_7_days.visitors} detail={`${stats.windows.last_7_days.with_messages} active chats`} />
              <MetricCard label="Open sessions" value={stats.totals.active_conversations} detail={`${stats.totals.loaded_conversations} records loaded`} />
            </section>

            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Recent Conversations</h2>
                <span>Updated {lastUpdated}</span>
              </div>

              {stats.recent.length ? (
                <div className="admin-table">
                  {stats.recent.map((conversation) => (
                    <article className="admin-row" key={conversation.id}>
                      <div>
                        <strong>{conversation.visitor_name}</strong>
                        <span>{conversation.mode}</span>
                      </div>
                      <div>
                        <span>{formatDate(conversation.created_at)}</span>
                        <span>{conversation.is_active ? "Active" : `Ended ${formatDate(conversation.ended_at)}`}</span>
                      </div>
                      <div>
                        <span>{conversation.message_count} messages</span>
                        <p>{conversation.preview.visitor || "No visitor message yet"}</p>
                        <p>{conversation.preview.twin || "No twin response yet"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">No conversations found in the last 7 days.</p>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
