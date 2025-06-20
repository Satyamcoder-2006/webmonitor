import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";
import { Tag } from "@shared/schema";
import { 
  Select, 
  SelectContent, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function AddWebsite() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  const { data: availableTags, isLoading: isLoadingTags } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tags");
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      return response.json();
    },
  });

  const formSchema = z.object({
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      customTags: [],
      isActive: true,
    },
  });

  const addWebsiteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const dataForSubmission = {
        ...data,
      };
      const response = await apiRequest("POST", "/api/websites", dataForSubmission);
      if (!response.ok) {
        throw new Error('Failed to add website');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      toast({
        title: "Website added",
        description: "The website has been added to monitoring.",
      });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addWebsiteMutation.mutate(data);
  };

  console.log("AddWebsite component rendering...");
  console.log("Available Tags:", availableTags);
  console.log("Is Loading Tags:", isLoadingTags);
  console.log("Form values:", form.getValues());

  return (
    <div className="space-y-6">
      
      <div className="glass-card rounded-lg p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Website</h1>
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="glass-button text-gray-900 dark:text-white"
          >
            Back to Dashboard
          </Button>
        </div>
        
        <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg mx-auto p-6 glass-card rounded-lg shadow-lg">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900 dark:text-white">Website Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Website" {...field} className="glass-button text-gray-900 dark:text-white" />
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
                    <FormLabel className="text-gray-900 dark:text-white">Website URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} className="glass-button text-gray-900 dark:text-white" />
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
                    <FormLabel className="text-gray-900 dark:text-white">Notification Email</FormLabel>
                    <FormControl>
                      <Input placeholder="alerts@example.com" {...field} className="glass-button text-gray-900 dark:text-white" />
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
                    <FormLabel className="text-gray-900 dark:text-white">Check Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={60} 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="glass-button text-gray-900 dark:text-white"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-600 dark:text-gray-400">
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
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200/50 dark:border-gray-800/50 p-4 glass-card shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-gray-900 dark:text-white">Active Monitoring</FormLabel>
                      <FormDescription className="text-gray-600 dark:text-gray-400">
                        Enable or disable active monitoring for this website.
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

              <div className="flex justify-end gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate("/")} 
                  className="glass-button text-gray-900 dark:text-white"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant={undefined}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Add Website
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}




