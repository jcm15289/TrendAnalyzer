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

interface AllSymsData {
  key: string;
  content: string;
  lines: string[];
  lineCount: number;
  size: number;
  metadata: any;
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
  const [allSymsData, setAllSymsData] = useState<AllSymsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAllSyms, setLoadingAllSyms] = useState(false);

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

  const fetchAllSyms = async () => {
    setLoadingAllSyms(true);
    try {
      const response = await fetch('/api/redis/allsyms');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAllSymsData(data);
        } else {
          setAllSymsData(null);
        }
      } else {
        setAllSymsData(null);
      }
    } catch (error) {
      console.error('Error fetching ALLSYMS:', error);
      setAllSymsData(null);
    } finally {
      setLoadingAllSyms(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
      fetchAllSyms();
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
            <Button onClick={() => { fetchData(); fetchAllSyms(); }} disabled={loading || loadingAllSyms} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading || loadingAllSyms ? 'animate-spin' : ''}`} />
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

              {/* ALLSYMS File */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ALLSYMS File
                  </CardTitle>
                  <CardDescription>
                    Financial scan symbols file from Redis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAllSyms ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading ALLSYMS...</span>
                    </div>
                  ) : allSymsData ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Redis Key: {allSymsData.key}</p>
                          <p className="text-xs text-muted-foreground">
                            Size: {formatFileSize(allSymsData.size)} • {allSymsData.lineCount} lines
                          </p>
                        </div>
                        <Button onClick={fetchAllSyms} size="sm" variant="outline">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                      </div>
                      <div className="border rounded-lg p-4 bg-muted/50 max-h-[500px] overflow-y-auto">
                        <div className="font-mono text-xs space-y-1">
                          {allSymsData.lines.map((line, index) => (
                            <div key={index} className="hover:bg-background/50 px-2 py-1 rounded">
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">ALLSYMS file not found in Redis</p>
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
