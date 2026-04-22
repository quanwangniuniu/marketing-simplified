
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion";
import { BudgetRequestData, BudgetPoolData } from "@/lib/api/budgetApi";

interface BudgetRequestDetailProps {
  budgetRequest?: BudgetRequestData;
  budgetPool?: BudgetPoolData;
  loading?: boolean;
}

export default function BudgetRequestDetail({ budgetRequest, budgetPool, loading }: BudgetRequestDetailProps) {
  const linkedBudgetPoolId =
    budgetRequest?.budget_pool_id ?? budgetRequest?.budget_pool ?? null;

  // Helper function to get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'UNDER_REVIEW':
        return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'LOCKED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  if (loading) {
    return (
      <section>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading budget details...</p>
        </div>
      </section>
    );
  }

  if (!budgetRequest) {
    return (
      <section>
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">No budget request data available</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Accordion type="multiple" defaultValue={["item-1"]}>
        <AccordionItem value="item-1" className="border-none">
          <AccordionTrigger>
            <h2 className="font-semibold text-gray-900 text-lg">Budget Request Details</h2>
          </AccordionTrigger>
          <AccordionContent className="min-h-0 overflow-y-auto">
            <div className="space-y-8">
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Status</label>
                  <span className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(budgetRequest.status)}`}>
                    {budgetRequest.status || 'Unknown'}
                  </span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Amount</label>
                <span className="text-sm text-gray-900">
                  {budgetRequest.amount} {budgetRequest.currency}
                </span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Currency</label>
                <span className="text-sm text-gray-900">
                  {budgetRequest.currency || 'Unknown'}
                </span>
              </div>
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Advertising Channel</label>
                <span className="text-sm text-gray-900">
                  {budgetRequest.ad_channel_detail?.name || budgetRequest.ad_channel || 'Unknown'}
                </span>
              </div>
              {budgetPool && (
                <div className="flex flex-col gap-6">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Budget Pool</label>
                  <div className="flex flex-col gap-6 border border-gray-200 rounded-md p-4">
                    <div className="flex flex-row items-center gap-3">
                      <label className="block text-sm font-semibold text-gray-500 tracking-wide">Budget Pool ID</label>
                      <span className="text-sm text-gray-900">
                        {budgetPool.id}
                      </span>
                    </div>
                    <div className="flex flex-row items-center gap-3">
                      <label className="block text-sm font-semibold text-gray-500 tracking-wide">Available Amount</label>
                      <span className="text-sm text-gray-900">
                        {budgetPool.available_amount} {budgetRequest.currency}
                      </span>
                    </div>
                    <div className="flex flex-row items-center gap-3">
                      <label className="block text-sm font-semibold text-gray-500 tracking-wide">Total Amount</label>
                      <span className="text-sm text-gray-900">
                        {budgetPool.total_amount} {budgetRequest.currency} ({budgetPool.used_amount} {budgetRequest.currency} used)
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {!budgetPool && (
                <div className="flex flex-row items-center gap-3">
                  <label className="block text-sm font-semibold text-gray-900 tracking-wide">Budget Pool</label>
                  <span className="text-sm text-gray-900">
                    {linkedBudgetPoolId
                      ? `Budget Pool #${linkedBudgetPoolId} (details unavailable)`
                      : 'No budget pool selected'}
                  </span>
                </div>
              )}
              <div className="flex flex-row items-center gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Is Escalated?</label>
                <span className="text-sm text-gray-900">
                  {budgetRequest.is_escalated ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <label className="block text-sm font-semibold text-gray-900 tracking-wide">Notes</label>
                <span className="text-sm text-gray-900">
                  {budgetRequest.notes || 'No notes'}
                </span>
              </div>
            </div>
          </AccordionContent>        
        </AccordionItem> 
      </Accordion>
    </section>
  )
}
