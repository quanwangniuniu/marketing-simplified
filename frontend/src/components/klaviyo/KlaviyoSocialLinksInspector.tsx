"use client";
import React, { useState } from "react";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Facebook,
  Instagram,
  Share2,
} from "lucide-react";
import {
  CanvasBlock,
  SocialLink,
  SocialPlatform,
} from "@/components/mailchimp/email-builder/types";

interface KlaviyoSocialLinksInspectorProps {
  selectedBlockData: CanvasBlock | null;
  updateSocialSettings: (updates: Partial<CanvasBlock>) => void;
}

const KlaviyoSocialLinksInspector: React.FC<
  KlaviyoSocialLinksInspectorProps
> = ({ selectedBlockData, updateSocialSettings }) => {
  const socialLinks: SocialLink[] = selectedBlockData?.socialLinks || [];
  
  // Initialize all cards as expanded by default
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    socialLinks.forEach((link) => initial.add(link.id));
    return initial;
  });

  // Update expanded cards when socialLinks change
  React.useEffect(() => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      socialLinks.forEach((link) => {
        if (!next.has(link.id)) {
          next.add(link.id);
        }
      });
      // Remove IDs that no longer exist
      prev.forEach((id) => {
        if (!socialLinks.find((link) => link.id === id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [socialLinks]);

  const platformConfigs: Record<
    SocialPlatform,
    {
      icon: React.ReactNode;
      baseUrl: string;
      defaultLabel: string;
      color: string;
    }
  > = {
    Facebook: {
      icon: <Facebook className="h-4 w-4" style={{ color: "#1877F2" }} />,
      baseUrl: "https://facebook.com/",
      defaultLabel: "Facebook",
      color: "#1877F2",
    },
    Instagram: {
      icon: <Instagram className="h-4 w-4" style={{ color: "#E4405F" }} />,
      baseUrl: "https://instagram.com/",
      defaultLabel: "Instagram",
      color: "#E4405F",
    },
    X: {
      icon: <Share2 className="h-4 w-4" style={{ color: "#1DA1F2" }} />,
      baseUrl: "https://x.com/",
      defaultLabel: "Twitter",
      color: "#1DA1F2",
    },
    LinkedIn: {
      icon: <Share2 className="h-4 w-4" style={{ color: "#0077B5" }} />,
      baseUrl: "https://linkedin.com/",
      defaultLabel: "LinkedIn",
      color: "#0077B5",
    },
    YouTube: {
      icon: <Share2 className="h-4 w-4" style={{ color: "#FF0000" }} />,
      baseUrl: "https://youtube.com/",
      defaultLabel: "YouTube",
      color: "#FF0000",
    },
    TikTok: {
      icon: <Share2 className="h-4 w-4" style={{ color: "#000000" }} />,
      baseUrl: "https://tiktok.com/",
      defaultLabel: "TikTok",
      color: "#000000",
    },
    Pinterest: {
      icon: <Share2 className="h-4 w-4" style={{ color: "#BD081C" }} />,
      baseUrl: "https://pinterest.com/",
      defaultLabel: "Pinterest",
      color: "#BD081C",
    },
    Snapchat: {
      icon: <Share2 className="h-4 w-4" style={{ color: "#FFFC00" }} />,
      baseUrl: "https://snapchat.com/",
      defaultLabel: "Snapchat",
      color: "#FFFC00",
    },
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    updateSocialSettings({
      socialLinks: socialLinks.map((link) =>
        link.id === id ? { ...link, ...updates } : link
      ),
    });
  };

  const handleRemoveSocialLink = (id: string) => {
    updateSocialSettings({
      socialLinks: socialLinks.filter((link) => link.id !== id),
    });
  };

  const handlePlatformChange = (id: string, platform: SocialPlatform) => {
    const config = platformConfigs[platform];
    handleUpdateSocialLink(id, {
      platform,
      url: config.baseUrl,
      label: config.defaultLabel,
    });
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getPlatformDisplayName = (platform: SocialPlatform): string => {
    switch (platform) {
      case "X":
        return "Twitter";
      default:
        return platform;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-gray-900">
            Content
          </span>

          {socialLinks.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              No social links added yet
            </div>
          ) : (
            <div className="space-y-3">
              {socialLinks.map((link) => {
                const config = platformConfigs[link.platform];
                const isExpanded = expandedCards.has(link.id);

                return (
                  <div
                    key={link.id}
                    className="border border-gray-200 rounded-lg bg-white shadow-sm"
                  >
                    {/* Card Header */}
                    <div className="flex items-center px-4 py-3 border-b border-gray-100">
                      {/* Reorder Handle */}
                      <div className="flex items-center mr-3 cursor-move">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                      </div>

                      {/* Platform Name */}
                      <div className="flex-1 flex items-center gap-2">
                        <button
                          onClick={() => toggleCardExpansion(link.id)}
                          className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                          <span className="text-sm font-semibold text-gray-900">
                            {getPlatformDisplayName(link.platform)}
                          </span>
                        </button>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSocialLink(link.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        aria-label="Delete social link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Card Content */}
                    {isExpanded && (
                      <div className="px-4 py-4 space-y-4">
                        {/* Platform Selector */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Platform
                          </label>
                          <div className="relative">
                            <select
                              value={link.platform}
                              onChange={(e) =>
                                handlePlatformChange(
                                  link.id,
                                  e.target.value as SocialPlatform
                                )
                              }
                              className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent appearance-none bg-white"
                            >
                              {Object.keys(platformConfigs).map((platform) => (
                                <option
                                  key={platform}
                                  value={platform}
                                >
                                  {platform === "X"
                                    ? "Twitter"
                                    : platform}
                                </option>
                              ))}
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              {config.icon}
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        {/* Link Address Input */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Link address
                          </label>
                          <input
                            type="text"
                            value={link.url}
                            onChange={(e) =>
                              handleUpdateSocialLink(link.id, {
                                url: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
                            placeholder={config.baseUrl}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KlaviyoSocialLinksInspector;

