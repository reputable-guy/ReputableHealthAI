import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studySetupSchema } from "@/lib/protocol-validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface StudySetupFormProps {
  onComplete: (data: any) => Promise<void>;
}

export default function StudySetupForm({ onComplete }: StudySetupFormProps) {
  const form = useForm({
    resolver: zodResolver(studySetupSchema),
    defaultValues: {}
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onComplete)} className="space-y-6">
        <FormField
          control={form.control}
          name="productName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormDescription>
                Enter the name of the wellness product you want to study
              </FormDescription>
              <FormControl>
                <Input placeholder="Enter product name" {...field} />
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
              <FormLabel>Website URL (Optional)</FormLabel>
              <FormDescription>
                Link to your product's website for additional context
              </FormDescription>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="studyGoal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Study Goal</FormLabel>
              <FormDescription>
                Select the primary goal of your study
              </FormDescription>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a goal" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pilot">Gain quick insights from a small pilot</SelectItem>
                  <SelectItem value="marketing">Generate marketing claims</SelectItem>
                  <SelectItem value="publication">Prepare for scientific publication</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Protocol...
            </>
          ) : (
            "Generate Study Protocol"
          )}
        </Button>
      </form>
    </Form>
  );
}