import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { updateWebsiteSchema } from "@shared/schema";
import type { UpdateWebsite, Website } from "@shared/schema";
import { useLocation, useParams } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import { Loader2 } from "lucide-react";

export default function EditWebsite() {
  const params = useParams();
  const websiteId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch website data
  const { data: website, isLoading } = useQuery({
    queryKey: [`/api/websites/${websiteId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/websites/${websiteId}`);
      return response.json() as Promise<Website>;
    },
    enabled: !isNaN(websiteId),
  });

  const form = useForm<UpdateWebsite>({
    resolver: zodResolver(updateWebsiteSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      isActive: true,
    },
  });

  // Update form values when website data is loaded
  useEffect(() => {
    if (website) {
      form.reset({
        name: website.name,
        url: website.url,
        email: website.email,
        checkInterval: website.checkInterval,
        isActive: website.isActive,
      });
    }
  }, [website, form]);

  const updateWebsiteMutation = useMutation({
    mutationFn: async (updatedWebsite: UpdateWebsite) => {
      await apiRequest("PATCH", `/api/websites/${websiteId}`, updatedWebsite);
    },
    onSuccess: () => {
      toast({
        title: "Website updated",
        description: "Your website has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      queryClient.invalidateQueries({ queryKey: [`/api/websites/${websiteId}`] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateWebsite) => {
    updateWebsiteMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-2 text-gray-600">Loading website data...</p>
        </div>
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Website Not Found</h1>
            <p className="mt-2 text-gray-600">The website you're trying to edit doesn't exist.</p>
            <Button 
              className="mt-4"
              onClick={() => setLocation("/")}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Edit Website</h1>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/")}
          >
            Back to Dashboard
          </Button>
        </div>
        <div className="flex-grow p-4 overflow-y-auto">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg mx-auto p-6 bg-white rounded-lg shadow">
            <div className="space-y-2">
              <Label htmlFor="name">Website Name</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <Input id="url" {...form.register("url")} placeholder="https://example.com" />
              {form.formState.errors.url && (
                <p className="text-red-500 text-sm">{form.formState.errors.url.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Alert Email</Label>
              <Input id="email" {...form.register("email")} type="email" placeholder="alerts@example.com" />
              {form.formState.errors.email && (
                <p className="text-red-500 text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkInterval">Check Interval (minutes)</Label>
              <Select 
                value={form.watch("checkInterval")?.toString()} 
                onValueChange={(value) => form.setValue("checkInterval", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.checkInterval && (
                <p className="text-red-500 text-sm">{form.formState.errors.checkInterval.message}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
              />
              <Label htmlFor="isActive">Active Monitoring</Label>
            </div>
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setLocation("/")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateWebsiteMutation.isPending} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateWebsiteMutation.isPending ? "Updating..." : "Update Website"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}