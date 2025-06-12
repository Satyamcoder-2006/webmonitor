import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";

export default function AddWebsite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTag, setCurrentTag] = useState('');

  const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Please enter a valid URL"),
    email: z.string().email("Please enter a valid email"),
    checkInterval: z.number().min(1, "Check interval must be at least 1 minute").max(60, "Check interval cannot exceed 60 minutes"),
    customTags: z.record(z.string()).optional(),
    isActive: z.boolean().default(true),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "",
      email: "",
      checkInterval: 5,
      customTags: {},
      isActive: true,
    },
  });

  const addWebsiteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await apiRequest("POST", "/api/websites", data);
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

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addWebsiteMutation.mutate(data);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Add New Website</h1>
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
                      <Input placeholder="My Website" {...field} />
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
                      <Input placeholder="https://example.com" {...field} />
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
                    <FormLabel>Notification Email</FormLabel>
                    <FormControl>
                      <Input placeholder="alerts@example.com" {...field} />
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
                  disabled={addWebsiteMutation.isPending} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {addWebsiteMutation.isPending ? "Adding..." : "Add Website"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}




