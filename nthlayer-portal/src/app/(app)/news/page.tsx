"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  id: string;
  companyName: string;
  companyUrl: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

export default function NewsPage() {
  const [grouped, setGrouped] = useState<Record<string, NewsItem[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadNews = async () => {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setGrouped(data.grouped || {});
      setTotal(data.total || 0);
      const companies = Object.keys(data.grouped || {});
      if (companies.length > 0 && !activeTab) setActiveTab(companies[0]);
    } catch {
      setError("Could not load news feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/news/refresh", { method: "POST" });
      await loadNews();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const companies = Object.keys(grouped);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="h-4 bg-gray-100 rounded w-64" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitor News</h2>
          <p className="text-sm text-gray-400 mt-1">
            Daily news from public sources for your tracked competitors.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-12 text-center">
          <div className="mx-auto mb-4 w-fit rounded-md bg-emerald-50 p-3">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-4.5 5.25h4.5m2.25 2.25H6.75A2.25 2.25 0 014.5 15.75V5.25A2.25 2.25 0 016.75 3h5.586a1.5 1.5 0 011.06.44l3.415 3.414a1.5 1.5 0 01.439 1.061V15.75A2.25 2.25 0 0115 18h-4.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">No news yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Run a competitor teardown first. News is refreshed daily.
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Company tabs */}
          <div className="w-44 shrink-0 space-y-0.5">
            {companies.map((company) => (
              <button
                key={company}
                onClick={() => setActiveTab(company)}
                className={`w-full text-left px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  activeTab === company
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <div className="truncate">{company}</div>
                <div className="text-[10px] font-normal mt-0.5 opacity-60">
                  {grouped[company].length} articles
                </div>
              </button>
            ))}
          </div>

          {/* News list */}
          <div className="flex-1 min-w-0">
            {activeTab && grouped[activeTab] && (
              <div className="space-y-3">
                {grouped[activeTab].map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-gray-100 bg-white p-4 hover:border-emerald-200 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">
                          {item.title}
                        </p>
                        {item.summary && (
                          <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-300">
                          {item.source && <span className="font-medium text-gray-400">{item.source}</span>}
                          {item.source && item.publishedAt && <span>·</span>}
                          {item.publishedAt && <span>{timeAgo(item.publishedAt)}</span>}
                        </div>
                      </div>
                      <svg className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-emerald-400 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
