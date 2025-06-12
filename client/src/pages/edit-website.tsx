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
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";

export default function EditWebsite() {
  const params = useParams();
  const websiteId = parseInt(params.id as string);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTag, setCurrentTag] = useState('');

  const { data: website, isLoading } = useQuery({
    queryKey: [`/api/websites/${websiteId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/websites/${websiteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch website');
      }
      return response.json() as Promise<Website>;
    },
    enabled: !isNaN(websiteId),
  });

  const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Please enter a valid URL"),
    email: z.string().email("Please enter a valid email"),
    checkInterval: z.number().min(1, "Check interval must be at least 1 minute").max(60, "Check interval cannot exceed 60 minutes"),
    customTags: z.record(z.string()).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      customTags: {},
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
        customTags: website.customTags || {},
      });
    }
  }, [website, form]);

  const updateWebsiteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await apiRequest("PATCH", `/api/websites/${websiteId}`, data);
      if (!response.ok) {
        throw new Error('Failed to update website');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      queryClient.invalidateQueries({ queryKey: [`/api/websites/${websiteId}`] });
      toast({
        title: "Website updated",
        description: "The website has been updated successfully.",
      });
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

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateWebsiteMutation.mutate(data);
  };

  const formatSSLExpiryDate = (expiryDate: string | Date | null) => {
    if (!expiryDate) return 'N/A';
    const date = new Date(expiryDate);
    return date.toLocaleDateString();
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg mx-auto p-6 bg-white rounded-lg shadow">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://example.com" />
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
                    <FormLabel>Alert Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="alerts@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SSL Information */}
              {website.url.startsWith('https://') && website.sslValid !== null && (
                <div className="space-y-2 border p-4 rounded-lg bg-gray-50">
                  <h3 className="text-lg font-semibold">SSL Certificate Information</h3>
                  <p>Status: {
                    website.sslValid ? 
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Valid</Badge> : 
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Invalid</Badge>
                  }</p>
                  <p>Expiry Date: {formatSSLExpiryDate(website.sslExpiryDate)}</p>
                  <p>Days Left: {
                    website.sslDaysLeft !== null ? (
                      <span className={website.sslDaysLeft <= 30 ? "text-red-500 font-semibold" : ""}>
                        {website.sslDaysLeft}
                      </span>
                    ) : 'N/A'
                  }</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="checkInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={60} 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      How often should we check this website? (1-60 minutes)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customTags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Tags</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a tag"
                            value={currentTag}
                            onChange={(e) => setCurrentTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (currentTag.trim()) {
                                  const newTags = { ...field.value, [currentTag.trim()]: currentTag.trim() };
                                  field.onChange(newTags);
                                  setCurrentTag('');
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (currentTag.trim()) {
                                const newTags = { ...field.value, [currentTag.trim()]: currentTag.trim() };
                                field.onChange(newTags);
                                setCurrentTag('');
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(field.value || {}).map(([key, value]) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {value}
                              <button
                                type="button"
                                onClick={() => {
                                  const newTags = { ...field.value };
                                  delete newTags[key];
                                  field.onChange(newTags);
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
          </Form>
        </div>
      </div>
    </div>
  );
}