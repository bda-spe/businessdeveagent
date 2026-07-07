import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useListSandboxTests, 
  useRunSandboxTest, 
  useSaveSandboxFeedback,
  getListSandboxTestsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, User, Send, ThumbsUp, ThumbsDown, Calculator, FileText, ChevronRight } from "lucide-react";
import type { SandboxTest } from "@workspace/api-client-react";

const testSchema = z.object({
  prompt: z.string().min(1, "Say something to the agent"),
});

export default function TrainingPage() {
  const queryClient = useQueryClient();
  const { data: history, isLoading: isLoadingHistory } = useListSandboxTests();
  const runTest = useRunSandboxTest();
  const saveFeedback = useSaveSandboxFeedback();
  
  const [activeTest, setActiveTest] = useState<SandboxTest | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof testSchema>>({
    resolver: zodResolver(testSchema),
    defaultValues: { prompt: "" },
  });

  // Load most recent test by default if exists
  useEffect(() => {
    if (history && history.length > 0 && !activeTest) {
      setActiveTest(history[0]);
    }
  }, [history, activeTest]);

  const onSubmit = (values: z.infer<typeof testSchema>) => {
    runTest.mutate({ data: { prompt: values.prompt } }, {
      onSuccess: (data) => {
        setActiveTest(data);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListSandboxTestsQueryKey() });
        // Auto scroll to bottom
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      }
    });
  };

  const handleRate = (rating: number) => {
    if (!activeTest) return;
    saveFeedback.mutate({ id: activeTest.id, data: { rating } }, {
      onSuccess: () => {
        setActiveTest(prev => prev ? { ...prev, rating } : null);
        queryClient.invalidateQueries({ queryKey: getListSandboxTestsQueryKey() });
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      <div className="mb-6 shrink-0">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Sandbox Training</h2>
        <p className="text-slate-500 mt-1">Test your agent like a customer. If it makes a mistake, correct it.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50 py-4 shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" /> Live Simulation
            </CardTitle>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-6" ref={scrollRef}>
            <div className="space-y-6 pb-6">
              {/* Welcome message */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-blue-700" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-slate-800 shadow-sm max-w-[80%]">
                  Hello! I'm your digital agent. Try asking me for an estimate, or throw a difficult customer scenario at me.
                </div>
              </div>

              {activeTest && (
                <>
                  <div className="flex gap-4 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm p-4 shadow-sm max-w-[80%]">
                      {activeTest.prompt}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-blue-700" />
                    </div>
                    <div className="flex flex-col gap-3 max-w-[85%]">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-slate-800 shadow-sm whitespace-pre-wrap">
                        {activeTest.agentResponse}
                      </div>
                      
                      {activeTest.estimate && (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2 font-medium text-slate-700">
                            <Calculator className="h-4 w-4 text-emerald-600" /> 
                            Generated Estimate
                          </div>
                          <div className="p-4 text-sm space-y-4">
                            <div>
                              <div className="text-slate-500 mb-1">Customer Summary</div>
                              <div className="font-medium text-slate-900">{activeTest.estimate.customerSummary}</div>
                            </div>
                            
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-100">
                                  <th className="pb-2 font-normal">Item</th>
                                  <th className="pb-2 font-normal text-right">Price</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {activeTest.estimate.invoiceLineItems.map((item, i) => (
                                  <tr key={i}>
                                    <td className="py-2 text-slate-700">{item.description}</td>
                                    <td className="py-2 text-right font-medium text-slate-900">${item.total.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td className="pt-3 font-bold text-slate-900">Estimated Total</td>
                                  <td className="pt-3 text-right font-bold text-slate-900">
                                    ${activeTest.estimate.totalEstimate.toFixed(2)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Feedback mechanism */}
                      <div className="flex items-center gap-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200 self-start">
                        <span className="text-xs font-medium text-slate-500 mr-2">How did the agent do?</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${activeTest.rating === 1 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                          onClick={() => handleRate(1)}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${activeTest.rating === -1 ? 'bg-red-100 text-red-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                          onClick={() => handleRate(-1)}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {runTest.isPending && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-blue-700" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <CardFooter className="p-4 border-t border-slate-100 bg-white shrink-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="w-full flex gap-2">
                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem className="flex-1 m-0">
                      <FormControl>
                        <Textarea 
                          placeholder="Type a scenario... (e.g. 'My sink is leaking under the cabinet, how much to fix it?')" 
                          className="min-h-[60px] resize-none pr-12 rounded-xl focus-visible:ring-slate-400"
                          {...field}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="h-[60px] w-[60px] rounded-xl shrink-0 bg-slate-900 hover:bg-slate-800"
                  disabled={runTest.isPending}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </form>
            </Form>
          </CardFooter>
        </Card>

        {/* History Sidebar */}
        <Card className="w-80 shrink-0 border-slate-200 shadow-sm hidden md:flex flex-col">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">Test History</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            {isLoadingHistory ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : history?.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No tests run yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history?.map((test) => (
                  <button
                    key={test.id}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group ${activeTest?.id === test.id ? 'bg-blue-50/50' : ''}`}
                    onClick={() => setActiveTest(test)}
                  >
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-medium text-slate-900 truncate">{test.prompt}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {test.estimate ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Estimated</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Chat Only</span>
                        )}
                        {test.rating === 1 && <ThumbsUp className="h-3 w-3 text-emerald-500" />}
                        {test.rating === -1 && <ThumbsDown className="h-3 w-3 text-red-500" />}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-opacity ${activeTest?.id === test.id ? 'text-blue-500 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}