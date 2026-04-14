"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AdVariationManagement from "@/components/ad-variations/AdVariationManagement";
import Layout from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProjectAPI, ProjectData } from "@/lib/api/projectApi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";

export default function VariationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<ProjectData[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Get campaignId from URL params if present
  const urlCampaignId = useMemo(() => {
    const id = searchParams.get("campaignId");
    return id ? Number(id) : null;
  }, [searchParams]);

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoading(true);
        const projects = await ProjectAPI.getProjects();
        setCampaigns(projects);

        // If URL has campaignId, use it; otherwise try to get from localStorage
        if (urlCampaignId) {
          const exists = projects.some((p) => p.id === urlCampaignId);
          if (exists) {
            setSelectedCampaignId(urlCampaignId);
          } else {
            toast.error("Selected campaign not found");
          }
        } else {
          // Try to get last selected from localStorage
          const savedCampaignId = localStorage.getItem("variations_selected_campaign");
          if (savedCampaignId) {
            const savedId = parseInt(savedCampaignId, 10);
            const exists = projects.some((p) => p.id === savedId);
            if (exists) {
              setSelectedCampaignId(savedId);
            } else if (projects.length > 0) {
              setSelectedCampaignId(projects[0].id);
            }
          } else if (projects.length > 0) {
            setSelectedCampaignId(projects[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading campaigns:", error);
        toast.error("Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [urlCampaignId]);

  // Save selected campaign to localStorage
  useEffect(() => {
    if (selectedCampaignId) {
      localStorage.setItem("variations_selected_campaign", selectedCampaignId.toString());
    }
  }, [selectedCampaignId]);

  const handleCampaignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const campaignId = e.target.value ? Number(e.target.value) : null;
    setSelectedCampaignId(campaignId);
    // Update URL without campaignId param if we want clean URLs, or keep it for bookmarking
    if (campaignId) {
      router.replace(`/variations?campaignId=${campaignId}`);
    } else {
      router.replace("/variations");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout showHeader={true} showSidebar={true}>
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout showHeader={true} showSidebar={true}>
        <div className="px-6 pb-10 pt-4">
          {/* Campaign Selector */}
          <div className="mb-6">
            <label htmlFor="campaign-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select Project
            </label>
            <select
              id="campaign-select"
              value={selectedCampaignId || ""}
              onChange={handleCampaignChange}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- Select a campaign --</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ad Variation Management */}
          {selectedCampaignId ? (
            <AdVariationManagement campaignId={selectedCampaignId} />
          ) : (
            <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center">
                <p className="text-gray-500 text-lg mb-2">No campaign selected</p>
                <p className="text-gray-400 text-sm">Please select a campaign from the dropdown above to view ad variations</p>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

