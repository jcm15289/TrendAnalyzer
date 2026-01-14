"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database, Clock, FileText, RefreshCw, Download } from "lucide-react";
import { KeywordSet } from "@/lib/keywords";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CacheViewerProps {
  keywords: KeywordSet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CacheInfo {
  success: boolean;
  data?: any[];
  keywords?: string[];
  timestamp?: string;
  note?: string;
  source?: string;
  cacheKey?: string;
  error?: string;
  details?: string;
  rawContent?: string;
  metadata?: Record<string, any>;
}

interface CacheResult {
  keyword: string;
  result: CacheInfo;
}

export default function CacheViewer({
  keywords,
  open,
  onOpenChange,
}: CacheViewerProps) {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheResults, setCacheResults] = useState<CacheResult[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const fetchCacheData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch cache data for each keyword
      const fetchPromises = keywords.map(async (keyword) => {
        const response = await fetch(
          `/api/trends/redis?keywords=${encodeURIComponent(keyword)}`,
        );
        const result = await response.json();
        return { keyword, result };
      });

      const results = await Promise.all(fetchPromises);

      const successfulResults = results.filter((r) => r.result?.success);
      if (successfulResults.length > 0) {
        console.log(
          "[CacheViewer] Successful Redis responses:",
          successfulResults.map((r) => ({
            keyword: r.keyword,
            hasRaw: !!r.result.rawContent,
            points: r.result.data?.length ?? 0,
          })),
        );
        setCacheResults(successfulResults);
        setSelectedKeyword(successfulResults[0].keyword);
        setCacheInfo(successfulResults[0].result);
        if (successfulResults[0].result.rawContent) {
          console.log(
            "[CacheViewer] Raw dump preview:",
            successfulResults[0].result.rawContent.slice(0, 200),
          );
        } else {
          console.warn(
            "[CacheViewer] No rawContent returned for first successful keyword",
          );
        }
      } else {
        setCacheResults([]);
        setCacheInfo(null);
        setError("No cached data found for any of the keywords");
      }
    } catch (err) {
      console.error("Error fetching cache data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch cache data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCacheData();
    }
  }, [open, keywords]);

  useEffect(() => {
    if (!open) {
      setCacheResults([]);
      setSelectedKeyword(null);
      setCacheInfo(null);
    }
  }, [open]);

  const selectedResult = useMemo(() => {
    if (!cacheResults.length) return null;
    if (selectedKeyword) {
      const match = cacheResults.find((r) => r.keyword === selectedKeyword);
      if (match) {
        return match.result;
      }
    }
    return cacheResults[0].result;
  }, [cacheResults, selectedKeyword]);

  useEffect(() => {
    if (selectedResult) {
      setCacheInfo(selectedResult);
    }
  }, [selectedResult]);

  useEffect(() => {
    if (selectedKeyword) {
      console.log("[CacheViewer] Selected keyword changed:", selectedKeyword);
    }
  }, [selectedKeyword]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  };

  const getDataSize = (data: any[]) => {
    return JSON.stringify(data).length;
  };

  const displayKeyword = useMemo(() => {
    if (selectedKeyword) return selectedKeyword;
    if (cacheResults.length > 0) return cacheResults[0].keyword;
    return keywords[0];
  }, [selectedKeyword, cacheResults, keywords]);

  const triggerDownload = (
    content: string,
    filename: string,
    type = "text/plain",
  ) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadData = () => {
    if (!cacheInfo?.data) return;

    const dataStr = JSON.stringify(cacheInfo.data, null, 2);
    const fileBaseName = (
      selectedKeyword ||
      displayKeyword ||
      keywords[0] ||
      "cache"
    ).replace(/\s+/g, "-");
    triggerDownload(
      dataStr,
      `cache-${fileBaseName}-${new Date().toISOString().split("T")[0]}.json`,
      "application/json"
    );
  };

  const openRedisDump = () => {
    if (!cacheInfo?.rawContent) return;

    const blob = new Blob([cacheInfo.rawContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cached Search Interest Over Time
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-1">
              <span className="block">
                Keywords: {keywords.join(", ")} • Data from Redis cache
              </span>
              {cacheResults.length > 0 && (
                <span className="block text-xs text-muted-foreground/80">
                  Currently viewing: {displayKeyword}
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-hidden pr-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading cache information...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-600">
                <Database className="h-4 w-4" />
                <span className="font-medium">Cache Error</span>
              </div>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
          )}

          {cacheInfo && !loading && (
            <>
              <div className="space-y-4 pb-6 min-h-full">
                <div className="grid gap-4">
                  {/* Cache Status Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Database className="h-4 w-4" />
                        Cache Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={cacheInfo.success ? "default" : "destructive"}
                        >
                          {cacheInfo.success ? "Available" : "Not Found"}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Source: {cacheInfo.source || "Unknown"}
                        </span>
                      </div>

                      {cacheInfo.cacheKey && (
                        <div className="text-sm">
                          <span className="font-medium">Cache Key:</span>
                          <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs">
                            {cacheInfo.cacheKey}
                          </code>
                        </div>
                      )}

                      {cacheInfo.timestamp && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">
                              Redis Upload Time:
                            </span>
                            <span>{formatTimestamp(cacheInfo.timestamp)}</span>
                          </div>
                          {cacheInfo.metadata?.fileCreated && (
                            <div className="flex items-center gap-2 text-sm">
                              <Database className="h-4 w-4" />
                              <span className="font-medium">
                                Original Query Time:
                              </span>
                              <span>
                                {formatTimestamp(cacheInfo.metadata.fileCreated)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {cacheInfo.note && (
                        <div className="text-sm text-gray-600">
                          {cacheInfo.note}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Access Links */}
                  <Card>
                    <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4">
                      <div className="text-sm text-gray-600">
                        Access raw Redis payload or download structured data.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cacheInfo?.rawContent && (
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto text-blue-600"
                            onClick={openRedisDump}
                          >
                            <span className="flex items-center gap-2">
                              <Download className="h-4 w-4" />
                              Open Redis Dump
                            </span>
                          </Button>
                        )}
                        {cacheInfo?.data && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={downloadData}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download JSON
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Chart Display */}
                {cacheInfo.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Database className="h-4 w-4" />
                        Trend Chart
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={cacheInfo.data}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f0f0f0"
                            />
                            <XAxis dataKey="date" stroke="#666" fontSize={12} />
                            <YAxis
                              stroke="#666"
                              fontSize={12}
                              domain={[0, 100]}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #ccc",
                                borderRadius: "6px",
                                fontSize: "12px",
                              }}
                            />
                            <Legend />
                            {keywords.map((keyword, index) => {
                              const colors = [
                                "#3B82F6",
                                "#EF4444",
                                "#10B981",
                                "#F59E0B",
                                "#8B5CF6",
                              ];
                              return (
                                <Line
                                  key={keyword}
                                  type="monotone"
                                  dataKey={keyword}
                                  stroke={colors[index % colors.length]}
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={false}
                                />
                              );
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Data Information Card */}
                {cacheInfo.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-4 w-4" />
                        Data Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Data Points:</span>
                          <span className="ml-2">{cacheInfo.data.length}</span>
                        </div>
                        <div>
                          <span className="font-medium">Data Size:</span>
                          <span className="ml-2">
                            {getDataSize(cacheInfo.data).toLocaleString()} bytes
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Keywords:</span>
                          <span className="ml-2">
                            {cacheInfo.keywords?.join(", ") ||
                              keywords.join(", ")}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Date Range:</span>
                          <span className="ml-2">
                            {cacheInfo.data.length > 0 && (
                              <>
                                {cacheInfo.data[0].date} to{" "}
                                {cacheInfo.data[cacheInfo.data.length - 1].date}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Raw Data Preview */}
                {cacheInfo.data && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-4 w-4" />
                        Raw Data Preview
                        {cacheResults.length > 1
                          ? ` (${displayKeyword})`
                          : ""}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64 border rounded-lg p-4 bg-gray-50">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(cacheInfo.data.slice(0, 10), null, 2)}
                          {cacheInfo.data.length > 10 && (
                            <div className="text-gray-500 mt-2">
                              ... and {cacheInfo.data.length - 10} more data
                              points
                            </div>
                          )}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {/* Raw Redis File Dump */}
                {cacheInfo?.rawContent && (
                  <Card>
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-4 w-4" />
                        Redis File Dump
                      </CardTitle>
                      {cacheResults.length > 1 && (
                        <div className="w-full sm:w-auto">
                          <Select
                            value={displayKeyword}
                            onValueChange={(value) => setSelectedKeyword(value)}
                          >
                            <SelectTrigger className="w-full sm:w-[220px]">
                              <SelectValue placeholder="Select keyword" />
                            </SelectTrigger>
                            <SelectContent>
                              {cacheResults.map(({ keyword }) => (
                                <SelectItem key={keyword} value={keyword}>
                                  {keyword}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-blue-600"
                        onClick={openRedisDump}
                      >
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Open Redis Dump
                        </span>
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Error Information */}
                {cacheInfo.error && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-red-600">
                        <Database className="h-4 w-4" />
                        Error Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-red-600 font-medium">
                          {cacheInfo.error}
                        </p>
                        {cacheInfo.details && (
                          <p className="text-red-600 text-sm mt-1">
                            {cacheInfo.details}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              <ScrollBar orientation="vertical" />
            </>
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={fetchCacheData} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
