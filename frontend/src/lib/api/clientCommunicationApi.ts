import api from "../api";

export type CommunicationType =
  | "budget_change"
  | "creative_approval"
  | "kpi_update"
  | "targeting_change"
  | "other";

export type ImpactedArea = "budget" | "creative" | "kpi" | "targeting";

export interface ClientCommunicationPayload {
  task: number;
  communication_type: CommunicationType;
  stakeholders?: string;
  impacted_areas: ImpactedArea[];
  required_actions: string;
  client_deadline?: string | null;
  notes?: string;
}

export const ClientCommunicationAPI = {
  create: (data: ClientCommunicationPayload) =>
    api.post("/api/client-communications/", data),

  listByTask: (taskId: number) =>
    api.get("/api/client-communications/", { params: { task_id: taskId } }),

  update: (id: string | number, data: Partial<ClientCommunicationPayload>) =>
    api.patch(`/api/client-communications/${id}/`, data),
};

