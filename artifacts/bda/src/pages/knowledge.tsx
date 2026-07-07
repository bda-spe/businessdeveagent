import { useState } from "react";
import { 
  useListFiles, 
  useUploadFile, 
  useDeleteFile, 
  useScanDocuments, 
  useListExtractedValues,
  useUpdateExtractedValue,
  useApproveBusinessProfile,
  getListFilesQueryKey,
  getListExtractedValuesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Trash2, BrainCircuit, Check, X, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ExtractedValue } from "@workspace/api-client-react";

export default function KnowledgePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: files, isLoading: isLoadingFiles } = useListFiles();
  const { data: extractedValues, isLoading: isLoadingValues } = useListExtractedValues();
  
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();
  const scanDocuments = useScanDocuments();
  const updateExtractedValue = useUpdateExtractedValue();
  const approveProfile = useApproveBusinessProfile();

  const [activeTab, setActiveTab] = useState("files");

  // Simulated file upload for MVP
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate reading text from file for the mock backend
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      uploadFile.mutate({
        data: {
          filename: file.name,
          sizeBytes: file.size,
          fileType: file.type || "text/plain",
          textContent: content.substring(0, 1000) // Send a snippet to mock backend
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          toast({ title: "File uploaded successfully" });
        }
      });
    };
    reader.readAsText(file);
  };

  const handleScan = () => {
    scanDocuments.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExtractedValuesQueryKey() });
        setActiveTab("review");
        toast({ 
          title: "Scan complete", 
          description: "Review the extracted information." 
        });
      }
    });
  };

  const handleApproveValue = (val: ExtractedValue) => {
    updateExtractedValue.mutate({
      id: val.id,
      data: { approved: true }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExtractedValuesQueryKey() });
      }
    });
  };

  const handleApproveAll = () => {
    approveProfile.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ 
          title: "Profile Approved", 
          description: "Your agent is now fully trained on this knowledge." 
        });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Knowledge Base</h2>
          <p className="text-slate-500 mt-1">Upload price books, FAQs, and manuals. The AI will learn your business automatically.</p>
        </div>
        <Button 
          onClick={handleScan} 
          disabled={scanDocuments.isPending || !files?.length}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {scanDocuments.isPending ? "Scanning..." : <><BrainCircuit className="mr-2 h-4 w-4" /> Scan Documents with BDA</>}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="files" className="data-[state=active]:bg-slate-100">Documents ({files?.length || 0})</TabsTrigger>
          <TabsTrigger value="review" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
            AI Review {extractedValues?.filter(v => !v.approved).length ? (
              <Badge variant="destructive" className="ml-2 bg-purple-600">{extractedValues.filter(v => !v.approved).length}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-6">
          <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Upload Knowledge</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 mb-6">
                Upload price books (PDF, CSV), old invoices, service manuals, or FAQ documents.
              </p>
              <div className="relative">
                <Input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={handleFileUpload}
                  disabled={uploadFile.isPending}
                  accept=".pdf,.txt,.csv,.doc,.docx"
                />
                <Button disabled={uploadFile.isPending}>
                  {uploadFile.isPending ? "Uploading..." : "Select Files"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoadingFiles ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : files?.length === 0 ? (
             null 
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {files?.map(file => (
                <Card key={file.id} className="border-slate-200 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{file.filename}</p>
                      <p className="text-xs text-slate-500">{(file.sizeBytes / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      onClick={() => {
                        if(confirm("Delete this file?")) {
                          deleteFile.mutate({ id: file.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() })
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="review">
          {isLoadingValues ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : !extractedValues?.length ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No data extracted yet</h3>
              <p className="text-slate-500 mt-1">Upload documents and click "Scan Documents" to extract intelligence.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-purple-50 border border-purple-100 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <BrainCircuit className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900">AI Extraction Complete</h3>
                    <p className="text-sm text-purple-700">Review the extracted values below. The agent will use these as ground truth.</p>
                  </div>
                </div>
                <Button onClick={handleApproveAll} disabled={approveProfile.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                  Approve All & Train Agent
                </Button>
              </div>

              <div className="space-y-4">
                {extractedValues.map(val => (
                  <Card key={val.id} className={`border-slate-200 transition-colors ${val.approved ? 'bg-slate-50 opacity-70' : 'bg-white shadow-sm'}`}>
                    <CardContent className="p-5 flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{val.requirementLabel}</h4>
                          {val.confidenceScore > 80 ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">High Confidence</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800"><AlertTriangle className="h-3 w-3 mr-1" /> Needs Review</Badge>
                          )}
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded border border-slate-100 font-mono text-sm text-slate-800">
                          {val.overrideValue || val.extractedValue || "—"}
                        </div>
                        
                        {val.sourceDocument && (
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            Extracted from: <FileText className="h-3 w-3" /> <span className="font-medium">{val.sourceDocument}</span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex md:flex-col items-center justify-center gap-2 md:w-32 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                        {val.approved ? (
                          <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4" /> Approved
                          </div>
                        ) : (
                          <>
                            <Button 
                              variant="outline" 
                              className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => handleApproveValue(val)}
                            >
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            {/* In a real app we'd have an edit dialog here */}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}