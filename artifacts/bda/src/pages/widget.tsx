import { useState, useEffect } from "react";
import { useGetWidgetSettings, useSaveWidgetSettings, getGetWidgetSettingsQueryKey, useGetBusiness } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPickerPopover } from "@/components/color-picker";
import { Code, LayoutTemplate, Palette, Copy, Check, MessageSquare } from "lucide-react";

const widgetSchema = z.object({
  greeting: z.string().min(1, "Greeting is required"),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color"),
  position: z.enum(["bottom-right", "bottom-left"]),
  enabled: z.boolean(),
});

export default function WidgetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetWidgetSettings();
  const { data: business } = useGetBusiness();
  const saveSettings = useSaveWidgetSettings();

  const [copied, setCopied] = useState(false);

  const form = useForm<z.infer<typeof widgetSchema>>({
    resolver: zodResolver(widgetSchema),
    defaultValues: {
      greeting: "Hi! How can we help you today?",
      primaryColor: "#0f172a",
      position: "bottom-right",
      enabled: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        greeting: settings.greeting,
        primaryColor: settings.primaryColor,
        position: settings.position as any,
        enabled: settings.enabled,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof widgetSchema>) => {
    saveSettings.mutate({ data: values }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetWidgetSettingsQueryKey(), data);
        toast({ title: "Widget settings saved" });
      }
    });
  };

  const currentValues = form.watch();

  const scriptSrc = `${window.location.origin}${import.meta.env.BASE_URL}widget.js`;
  const embedCode = `<script src="${scriptSrc}" data-client-id="${business?.clientId ?? "YOUR_CLIENT_ID"}"></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Website Widget</h2>
        <p className="text-slate-500 mt-1">Configure and install the BDA chat widget on your own website.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Configuration Form */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-blue-500" /> Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-slate-50">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-semibold">Enable Widget</FormLabel>
                          <FormDescription>If disabled, the widget will hide from your site immediately.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="greeting"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Greeting Message</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>The first message customers see when they open the chat.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand Color</FormLabel>
                          <div>
                            <ColorPickerPopover
                              value={field.value}
                              onChange={field.onChange}
                              testId="button-widget-color"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={saveSettings.isPending} className="w-full">
                    {saveSettings.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-slate-900 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Code className="h-5 w-5 text-blue-400" /> Installation Code
              </CardTitle>
              <CardDescription className="text-slate-400">
                Paste this snippet just before the closing &lt;/body&gt; tag on your website.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 bg-slate-950 rounded-lg text-sm font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                  {embedCode}
                </pre>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white border-none"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col bg-slate-50">
          <CardHeader className="bg-white border-b border-slate-100 z-10 relative">
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-purple-500" /> Live Preview
            </CardTitle>
          </CardHeader>
          <div className="flex-1 relative min-h-[400px]">
            {/* Fake Website Background */}
            <div className="absolute inset-0 p-8 opacity-20 pointer-events-none">
              <div className="w-full h-8 bg-slate-300 rounded mb-8"></div>
              <div className="w-2/3 h-12 bg-slate-300 rounded mb-4"></div>
              <div className="w-1/2 h-4 bg-slate-300 rounded mb-8"></div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="h-32 bg-slate-300 rounded"></div>
                <div className="h-32 bg-slate-300 rounded"></div>
                <div className="h-32 bg-slate-300 rounded"></div>
              </div>
            </div>

            {/* Widget Mockup */}
            {currentValues.enabled && (
              <div className={`absolute bottom-6 flex flex-col gap-4 w-[350px] transition-all duration-300 ${currentValues.position === 'bottom-left' ? 'left-6' : 'right-6'}`}>
                {/* Chat window */}
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[400px] animate-in slide-in-from-bottom-8">
                  {/* Header */}
                  <div 
                    className="p-4 text-white flex items-center gap-3"
                    style={{ backgroundColor: currentValues.primaryColor }}
                  >
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold leading-tight">Virtual Assistant</h4>
                      <p className="text-xs opacity-80 leading-tight">Typically replies instantly</p>
                    </div>
                  </div>
                  
                  {/* Messages area */}
                  <div className="flex-1 p-4 bg-slate-50 flex flex-col gap-4">
                    <div className="flex gap-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px]"
                        style={{ backgroundColor: currentValues.primaryColor }}
                      >
                        VA
                      </div>
                      <div className="bg-white p-3 rounded-2xl rounded-tl-sm text-sm text-slate-700 shadow-sm border border-slate-100">
                        {currentValues.greeting}
                      </div>
                    </div>
                  </div>
                  
                  {/* Input area */}
                  <div className="p-3 bg-white border-t border-slate-100">
                    <div className="bg-slate-100 rounded-full px-4 py-2 text-sm text-slate-400">
                      Type your message...
                    </div>
                  </div>
                </div>

                {/* Launcher button */}
                <div 
                  className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer ${currentValues.position === 'bottom-left' ? 'self-start' : 'self-end'}`}
                  style={{ backgroundColor: currentValues.primaryColor }}
                >
                  <MessageSquare className="h-6 w-6" />
                </div>
              </div>
            )}

            {!currentValues.enabled && (
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                <div className="bg-white/90 p-4 rounded-xl shadow-sm text-sm font-medium text-slate-500 border border-slate-200">
                  Widget is currently disabled
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}