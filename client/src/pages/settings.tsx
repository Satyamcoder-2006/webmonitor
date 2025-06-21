import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, Globe, Shield, Database, Zap, AlertTriangle, Settings2, RefreshCw, Trash2 } from "lucide-react";

interface SystemSettings {
  emailSettings: {
    smtpConfigured: boolean;
    fromEmail: string;
    testEmailAddress: string;
  };
  monitoringSettings: {
    checkInterval: number;
    timeout: number;
    retries: number;
    realTimeEnabled: boolean;
  };
  alertSettings: {
    emailAlerts: boolean;
    immediateAlerts: boolean;
    alertCooldown: number;
  };
  systemInfo: {
    version: string;
    uptime: string;
    totalSites: number;
    totalChecks: number;
    lastRestart: string;
  };
  compressionInterval?: string;
  retentionPeriod?: string;
  compressionValue?: number;
  compressionUnit?: string;
  retentionValue?: number;
  retentionUnit?: string;
  retentionScheduleValue?: number;
  retentionScheduleUnit?: string;
}

// Helper to convert interval to minutes
function intervalToMinutes(value: number, unit: string): number {
  switch (unit) {
    case 'minutes': return value;
    case 'hours': return value * 60;
    case 'days': return value * 1440;
    default: return value;
  }
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("email");
  const [testEmail, setTestEmail] = useState("");

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
    refetchInterval: 10000,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      await apiRequest("PUT", "/api/settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("POST", "/api/test-email", { email });
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: "Check your inbox for the test email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send test email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const restartMonitoringMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/monitoring/restart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Monitoring restarted",
        description: "The monitoring system has been restarted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to restart monitoring",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearDataMutation = useMutation({
    mutationFn: async (dataType: string) => {
      await apiRequest("DELETE", `/api/system/clear/${dataType}`);
    },
    onSuccess: (_, dataType) => {
      queryClient.invalidateQueries();
      toast({
        title: "Data cleared",
        description: `${dataType} data has been cleared successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to clear data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Local state for compression/retention
  const [compressionValue, setCompressionValue] = useState(settings?.compressionValue ?? 10);
  const [compressionUnit, setCompressionUnit] = useState(settings?.compressionUnit ?? 'minutes');
  const [retentionValue, setRetentionValue] = useState(settings?.retentionValue ?? 90);
  const [retentionUnit, setRetentionUnit] = useState(settings?.retentionUnit ?? 'days');
  const [retentionScheduleValue, setRetentionScheduleValue] = useState(settings?.retentionScheduleValue ?? 1);
  const [retentionScheduleUnit, setRetentionScheduleUnit] = useState(settings?.retentionScheduleUnit ?? "days");
  const [saving, setSaving] = useState(false);

  const chunkSizeMinutes = 7 * 24 * 60; // 7 days in minutes

  const handleSaveCompressionRetention = async () => {
    // Validation logic
    const bufferFlushMinutes = 5; // Buffer flushes every 5 minutes
    const compressionMinutes = intervalToMinutes(compressionValue, compressionUnit);
    const retentionMinutes = intervalToMinutes(retentionValue, retentionUnit);
    const retentionScheduleMinutes = intervalToMinutes(retentionScheduleValue, retentionScheduleUnit);

    if (compressionMinutes < bufferFlushMinutes) {
      toast({
        title: 'Invalid Compression Interval',
        description: 'Compression interval cannot be less than 5 minutes (the buffer flush interval).',
        variant: 'destructive',
      });
      return;
    }
    if (compressionMinutes > retentionMinutes) {
      toast({
        title: 'Invalid Compression Interval',
        description: 'Compression interval cannot be greater than the retention period.',
        variant: 'destructive',
      });
      return;
    }
    if (retentionScheduleMinutes < 1) {
      toast({
        title: 'Invalid Retention Schedule',
        description: 'Retention schedule cannot be less than 1 minute.',
        variant: 'destructive',
      });
      return;
    }
    if (retentionScheduleMinutes > retentionMinutes) {
      toast({
        title: 'Invalid Retention Schedule',
        description: 'Retention schedule cannot be greater than the retention period.',
        variant: 'destructive',
      });
      return;
    }
    if (retentionMinutes < chunkSizeMinutes) {
      toast({
        title: 'Invalid Retention Period',
        description: 'Retention period must be greater than or equal to the chunk size (currently 7 days).',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await updateSettingsMutation.mutateAsync({
        compressionValue,
        compressionUnit,
        retentionValue,
        retentionUnit,
        retentionScheduleValue,
        retentionScheduleUnit,
      });
      toast({ title: 'Settings updated', description: 'Compression, retention, and retention schedule settings saved.' });
    } catch (error: any) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setCompressionValue(settings.compressionValue ?? 10);
      setCompressionUnit(settings.compressionUnit ?? "minutes");
      setRetentionValue(settings.retentionValue ?? 90);
      setRetentionUnit(settings.retentionUnit ?? "days");
      setRetentionScheduleValue(settings.retentionScheduleValue ?? 1);
      setRetentionScheduleUnit(settings.retentionScheduleUnit ?? "days");
    }
  }, [settings]);

  if (isLoading || !settings) {
    return (
      <div className="space-y-6 p-4">
        <div className="glass-card rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
        <div className="grid gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-200/50 dark:bg-gray-700/50 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded" />
                <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6">
      {/* Header and Real-time Status */}
      <div className="glass-card rounded-lg p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Settings</h1>
        <Badge variant="outline" className="glass-button text-sm bg-green-500/10 text-green-500 border-green-500/20 dark:bg-green-400/10 dark:text-green-400 dark:border-green-400/20">
          <Zap className="h-3 w-3 mr-1 text-green-500 dark:text-green-400" />
          <span className="text-green-500 dark:text-green-400">Real-time monitoring active</span>
        </Badge>
      </div>

      {/* System Information */}
      <div className="glass-card rounded-lg p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50 space-y-6">
        <h2 className="text-xl font-semibold flex items-center text-blue-600 dark:text-blue-400">
          <Database className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
          System Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm text-gray-600 dark:text-gray-400">Uptime</Label>
            <p className="font-medium text-green-600 dark:text-green-400">{settings.systemInfo.uptime}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600 dark:text-gray-400">Total Sites</Label>
            <p className="font-medium text-gray-900 dark:text-white">{settings.systemInfo.totalSites}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600 dark:text-gray-400">Total Checks</Label>
            <p className="font-medium text-gray-900 dark:text-white">{settings.systemInfo.totalChecks}</p>
          </div>
        </div>
        <Separator className="bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-gray-600 dark:text-gray-400">Last Restart</Label>
            <p className="font-medium text-gray-900 dark:text-white">
              {settings.systemInfo.lastRestart ? new Date(settings.systemInfo.lastRestart).toLocaleString() : 'N/A'}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => restartMonitoringMutation.mutate()} 
            disabled={restartMonitoringMutation.isPending}
            className="glass-button text-blue-600 dark:text-blue-400 border-blue-600/50 dark:border-blue-400/50 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <RefreshCw className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-600 dark:text-blue-400">Restart Monitoring</span>
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="glass-card rounded-lg p-6 shadow-lg border border-gray-200/50 dark:border-gray-700/50">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100/50 dark:bg-gray-800/50 backdrop-filter backdrop-blur-sm rounded-lg p-1">
          <TabsTrigger 
            value="email" 
            className="text-gray-900 dark:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm rounded-md transition-colors duration-200"
          >
            <Mail className="h-4 w-4 mr-2" /> 
            <span>Email</span>
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="text-gray-900 dark:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm rounded-md transition-colors duration-200"
          >
            <Settings2 className="h-4 w-4 mr-2" /> 
            <span>System</span>
          </TabsTrigger>
        </TabsList>

        {/* Email Settings Tab */}
        <TabsContent value="email" className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold flex items-center text-blue-600 dark:text-blue-400">
            <Mail className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" /> Email Settings
          </h2>
          <div className="space-y-4">
            <div className="glass-card rounded-lg p-4">
              <Label htmlFor="fromEmail" className="text-gray-900 dark:text-white">From Email Address</Label>
              <Input
                id="fromEmail"
                value={settings.emailSettings.fromEmail}
                onChange={(e) =>
                  updateSettingsMutation.mutate({
                    emailSettings: {
                      ...settings.emailSettings,
                      fromEmail: e.target.value,
                    },
                  })
                }
                placeholder="noreply@example.com"
                className="glass-button text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
            <div className="glass-card rounded-lg p-4">
              <Label htmlFor="testEmail" className="text-gray-900 dark:text-white">Send Test Email</Label>
              <div className="flex space-x-2">
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="glass-button text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
                <Button
                  onClick={() => testEmailMutation.mutate(testEmail)}
                  disabled={testEmailMutation.isPending || !testEmail}
                  className="glass-button text-blue-600 dark:text-blue-400 border-blue-600/50 dark:border-blue-400/50 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  Send Test
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* System Management Tab */}
        <TabsContent value="system" className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold flex items-center text-blue-600 dark:text-blue-400">
            <Settings2 className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" /> System Management
          </h2>

          {/* Compression & Retention Settings */}
          <div className="glass-card rounded-lg p-4 mb-4">
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Compression & Retention</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="compressionValue" className="text-gray-900 dark:text-white">Compression Interval</Label>
                <div className="flex gap-2">
                  <Input
                    id="compressionValue"
                    type="number"
                    min={1}
                    value={compressionValue}
                    onChange={e => setCompressionValue(Number(e.target.value))}
                    className="glass-button w-24 text-gray-900 dark:text-white"
                  />
                  <Select value={compressionUnit} onValueChange={setCompressionUnit}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="retentionValue" className="text-gray-900 dark:text-white">Retention Period</Label>
                <div className="flex gap-2">
                  <Input
                    id="retentionValue"
                    type="number"
                    min={1}
                    value={retentionValue}
                    onChange={e => setRetentionValue(Number(e.target.value))}
                    className="glass-button w-24 text-gray-900 dark:text-white"
                  />
                  <Select value={retentionUnit} onValueChange={setRetentionUnit}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="retentionScheduleValue" className="text-gray-900 dark:text-white">Retention Schedule</Label>
                <div className="flex gap-2">
                  <Input
                    id="retentionScheduleValue"
                    type="number"
                    min={1}
                    value={retentionScheduleValue}
                    onChange={e => setRetentionScheduleValue(Number(e.target.value))}
                    className="glass-button w-24 text-gray-900 dark:text-white"
                  />
                  <Select value={retentionScheduleUnit} onValueChange={setRetentionScheduleUnit}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button onClick={handleSaveCompressionRetention} disabled={saving} className="mt-4 glass-button text-blue-600 dark:text-blue-400 border-blue-600/50 dark:border-blue-400/50">
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Adjust how long data is kept and how often it is compressed. Example: 10 minutes, 1 hour, 90 days.
            </p>
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-lg p-4">
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Clear Data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Permanently delete historical monitoring logs or all website data. This action cannot be undone.
              </p>
              <div className="flex flex-col space-y-3">
                <Button
                  variant="destructive"
                  onClick={() => clearDataMutation.mutate("logs")}
                  disabled={clearDataMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Clear All Monitoring Logs
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => clearDataMutation.mutate("websites")}
                  disabled={clearDataMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Clear All Websites & Data
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
