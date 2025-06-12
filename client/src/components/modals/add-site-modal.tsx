import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWebsiteSchema } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CreateWebsite } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { z } from "zod";

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddSiteModal({ isOpen, onClose }: AddSiteModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTag, setCurrentTag] = useState('');

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
      onClose();
      form.reset();
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

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Website</DialogTitle>
          <DialogDescription>
            Enter the details of the website you want to monitor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <DialogFooter>
              <Button type="submit" disabled={addWebsiteMutation.isPending}>
                {addWebsiteMutation.isPending ? "Adding..." : "Add Website"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
