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

// Define a type for website data as received from the API, where customTags is an object
interface FetchedWebsiteData extends Omit<Website, 'customTags'> {
  customTags: Record<string, string> | null | undefined;
}

// Define a specific form schema for client-side validation
const editWebsiteFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().regex(
    /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    "Please enter a valid URL (e.g., https://example.com, example.net)"
  ),
  email: z.string().email("Please enter a valid email"),
  checkInterval: z.number().min(1, "Check interval must be at least 1 minute").max(60, "Check interval cannot exceed 60 minutes"),
  customTags: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export default function EditWebsite() {
  const params = useParams();
  const websiteId = parseInt(params.id as string);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

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

  const { data: website, isLoading } = useQuery<FetchedWebsiteData>({
    queryKey: [`/api/websites/${websiteId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/websites/${websiteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch website');
      }
      const data = await response.json();
      console.log("Website data fetched:", data);
      return data as FetchedWebsiteData;
    },
    enabled: !isNaN(websiteId),
  });

  const formSchema = editWebsiteFormSchema;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      customTags: [],
      isActive: false,
    },
  });

  // Update form values when website data and available tags are loaded
  useEffect(() => {
    if (website && availableTags) {
      // Ensure website.customTags (from DB) is treated as an object and then converted to an array of keys for the form
      const websiteCustomTags = website.customTags || {};
      const tagsForForm: string[] = Object.keys(websiteCustomTags);

      form.reset({
        name: website.name,
        url: website.url,
        email: website.email,
        checkInterval: website.checkInterval,
        customTags: tagsForForm,
        isActive: website.isActive,
      });
    }
  }, [website, availableTags, form]);

  console.log("Form customTags on render:", form.getValues().customTags);

  const updateWebsiteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const dataForSubmission = {
        ...data,
        customTags: data.customTags ? data.customTags.reduce((acc, tagName) => ({ ...acc, [tagName]: tagName }), {}) : {},
      };
      const response = await apiRequest("PATCH", `/api/websites/${websiteId}`, dataForSubmission);
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
    console.log("Form submitted data:", data);
    console.log("Form errors:", form.formState.errors);
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
                  <FormLabel className="text-gray-900 dark:text-white">Tags</FormLabel>
                  <FormControl>
                    <Select open={isTagDropdownOpen} onOpenChange={setIsTagDropdownOpen}>
                      <SelectTrigger className="glass-button text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600">
                        <SelectValue placeholder="Select tags">
                          {Array.isArray(field.value) && field.value.length > 0 
                            ? field.value.join(', ') 
                            : "Select tags"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg">
                        <div className="p-1">
                          <div 
                            className="flex items-center w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              field.onChange([]);
                              setIsTagDropdownOpen(false);
                            }}
                          >
                            <Checkbox
                              checked={Array.isArray(field.value) && field.value.length === 0}
                              onCheckedChange={(checked) => {
                                field.onChange([]);
                                setIsTagDropdownOpen(false);
                              }}
                              className="mr-2"
                            />
                            <span className="text-gray-900 dark:text-white">No Tags</span>
                          </div>
                          {isLoadingTags ? (
                            <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
                              Loading tags...
                            </div>
                          ) : availableTags && Array.isArray(availableTags) && availableTags.length > 0 ? (
                            availableTags.map((tag) => (
                              <div 
                                key={tag.id}
                                className="flex items-center w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const currentTags = Array.isArray(field.value) ? field.value : [];
                                  const newTags = currentTags.includes(tag.name)
                                    ? currentTags.filter(t => t !== tag.name)
                                    : [...currentTags, tag.name];
                                  field.onChange(newTags);
                                }}
                              >
                                <Checkbox
                                  checked={Array.isArray(field.value) && field.value.includes(tag.name)}
                                  onCheckedChange={(checked) => {
                                    const currentTags = Array.isArray(field.value) ? field.value : [];
                                    const newTags = checked 
                                      ? [...currentTags, tag.name]
                                      : currentTags.filter(t => t !== tag.name);
                                    field.onChange(newTags);
                                  }}
                                  className="mr-2"
                                />
                                <span className="text-gray-900 dark:text-white">{tag.name}</span>
                              </div>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
                              No tags available. Create tags from the Tags page.
                            </div>
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {Array.isArray(field.value) && field.value.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(Array.isArray(field.value) ? field.value : []).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="glass-button px-3 py-1">
                          {tag}
                          <X 
                            className="ml-2 h-3 w-3 cursor-pointer" 
                            onClick={() => field.onChange((Array.isArray(field.value) ? field.value : []).filter((t: string) => t !== tag))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormDescription className="text-gray-600 dark:text-gray-400">
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