'use client';

import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export interface AuditEvent{
  id: string;
  actor_name: string | null;
  action: string;
  target_name: string;
  timestamp: string;
}

export default function AuditCard({events} : {events: AuditEvent[]}){
  return(
    <Card data-overview-card="audit" className="border-[0.5px] border-gray-200 bg-white shadow-none">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-400"></ShieldCheck>
          <CardTitle className="text-sm font-medium text-gray-900">Admin Action Log</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        
      </CardContent>
    </Card>
  )
}