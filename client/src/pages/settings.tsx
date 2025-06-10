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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, Globe, Shield, Database, Zap } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Badge variant="outline" className="text-sm">
          <Zap className="h-3 w-3 mr-1" />
          Real-time monitoring active
        </Badge>
      </div>

      {/* System Information */}
      <Card>
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
              Restart Monitoring
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Email Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>SMTP Status</Label>
              <p className="text-sm text-muted-foreground">
                {settings.emailSettings.smtpConfigured ? "Configured and ready" : "Not configured"}
              </p>
            </div>
            <Badge variant={settings.emailSettings.smtpConfigured ? "default" : "destructive"}>
              {settings.emailSettings.smtpConfigured ? "Active" : "Inactive"}
            </Badge>
          </div>
          
          {settings.emailSettings.smtpConfigured && (
            <div>
              <Label>From Email</Label>
              <p className="text-sm font-medium">{settings.emailSettings.fromEmail}</p>
            </div>
          )}

          <Separator />
          
          <div className="space-y-3">
            <Label htmlFor="test-email">Test Email</Label>
            <div className="flex space-x-2">
              <Input
                id="test-email"
                placeholder="Enter email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                type="email"
              />
              <Button
                onClick={() => testEmailMutation.mutate(testEmail)}
                disabled={testEmailMutation.isPending || !testEmail}
              >
                Send Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Monitoring Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="check-interval">Check Interval</Label>
              <Select 
                value={settings.monitoringSettings.checkInterval.toString()}
                onValueChange={(value) => updateSettingsMutation.mutate({
                  monitoringSettings: {
                    ...settings.monitoringSettings,
                    checkInterval: parseInt(value)
                  }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Every second</SelectItem>
                  <SelectItem value="30">Every 30 seconds</SelectItem>
                  <SelectItem value="60">Every minute</SelectItem>
                  <SelectItem value="300">Every 5 minutes</SelectItem>
                  <SelectItem value="600">Every 10 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="timeout">Request Timeout (ms)</Label>
              <Input
                id="timeout"
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
            
            <div>
              <Label htmlFor="retries">Retry Attempts</Label>
              <Input
                id="retries"
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
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Real-time Monitoring</Label>
              <p className="text-sm text-muted-foreground">
                Check websites every second for immediate alerts
              </p>
            </div>
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
        </CardContent>
      </Card>

      {/* Alert Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Alert Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications for status changes
              </p>
            </div>
            <Switch
              checked={settings.alertSettings.emailAlerts}
              onCheckedChange={(checked) => updateSettingsMutation.mutate({
                alertSettings: {
                  ...settings.alertSettings,
                  emailAlerts: checked
                }
              })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Immediate Manual Check Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Send alerts for manual checks when website is down
              </p>
            </div>
            <Switch
              checked={settings.alertSettings.immediateAlerts}
              onCheckedChange={(checked) => updateSettingsMutation.mutate({
                alertSettings: {
                  ...settings.alertSettings,
                  immediateAlerts: checked
                }
              })}
            />
          </div>
          
          <div>
            <Label htmlFor="alert-cooldown">Alert Cooldown (minutes)</Label>
            <Input
              id="alert-cooldown"
              type="number"
              value={settings.alertSettings.alertCooldown}
              onChange={(e) => updateSettingsMutation.mutate({
                alertSettings: {
                  ...settings.alertSettings,
                  alertCooldown: parseInt(e.target.value)
                }
              })}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Minimum time between duplicate alerts for the same website
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Are you sure you want to clear all monitoring logs?")) {
                  clearDataMutation.mutate("logs");
                }
              }}
              disabled={clearDataMutation.isPending}
            >
              Clear Logs
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Are you sure you want to clear all alerts?")) {
                  clearDataMutation.mutate("alerts");
                }
              }}
              disabled={clearDataMutation.isPending}
            >
              Clear Alerts
            </Button>
            
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Are you sure you want to reset all statistics?")) {
                  clearDataMutation.mutate("stats");
                }
              }}
              disabled={clearDataMutation.isPending}
            >
              Reset Stats
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Warning: These actions cannot be undone. Make sure to backup your data before clearing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}