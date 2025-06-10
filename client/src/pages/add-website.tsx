import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWebsiteSchema } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import type { InsertWebsite } from "@shared/schema";

export default function AddWebsite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertWebsite>({
    resolver: zodResolver(insertWebsiteSchema),
    defaultValues: {
      url: "",
      name: "",
      email: "",
      checkInterval: 5,
      isActive: true,
    },
  });

  const createWebsiteMutation = useMutation({
    mutationFn: async (data: InsertWebsite) => {
      const response = await apiRequest("POST", "/api/websites", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Website added successfully",
        description: "Your website is now being monitored.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertWebsite) => {
    createWebsiteMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="flex items-center space-x-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900">Add Website to Monitor</h1>
          <p className="text-gray-600 mt-2">Set up monitoring for a new website and receive alerts when it goes down.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Website Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Website" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email for Alerts</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="checkInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check Interval</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select check interval" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5">Every 5 minutes</SelectItem>
                          <SelectItem value="10">Every 10 minutes</SelectItem>
                          <SelectItem value="15">Every 15 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable monitoring</FormLabel>
                        <div className="text-sm text-gray-500">
                          Start monitoring this website immediately after adding it.
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createWebsiteMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {createWebsiteMutation.isPending ? "Adding..." : "Add Website"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
