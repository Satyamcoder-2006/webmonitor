import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { createWebsiteSchema } from "@shared/schema";
import type { CreateWebsite } from "@shared/schema";
import { useLocation } from "wouter";

export default function AddWebsite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateWebsite>({
    resolver: zodResolver(createWebsiteSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      isActive: true,
    },
  });

  const addWebsiteMutation = useMutation({
    mutationFn: async (newWebsite: CreateWebsite) => {
      await apiRequest("POST", "/api/websites", newWebsite);
    },
    onSuccess: () => {
      toast({
        title: "Website added",
        description: "Your website has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateWebsite) => {
    addWebsiteMutation.mutate(data);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Add New Website</h1>
        <Button variant="outline" onClick={() => setLocation("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
      <div className="flex-grow p-4">
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
              value={form.watch("checkInterval").toString()}
              onValueChange={(value) => form.setValue("checkInterval", parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 minute</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
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
          <div className="flex justify-end">
            <Button type="submit" disabled={addWebsiteMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {addWebsiteMutation.isPending ? "Adding..." : "Add Website"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
