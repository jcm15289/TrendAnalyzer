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
  FileText, 
  Clock, 
  Upload, 
  Download, 
  Trash2, 
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { type KeywordSet } from '@/lib/keywords';

interface LocalFileInfo {
  filename: string;
  path: string;
  created: string;
  modified: string;
  size: number;
  exists: boolean;
}

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
  const [localFiles, setLocalFiles] = useState<Record<string, LocalFileInfo>>({});
  const [redisData, setRedisData] = useState<Record<string, RedisInfo>>({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch local files info
      const localResponse = await fetch('/api/config/local-files');
      if (localResponse.ok) {
        const localData = await localResponse.json();
        setLocalFiles(localData.files || {});
      }

      // Fetch Redis data info
      const redisResponse = await fetch('/api/config/redis-data');
      if (redisResponse.ok) {
        const redisData = await redisResponse.json();
        setRedisData(redisData.data || {});
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

  const handleRegenerateAll = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/regenerate-all-explanations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[ConfigDialog] Regeneration started:', result);
        alert(`Started regenerating ${result.count} explanations in the background. Check the console for progress.`);
      } else {
        const error = await response.json();
        console.error('[ConfigDialog] Regeneration failed:', error);
        alert(`Failed to start regeneration: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[ConfigDialog] Error triggering regeneration:', error);
      alert('Failed to start regeneration. Check the console for details.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const allKeywords = new Set([...Object.keys(localFiles), ...Object.keys(redisData)]);
  const sortedKeywords = Array.from(allKeywords).sort();

  const localCount = Object.keys(localFiles).length;
  const redisCount = Object.keys(redisData).length;
  const bothCount = Object.keys(localFiles).filter(key => redisData[key]).length;
  const localOnlyCount = localCount - bothCount;
  const redisOnlyCount = redisCount - bothCount;

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
              View Redis cache files and data status
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
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Local Files
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{localCount}</div>
                    <p className="text-xs text-muted-foreground">Cache files</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Redis Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{redisCount}</div>
                    <p className="text-xs text-muted-foreground">Uploaded data</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Synced
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-cyan-600">{bothCount}</div>
                    <p className="text-xs text-muted-foreground">Both local & Redis</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{localOnlyCount + redisOnlyCount}</div>
                    <p className="text-xs text-muted-foreground">Local only + Redis only</p>
                  </CardContent>
                </Card>
              </div>

              {/* Redis Files */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Redis Files ({Object.keys(redisData).length})
                  </CardTitle>
                  <CardDescription>
                    Files stored in Redis cache (cache-trends:Trends.*)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {Object.keys(redisData).length === 0 && !loading && (
                      <p className="text-muted-foreground text-sm">No Redis files found</p>
                    )}
                    {Object.entries(redisData)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, info]: [string, RedisInfo], index) => (
                        <div key={key} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{info.filename || key}</div>
                            <div className="text-xs text-muted-foreground">
                              Size: {formatFileSize(info.size || 0)}
                              {info.uploaded && (
                                <span className="ml-2">• Uploaded {formatTimeAgo(info.uploaded)}</span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0">
                            {key.replace('cache-trends:Trends.', '')}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Cache Status Details
                  </CardTitle>
                  <CardDescription>
                    Detailed comparison between local files and Redis data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sortedKeywords.map((keyword) => {
                      const local = localFiles[keyword];
                      const redis = redisData[keyword];
                      
                      return (
                        <div key={keyword} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-lg">{keyword.toUpperCase()}</h4>
                            <div className="flex gap-2">
                              {local && redis ? (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Synced
                                </Badge>
                              ) : local ? (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Local Only
                                </Badge>
                              ) : redis ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                  <Database className="h-3 w-3 mr-1" />
                                  Redis Only
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Local File Info */}
                            <div className="space-y-2">
                              <h5 className="font-medium text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Local File
                              </h5>
                              {local ? (
                                <div className="space-y-1 text-sm">
                                  <p><span className="font-medium">File:</span> {local.filename}</p>
                                  <p><span className="font-medium">Size:</span> {formatFileSize(local.size)}</p>
                                  <p><span className="font-medium">Created:</span> {new Date(local.created).toLocaleString()}</p>
                                  <p><span className="font-medium">Modified:</span> {new Date(local.modified).toLocaleString()}</p>
                                  <p className="text-muted-foreground">({formatTimeAgo(local.modified)})</p>
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">No local file found</p>
                              )}
                            </div>

                            {/* Redis Info */}
                            <div className="space-y-2">
                              <h5 className="font-medium text-sm flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Redis Data
                              </h5>
                              {redis ? (
                                <div className="space-y-1 text-sm">
                                  <p><span className="font-medium">Key:</span> {redis.key}</p>
                                  <p><span className="font-medium">Size:</span> {formatFileSize(redis.size)}</p>
                                  <p><span className="font-medium">Uploaded:</span> {new Date(redis.uploaded).toLocaleString()}</p>
                                  <p className="text-muted-foreground">({formatTimeAgo(redis.uploaded)})</p>
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">Not uploaded to Redis</p>
                              )}
                            </div>
                          </div>

                          {/* Time Gap Analysis */}
                          {local && redis && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Time Gap:</span>
                                <span>
                                  {(() => {
                                    const fileModified = new Date(local.modified);
                                    const redisUpload = new Date(redis.uploaded);
                                    const timeDiff = redisUpload.getTime() - fileModified.getTime();
                                    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                                    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                                    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                                    return `${hours}h ${minutes}m ${seconds}s`;
                                  })()}
                                </span>
                                <span className="text-muted-foreground">from file modification to upload</span>
                              </div>
                              {local.size === redis.size ? (
                                <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                                  <CheckCircle className="h-4 w-4" />
                                  File sizes match
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
                                  <XCircle className="h-4 w-4" />
                                  File sizes don't match
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
