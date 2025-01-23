import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

const inputSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

type FormData = z.infer<typeof inputSchema>;

export default function InputPage() {
  const [, setLocation] = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      productName: "",
      websiteUrl: "",
    },
  });

  const onSubmit = (data: FormData) => {
    // Navigate to verification page with the product data
    const params = new URLSearchParams({
      product: data.productName,
      url: data.websiteUrl || "",
    });
    setLocation(`/verification?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Study Details</CardTitle>
          <CardDescription>
            Enter your product information to begin generating a research study
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Website (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Generate Literature Review
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}