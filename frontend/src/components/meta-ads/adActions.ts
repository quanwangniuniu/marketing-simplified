import { facebookApi } from "@/lib/api/facebookApi";

export interface CsvExportBundle {
  blob: Blob;
  filename: string;
}

export async function triggerCsvExport(args: {
  adAccountId: number;
  days: number;
  ids?: number[];
}): Promise<void> {
  const filters = args.ids && args.ids.length > 0 ? { ids: args.ids } : undefined;
  const { blob, filename } = await facebookApi.getMetaAdExportCsv(
    args.adAccountId,
    args.days,
    filters
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
