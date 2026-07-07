import { useRef } from "react";
import {
  useListFiles,
  useUploadFile,
  useDeleteFile,
  useScanDocuments,
  getListFilesQueryKey,
  getListExtractedValuesQueryKey,
  getListRequirementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, BrainCircuit } from "lucide-react";

export default function UploadDocsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files } = useListFiles();
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();
  const scanDocuments = useScanDocuments();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      uploadFile.mutate(
        {
          data: {
            filename: file.name,
            sizeBytes: file.size,
            fileType: file.type || "text/plain",
            textContent: content?.substring(0, 1000) ?? "",
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
            toast({ title: "Document uploaded" });
          },
          onError: () => {
            toast({ title: "Upload failed", variant: "destructive" });
          },
        },
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleScan = () => {
    scanDocuments.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExtractedValuesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
        toast({
          title: "Scan complete",
          description: "Extracted information was applied to your requirements.",
        });
      },
      onError: () => {
        toast({ title: "Scan failed", variant: "destructive" });
      },
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm" data-testid="upload-docs-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Upload className="h-4 w-4 text-blue-600" />
          Upload Business Documentation
        </CardTitle>
        <p className="text-xs text-slate-500 leading-relaxed">
          Upload any docs regarding company info related to services, pricing, etc.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept=".pdf,.txt,.csv,.doc,.docx"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          disabled={uploadFile.isPending}
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-upload-doc"
        >
          {uploadFile.isPending ? "Uploading..." : "Select a document"}
        </Button>

        {!!files?.length && (
          <>
            <div className="space-y-1.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs text-slate-700 truncate flex-1">
                    {file.filename}
                  </span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600 shrink-0"
                    aria-label={`Delete ${file.filename}`}
                    onClick={() =>
                      deleteFile.mutate(
                        { id: file.id },
                        {
                          onSuccess: () =>
                            queryClient.invalidateQueries({
                              queryKey: getListFilesQueryKey(),
                            }),
                        },
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              onClick={handleScan}
              disabled={scanDocuments.isPending}
              data-testid="button-scan-docs"
            >
              <BrainCircuit className="mr-2 h-3.5 w-3.5" />
              {scanDocuments.isPending ? "Scanning..." : "Scan with BDA"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
