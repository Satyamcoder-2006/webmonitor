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
import type { Website, Tag } from "@shared/schema";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";

export default function EditWebsite() {
  const params = useParams();
  const websiteId = parseInt(params.id as string);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available tags
  const { data: availableTags, isLoading: isLoadingTags } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tags");
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      return response.json();
    }
  });

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

  const formSchema = updateWebsiteSchema.extend({
    customTags: z.record(z.string()).optional().transform(val => Object.keys(val || {})),
  }).transform(data => ({
    ...data,
    customTags: data.customTags ? data.customTags.reduce((acc, tagName) => ({ ...acc, [tagName]: tagName }), {}) : {},
  }));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      customTags: {},
      isActive: false,
    },
  });

  // Update form values when website data and available tags are loaded
  useEffect(() => {
    if (website && availableTags) {
      form.reset({
        name: website.name,
        url: website.url,
        email: website.email,
        checkInterval: website.checkInterval,
        customTags: Object.keys(website.customTags || {}),
        isActive: website.isActive,
      });
    }
  }, [website, availableTags, form]);

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
      navigate("/");
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

  if (isLoading || isLoadingTags) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-2 text-gray-600">Loading website data...</p>
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Website Not Found</h1>
          <p className="mt-2 text-gray-600">The website you're trying to edit doesn't exist.</p>
          <Button 
            className="mt-4"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Edit Website</h1>
        <Button 
          variant="outline" 
          onClick={() => navigate("/")}
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
                  website.sslValid ? (
                    <Badge variant="success">Valid</Badge>
                  ) : (
                    <Badge variant="danger">Invalid</Badge>
                  )
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

            {/* New Tags Select Field */}
            <FormField
              control={form.control}
              name="customTags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Select
                      value={Array.isArray(field.value) ? field.value.join(',') : ''}
                      onValueChange={(newValue) => {
                        const selectedValues = newValue.split(',').filter(Boolean);
                        field.onChange(selectedValues);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tags" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingTags ? (
                          <SelectItem value="loading" disabled>
                            Loading tags...
                          </SelectItem>
                        ) : availableTags && Array.isArray(availableTags) && availableTags.length > 0 ? (
                          availableTags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.name}>
                              <div className="flex items-center w-full">
                                <Checkbox
                                  checked={Array.isArray(field.value) && field.value.includes(tag.name)}
                                  onCheckedChange={(checkedState) => {
                                    const currentTags = Array.isArray(field.value) ? field.value : [];
                                    if (checkedState) {
                                      field.onChange([...currentTags, tag.name]);
                                    } else {
                                      field.onChange(currentTags.filter(t => t !== tag.name));
                                    }
                                  }}
                                  className="mr-2"
                                />
                                {tag.name}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-tags" disabled>
                            No tags available. Create tags from the Tags page.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Assign existing tags to this website.
                  </FormDescription>
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
                    <FormLabel className="text-base">Active Monitoring</FormLabel>
                    <FormDescription>
                      Enable or disable monitoring for this website.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-700"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/")}
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
  );
}