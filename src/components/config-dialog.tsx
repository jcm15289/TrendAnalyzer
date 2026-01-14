'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Clock, 
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface RedisInfo {
  key: string;
  filename: string;
  size: number;
  type: string;
  folder: string;
  uploaded: string;
  exists: boolean;
}

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywords: KeywordSet[];
  onAddKeyword: (keywordSet: KeywordSet) => void;
  onRemoveKeyword: (keywordSet: KeywordSet) => void;
}

export function ConfigDialog({ 
  open, 
  onOpenChange, 
  keywords, 
  onAddKeyword, 
  onRemoveKeyword 
}: ConfigDialogProps) {
  const [redisData, setRedisData] = useState<Record<string, RedisInfo>>({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Redis trends data (cache-trends:Trends.*)
      const redisResponse = await fetch('/api/trends/all');
      if (redisResponse.ok) {
        const result = await redisResponse.json();
        if (result.success && result.trends) {
          // Convert trends to RedisInfo format
          const redisDataMap: Record<string, RedisInfo> = {};
          result.trends.forEach((trend: any) => {
            redisDataMap[trend.keyword] = {
              key: trend.key,
              filename: trend.keyword,
              size: trend.data?.length || 0,
              type: 'trend',
              folder: 'cache-trends',
              uploaded: trend.timestamp || new Date().toISOString(),
              exists: true
            };
          });
          setRedisData(redisDataMap);
        }
      }
    } catch (error) {
      console.error('Error fetching config data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const redisCount = Object.keys(redisData).length;
  const sortedRedisKeys = Object.keys(redisData).sort();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-6">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Configuration & Cache Status
            </DialogTitle>
            <DialogDescription>
              View Redis trends data (cache-trends:Trends.*)
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 mb-4 flex-shrink-0">
            <Button onClick={fetchData} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-4">
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Redis Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-[#FF6B35]">{redisCount}</div>
                    <p className="text-xs text-muted-foreground">Trends in Redis cache</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Last Updated
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">
                      {redisCount > 0 && Object.values(redisData)[0]?.uploaded 
                        ? formatTimeAgo(Object.values(redisData)[0].uploaded)
                        : 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">Most recent trend</p>
                  </CardContent>
                </Card>
              </div>

              {/* Redis Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Redis Trends Data
                  </CardTitle>
                  <CardDescription>
                    All trends stored in Redis cache (cache-trends:Trends.*)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading Redis data...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.keys(redisData).length === 0 ? (
                        <p className="text-muted-foreground text-sm">No Redis trends data found</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {sortedRedisKeys.map((keyword) => {
                            const info = redisData[keyword];
                            return (
                              <div key={keyword} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">{info.filename || keyword}</h4>
                                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                      <p><span className="font-medium">Key:</span> <span className="font-mono text-[10px]">{info.key}</span></p>
                                      <p><span className="font-medium">Data Points:</span> {info.size || 0}</p>
                                      <p><span className="font-medium">Uploaded:</span> {formatTimeAgo(info.uploaded)}</p>
                                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                                        {new Date(info.uploaded).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                  {info.exists ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 ml-2" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
