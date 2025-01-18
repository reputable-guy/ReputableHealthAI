import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eligibilityCriteriaSchema } from "@/lib/protocol-validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface EligibilityCriteriaProps {
  onComplete: (data: any) => void;
  initialData: any;
}

export default function EligibilityCriteria({ onComplete, initialData }: EligibilityCriteriaProps) {
  const form = useForm({
    resolver: zodResolver(eligibilityCriteriaSchema),
    defaultValues: initialData?.eligibilityCriteria || {
      wearableData: [],
      demographics: [],
      customQuestions: []
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onComplete)} className="space-y-6">
        <FormField
          control={form.control}
          name="customQuestions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custom Screening Questions</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter one question per line"
                  className="min-h-[100px]"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.split('\n'))}
                  value={field.value?.join('\n')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Generate Protocol</Button>
      </form>
    </Form>
  );
}
