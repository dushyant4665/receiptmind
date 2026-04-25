"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { getApiData, postApiData } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, X, Receipt, AlertTriangle, Info } from "lucide-react";

type ExceptionType = {
  id: string;
  type: string;
  type_label: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggested_action: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  receipt?: {
    id: string;
    vendor_name: string;
    amount: number;
    receipt_date: string;
    thumbnail: string;
  };
};

type ExceptionStats = {
  open_count: number;
  high_severity_count: number;
  low_confidence_count: number;
  duplicate_count: number;
  resolved_this_week: number;
  needs_attention: boolean;
};

const typeColors: Record<string, string> = {
  low_confidence: "bg-blue-100 text-blue-700",
  duplicate_suspected: "bg-amber-100 text-amber-700",
  amount_anomaly: "bg-red-100 text-red-700",
  missing_date: "bg-gray-100 text-gray-700",
  missing_vendor: "bg-gray-100 text-gray-700",
  policy_violation: "bg-purple-100 text-purple-700",
  unmatched_transaction: "bg-orange-100 text-orange-700",
  missing_receipt: "bg-pink-100 text-pink-700",
};

const severityIcons = {
  low: <Info className="h-4 w-4 text-blue-500" />,
  medium: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  high: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export default function ExceptionsPage() {
  const { data: session } = useSession();
  const [exceptions, setExceptions] = useState<ExceptionType[]>([]);
  const [stats, setStats] = useState<ExceptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("open");
  const [selectedType, setSelectedType] = useState<string>("");

  const fetchExceptions = async () => {
    if (!session?.accessToken) return;

    try {
      const params: Record<string, string> = { status: activeTab };
      if (selectedType) params.type = selectedType;
      
      const res = await getApiData<{ exceptions: ExceptionType[] }>("/exceptions", {
        authToken: session.accessToken,
        config: { params },
      });
      setExceptions(res.exceptions || []);
    } catch {
      toast.error("Failed to load exceptions");
    }
  };

  const fetchStats = async () => {
    if (!session?.accessToken) return;

    try {
      const res = await getApiData<ExceptionStats>("/exceptions/stats", {
        authToken: session.accessToken,
      });
      setStats(res);
    } catch {
      // Silent fail for stats
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchExceptions(), fetchStats()]).finally(() =>
      setLoading(false)
    );
  }, [session?.accessToken, activeTab, selectedType]);

  const handleResolve = async (id: string) => {
    if (!session?.accessToken) return;

    try {
      await postApiData(`/exceptions/${id}/resolve`, {}, {
        authToken: session.accessToken,
      });
      toast.success("Exception resolved");
      fetchExceptions();
      fetchStats();
    } catch {
      toast.error("Failed to resolve exception");
    }
  };

  const handleDismiss = async (id: string) => {
    if (!session?.accessToken) return;

    try {
      await postApiData(`/exceptions/${id}/dismiss`, {}, {
        authToken: session.accessToken,
      });
      toast.success("Exception dismissed");
      fetchExceptions();
      fetchStats();
    } catch {
      toast.error("Failed to dismiss exception");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="text-text-muted">Loading exceptions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Exceptions Inbox
        </h1>
        <p className="text-text-muted">
          Items that need your attention
        </p>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-muted">
                Open Exceptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-text-primary">
                {stats.open_count}
              </div>
              {stats.needs_attention && (
                <Badge variant="destructive" className="mt-2">
                  Needs attention
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-muted">
                High Severity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {stats.high_severity_count}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-muted">
                Low Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {stats.low_confidence_count}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-muted">
                Resolved This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.resolved_this_week}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open">
            Open ({stats?.open_count || 0})
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {exceptions.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-medium text-text-primary">
                All caught up!
              </h3>
              <p className="text-text-muted">
                No {activeTab} exceptions found. We will notify you when
                something needs attention.
              </p>
            </Card>
          ) : (
            exceptions.map((exc) => (
              <Card key={exc.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {severityIcons[exc.severity]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={typeColors[exc.type] || ""}
                        >
                          {exc.type_label}
                        </Badge>
                        <span className="text-xs text-text-ghost">
                          {new Date(exc.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-medium text-text-primary">
                        {exc.description}
                      </p>

                      {exc.suggested_action && (
                        <p className="mt-1 text-sm text-text-muted">
                          <span className="font-medium">Suggested action:</span>{" "}
                          {exc.suggested_action}
                        </p>
                      )}

                      {exc.receipt && (
                        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border-default bg-bg-surface p-3">
                          {exc.receipt.thumbnail ? (
                            <img
                              src={exc.receipt.thumbnail}
                              alt="Receipt"
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <Receipt className="h-10 w-10 text-text-ghost" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {exc.receipt.vendor_name || "Unknown vendor"}
                            </p>
                            <p className="text-xs text-text-muted">
                              ${exc.receipt.amount?.toFixed(2) || "0.00"} ·{" "}
                              {exc.receipt.receipt_date
                                ? new Date(
                                    exc.receipt.receipt_date
                                  ).toLocaleDateString()
                                : "No date"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {activeTab === "open" && (
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleResolve(exc.id)}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(exc.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
