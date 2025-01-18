import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { protocolGeneratorSchema } from "@/lib/protocol-validation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProtocolGeneratorProps {
  onComplete: (data: any) => void;
  initialData: any;
}

export default function ProtocolGenerator({ onComplete, initialData }: ProtocolGeneratorProps) {
  const form = useForm({
    resolver: zodResolver(protocolGeneratorSchema),
    defaultValues: initialData
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onComplete)} className="space-y-6">
        <FormField
          control={form.control}
          name="studyCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Study Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Sleep">Sleep</SelectItem>
                  <SelectItem value="Stress">Stress</SelectItem>
                  <SelectItem value="Recovery">Recovery</SelectItem>
                  <SelectItem value="Cognition">Cognition</SelectItem>
                  <SelectItem value="Metabolic Health">Metabolic Health</SelectItem>
                  <SelectItem value="Women's Health">Women's Health</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="experimentTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Experiment Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="studyType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Study Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select study type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Real-World Evidence">Real-World Evidence (Single Arm)</SelectItem>
                  <SelectItem value="Randomized Controlled Trial">Randomized Controlled Trial</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Continue</Button>
      </form>
    </Form>
  );
}
