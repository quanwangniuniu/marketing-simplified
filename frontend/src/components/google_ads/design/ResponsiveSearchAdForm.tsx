'use client';

import React, { useState } from 'react';
import { GoogleAd } from '@/lib/api/googleAdsApi';

interface ResponsiveSearchAdFormProps {
  ad: GoogleAd;
  onUpdate: (data: any) => Promise<void>;
  saving: boolean;
}

export default function ResponsiveSearchAdForm({ 
  ad, 
  onUpdate, 
  saving 
}: ResponsiveSearchAdFormProps) {
  const [headlines, setHeadlines] = useState<string[]>(() => {
    const headlinesFromAd = ad.responsive_search_ad?.headlines?.map(h => h.text).filter(text => text.trim() !== '') || [];
    return headlinesFromAd.length > 0 ? headlinesFromAd : ['', '', ''];
  });
  const [descriptions, setDescriptions] = useState<string[]>(() => {
    const descriptionsFromAd = ad.responsive_search_ad?.descriptions?.map(d => d.text).filter(text => text.trim() !== '') || [];
    return descriptionsFromAd.length > 0 ? descriptionsFromAd : ['', ''];
  });
  const [path1, setPath1] = useState(ad.responsive_search_ad?.path1 || '');
  const [path2, setPath2] = useState(ad.responsive_search_ad?.path2 || '');

  const handleHeadlineChange = (index: number, value: string) => {
    const newHeadlines = [...headlines];
    newHeadlines[index] = value;
    setHeadlines(newHeadlines);
    handleUpdate(newHeadlines, descriptions, path1, path2);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    setDescriptions(newDescriptions);
    handleUpdate(headlines, newDescriptions, path1, path2);
  };

  const addHeadline = () => {
    if (headlines.length < 15) {
      setHeadlines([...headlines, '']);
    }
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > 3) {
      const newHeadlines = headlines.filter((_, i) => i !== index);
      setHeadlines(newHeadlines);
      handleUpdate(newHeadlines, descriptions, path1, path2);
    }
  };

  const addDescription = () => {
    if (descriptions.length < 4) {
      setDescriptions([...descriptions, '']);
    }
  };

  const removeDescription = (index: number) => {
    if (descriptions.length > 2) {
      const newDescriptions = descriptions.filter((_, i) => i !== index);
      setDescriptions(newDescriptions);
      handleUpdate(headlines, newDescriptions, path1, path2);
    }
  };

  const handleUpdate = async (headlinesToUse?: string[], descriptionsToUse?: string[], path1ToUse?: string, path2ToUse?: string) => {
    try {
      const currentHeadlines = headlinesToUse || headlines;
      const currentDescriptions = descriptionsToUse || descriptions;
      const currentPath1 = path1ToUse !== undefined ? path1ToUse : path1;
      const currentPath2 = path2ToUse !== undefined ? path2ToUse : path2;
      
      await onUpdate({
        responsive_search_ad_data: {
          headline_texts: currentHeadlines.length > 0 ? currentHeadlines : [''],
          description_texts: currentDescriptions.length > 0 ? currentDescriptions : [''],
          path1: currentPath1.trim(),
          path2: currentPath2.trim(),
        }
      });
    } catch (error) {
      console.error('Failed to update ad:', error);
    }
  };

  const getCharacterCountColor = (count: number, max: number) => {
    if (count > max) return 'text-red-500';
    if (count > max * 0.9) return 'text-yellow-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Headlines Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Headlines</h3>
          <div className="text-sm text-gray-500">
            {headlines.filter(h => h.trim() !== '').length}/15 headlines
          </div>
        </div>
        <div className="space-y-3">
          {headlines.map((headline, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => handleHeadlineChange(index, e.target.value)}
                  placeholder={`Headline ${index + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
                  maxLength={30}
                />
                <div className="flex justify-between items-center mt-1">
                  <div className={`text-xs ${getCharacterCountColor(headline.length, 30)}`}>
                    {headline.length}/30 characters
                  </div>
                  {headlines.length > 3 && (
                    <button
                      onClick={() => removeHeadline(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {headlines.length < 15 && (
          <button
            onClick={addHeadline}
            className="mt-3 text-[#3CCED7] hover:text-[#1a9ba3] text-sm font-medium"
          >
            + Add Headline
          </button>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Add 3-15 headlines. Google will automatically test different combinations.
        </p>
      </div>

      {/* Descriptions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Descriptions</h3>
          <div className="text-sm text-gray-500">
            {descriptions.filter(d => d.trim() !== '').length}/4 descriptions
          </div>
        </div>
        <div className="space-y-3">
          {descriptions.map((description, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-1">
                <textarea
                  value={description}
                  onChange={(e) => handleDescriptionChange(index, e.target.value)}
                  placeholder={`Description ${index + 1}`}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] resize-none"
                  maxLength={90}
                />
                <div className="flex justify-between items-center mt-1">
                  <div className={`text-xs ${getCharacterCountColor(description.length, 90)}`}>
                    {description.length}/90 characters
                  </div>
                  {descriptions.length > 2 && (
                    <button
                      onClick={() => removeDescription(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {descriptions.length < 4 && (
          <button
            onClick={addDescription}
            className="mt-3 text-[#3CCED7] hover:text-[#1a9ba3] text-sm font-medium"
          >
            + Add Description
          </button>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Add 2-4 descriptions. Google will automatically test different combinations.
        </p>
      </div>

      {/* Paths Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Paths (Optional)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Path 1
            </label>
            <input
              type="text"
              value={path1}
              onChange={(e) => {
                const newPath1 = e.target.value;
                setPath1(newPath1);
                handleUpdate(headlines, descriptions, newPath1, path2);
              }}
              placeholder="e.g., products"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              maxLength={15}
            />
            <div className={`text-xs mt-1 ${getCharacterCountColor(path1.length, 15)}`}>
              {path1.length}/15 characters
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Path 2
            </label>
            <input
              type="text"
              value={path2}
              onChange={(e) => {
                const newPath2 = e.target.value;
                setPath2(newPath2);
                handleUpdate(headlines, descriptions, path1, newPath2);
              }}
              placeholder="e.g., sale"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
              maxLength={15}
            />
            <div className={`text-xs mt-1 ${getCharacterCountColor(path2.length, 15)}`}>
              {path2.length}/15 characters
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Paths appear in your ad's URL. Path 2 can only be used if Path 1 is set.
        </p>
      </div>

      {/* Final URLs Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Final URLs</h3>
        <div className="space-y-2">
          {ad.final_urls?.map((url, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                {url}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          These URLs were set when creating the ad and cannot be changed here.
        </p>
      </div>
    </div>
  );
}
