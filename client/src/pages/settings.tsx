import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Mail, Clock, Globe, Shield, Database, Zap, AlertTriangle, Settings2 } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";

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
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("monitoring");
  const [testEmail, setTestEmail] = useState("");

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
    refetchInterval: 10000,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<SystemSettings>) => {
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

  if (isLoading || !settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <div className="grid gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Badge variant="outline" className="text-sm">
              <Zap className="h-3 w-3 mr-1" />
              Real-time monitoring active
            </Badge>
          </div>

          {/* System Information */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Version</Label>
                  <p className="font-medium">{settings.systemInfo.version}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Uptime</Label>
                  <p className="font-medium">{settings.systemInfo.uptime}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Sites</Label>
                  <p className="font-medium">{settings.systemInfo.totalSites}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Checks</Label>
                  <p className="font-medium">{settings.systemInfo.totalChecks}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-muted-foreground">Last Restart</Label>
                  <p className="font-medium">{new Date(settings.systemInfo.lastRestart).toLocaleString()}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => restartMonitoringMutation.mutate()}
                  disabled={restartMonitoringMutation.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Restart Monitoring
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="monitoring">
                <Clock className="h-4 w-4 mr-2" />
                Monitoring
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="system">
                <Settings2 className="h-4 w-4 mr-2" />
                System
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monitoring" className="space-y-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Monitoring Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Check Interval (seconds)</Label>
                      <Input
                        type="number"
                        value={settings.monitoringSettings.checkInterval}
                        onChange={(e) => updateSettingsMutation.mutate({
                          monitoringSettings: {
                            ...settings.monitoringSettings,
                            checkInterval: parseInt(e.target.value)
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeout (seconds)</Label>
                      <Input
                        type="number"
                        value={settings.monitoringSettings.timeout}
                        onChange={(e) => updateSettingsMutation.mutate({
                          monitoringSettings: {
                            ...settings.monitoringSettings,
                            timeout: parseInt(e.target.value)
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Retries</Label>
                      <Input
                        type="number"
                        value={settings.monitoringSettings.retries}
                        onChange={(e) => updateSettingsMutation.mutate({
                          monitoringSettings: {
                            ...settings.monitoringSettings,
                            retries: parseInt(e.target.value)
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Real-time Monitoring</Label>
                        <Switch
                          checked={settings.monitoringSettings.realTimeEnabled}
                          onCheckedChange={(checked) => updateSettingsMutation.mutate({
                            monitoringSettings: {
                              ...settings.monitoringSettings,
                              realTimeEnabled: checked
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Mail className="h-5 w-5 mr-2" />
                    Email Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>From Email</Label>
                      <Input
                        type="email"
                        value={settings.emailSettings.fromEmail}
                        onChange={(e) => updateSettingsMutation.mutate({
                          emailSettings: {
                            ...settings.emailSettings,
                            fromEmail: e.target.value
                          }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Test Email Address</Label>
                      <div className="flex space-x-2">
                        <Input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          placeholder="Enter email to test"
                        />
                        <Button
                          onClick={() => testEmailMutation.mutate(testEmail)}
                          disabled={testEmailMutation.isPending}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Test
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={settings.emailSettings.smtpConfigured ? "default" : "destructive"}>
                      {settings.emailSettings.smtpConfigured ? "SMTP Configured" : "SMTP Not Configured"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings2 className="h-5 w-5 mr-2" />
                    System Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Clear Data</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        Clear historical data to free up space. This action cannot be undone.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => clearDataMutation.mutate("logs")}
                          disabled={clearDataMutation.isPending}
                        >
                          Clear Monitoring Logs
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => clearDataMutation.mutate("alerts")}
                          disabled={clearDataMutation.isPending}
                        >
                          Clear Alerts
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => clearDataMutation.mutate("all")}
                          disabled={clearDataMutation.isPending}
                        >
                          Clear All Data
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
