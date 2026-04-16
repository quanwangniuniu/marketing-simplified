'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import { useGoogleAdsDesign } from '@/hooks/useGoogleAdsDesign';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DesignPageLayout from '@/components/google_ads/design/DesignPageLayout';
import ResponsiveSearchAdForm from '@/components/google_ads/design/ResponsiveSearchAdForm';
import ResponsiveDisplayAdForm from '@/components/google_ads/design/ResponsiveDisplayAdForm';
import VideoResponsiveAdForm from '@/components/google_ads/design/VideoResponsiveAdForm';
import AdPreviewPanel from '@/components/google_ads/preview/AdPreviewPanel';

function GoogleAdsDesignPageContent() {
  const { adId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { user, logout } = useAuth();
  const [videoAdValidation, setVideoAdValidation] = useState<{ isValid: boolean; errors: string[] }>({ isValid: false, errors: [] });
  const [formDataGetter, setFormDataGetter] = useState<(() => any) | null>(null);
  const [currentFormData, setCurrentFormData] = useState<any>(null);
  
  const { 
    ad, 
    loading, 
    saving, 
    error, 
    fetchAd, 
    updateAd, 
    saveAd, 
    publishAd,
    isComplete: isCompleteFn,
    completenessPercentage: completenessPercentageFn,
    missingFields: missingFieldsFn
  } = useGoogleAdsDesign();
  
  // Build local ad data that combines form data with backend ad (memoized for real-time updates)
  const localAdData = useMemo(() => {
    if (!ad) return null;
    
    console.log('useMemo triggered - currentFormData:', currentFormData);
    
    // If we have form data, merge it with the ad
    if (currentFormData && currentFormData.responsive_display_ad_data) {
      try {
        console.log('Merging form data with ad');
        const formData = currentFormData;
        console.log('Form data from state:', JSON.stringify(formData, null, 2));
        const localAd = JSON.parse(JSON.stringify(ad)); // Deep clone
        
        // For responsive display ads
        if (formData.responsive_display_ad_data && ad.responsive_display_ad) {
          const formDataObj = formData.responsive_display_ad_data;
          
          // Update text fields
          if (formDataObj.business_name) {
            localAd.responsive_display_ad.business_name = formDataObj.business_name;
          }
          if (formDataObj.call_to_action_text) {
            localAd.responsive_display_ad.call_to_action_text = formDataObj.call_to_action_text;
          }
          if (formDataObj.main_color) {
            localAd.responsive_display_ad.main_color = formDataObj.main_color;
          }
          if (formDataObj.accent_color) {
            localAd.responsive_display_ad.accent_color = formDataObj.accent_color;
          }
          
          // Update long headline
          if (formDataObj.long_headline_text && ad.responsive_display_ad.long_headline) {
            localAd.responsive_display_ad.long_headline = {
              ...ad.responsive_display_ad.long_headline,
              text: formDataObj.long_headline_text
            };
          }
          
          // Update headlines array
          if (formDataObj.headline_texts && Array.isArray(formDataObj.headline_texts)) {
            localAd.responsive_display_ad.headlines = formDataObj.headline_texts.map((text: string, idx: number) => {
              const existing = ad.responsive_display_ad?.headlines?.[idx];
              return {
                ...(existing || { id: idx, text: '' }),
                text: text
              };
            });
          }
          
          // Update descriptions array
          if (formDataObj.description_texts && Array.isArray(formDataObj.description_texts)) {
            localAd.responsive_display_ad.descriptions = formDataObj.description_texts.map((text: string, idx: number) => {
              const existing = ad.responsive_display_ad?.descriptions?.[idx];
              return {
                ...(existing || { id: idx, text: '' }),
                text: text
              };
            });
          }
          
          // Use media objects from formData if available (for preview)
          // Convert GoogleAdsPhotoData to AdImageAsset format (url -> asset mapping)
          if (formData.media) {
            // Helper function to convert photo data to AdImageAsset
            const convertPhotoToAsset = (photo: any) => {
              if (!photo) return null;
              const url = photo.url || photo.asset;
              const normalizedUrl = url?.startsWith('http') 
                ? url 
                : url?.startsWith('/') 
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`
                  : url;
              return {
                id: photo.id,
                asset: normalizedUrl || photo.asset || '',
                url: normalizedUrl,
                pixel_width: photo.pixel_width,
                pixel_height: photo.pixel_height,
                file_size_bytes: photo.file_size_bytes,
              };
            };

            // Helper function to convert video data to AdVideoAsset
            const convertVideoToAsset = (video: any) => {
              if (!video) return null;
              const imageUrl = video.image_url || video.url;
              const normalizedImageUrl = imageUrl?.startsWith('http')
                ? imageUrl
                : imageUrl?.startsWith('/')
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}${imageUrl}`
                  : imageUrl;
              return {
                id: video.id,
                asset: normalizedImageUrl || video.video_id || '',
                url: normalizedImageUrl,
                video_id: video.video_id,
              };
            };

            if (Array.isArray(formData.media.marketing_images)) {
              localAd.responsive_display_ad.marketing_images = formData.media.marketing_images
                .map(convertPhotoToAsset)
                .filter((item: any) => item !== null);
            }
            if (Array.isArray(formData.media.square_marketing_images)) {
              localAd.responsive_display_ad.square_marketing_images = formData.media.square_marketing_images
                .map(convertPhotoToAsset)
                .filter((item: any) => item !== null);
            }
            if (Array.isArray(formData.media.logo_images)) {
              localAd.responsive_display_ad.logo_images = formData.media.logo_images
                .map(convertPhotoToAsset)
                .filter((item: any) => item !== null);
            }
            if (Array.isArray(formData.media.square_logo_images)) {
              localAd.responsive_display_ad.square_logo_images = formData.media.square_logo_images
                .map(convertPhotoToAsset)
                .filter((item: any) => item !== null);
            }
            if (Array.isArray(formData.media.youtube_videos)) {
              localAd.responsive_display_ad.youtube_videos = formData.media.youtube_videos
                .map(convertVideoToAsset)
                .filter((item: any) => item !== null);
            }
          } else {
            // Fallback: Filter by IDs from backend
            if (Array.isArray(formDataObj.marketing_image_ids)) {
              localAd.responsive_display_ad.marketing_images = ad.responsive_display_ad.marketing_images?.filter(
                (img: any) => formDataObj.marketing_image_ids.includes(img.id)
              ) || [];
            }
            if (Array.isArray(formDataObj.square_marketing_image_ids)) {
              localAd.responsive_display_ad.square_marketing_images = ad.responsive_display_ad.square_marketing_images?.filter(
                (img: any) => formDataObj.square_marketing_image_ids.includes(img.id)
              ) || [];
            }
            if (Array.isArray(formDataObj.logo_image_ids)) {
              localAd.responsive_display_ad.logo_images = ad.responsive_display_ad.logo_images?.filter(
                (img: any) => formDataObj.logo_image_ids.includes(img.id)
              ) || [];
            }
            if (Array.isArray(formDataObj.square_logo_image_ids)) {
              localAd.responsive_display_ad.square_logo_images = ad.responsive_display_ad.square_logo_images?.filter(
                (img: any) => formDataObj.square_logo_image_ids.includes(img.id)
              ) || [];
            }
            if (Array.isArray(formDataObj.youtube_video_ids)) {
              localAd.responsive_display_ad.youtube_videos = ad.responsive_display_ad.youtube_videos?.filter(
                (video: any) => formDataObj.youtube_video_ids.includes(video.id)
              ) || [];
            }
          }
        }
        
        return localAd;
      } catch (err) {
        console.error('Error getting form data:', err);
        return ad;
      }
    }
    
    // Handle video responsive ads
    if (currentFormData && currentFormData.video_responsive_ad_data && ad.video_responsive_ad) {
      try {
        const formData = currentFormData;
        const localAd = JSON.parse(JSON.stringify(ad));
        const formDataObj = formData.video_responsive_ad_data;
        
        // Update video_responsive_ad fields
        if (formDataObj.long_headline_texts) {
          localAd.video_responsive_ad.long_headlines = formDataObj.long_headline_texts.map((text: string, idx: number) => {
            const existing = ad.video_responsive_ad?.long_headlines?.[idx];
            return {
              ...(existing || { id: idx, text: '' }),
              text: text
            };
          });
        }
        if (formDataObj.description_texts) {
          localAd.video_responsive_ad.descriptions = formDataObj.description_texts.map((text: string, idx: number) => {
            const existing = ad.video_responsive_ad?.descriptions?.[idx];
            return {
              ...(existing || { id: idx, text: '' }),
              text: text
            };
          });
        }
        
        // Use media from formData if available
        if (formData.media) {
          if (Array.isArray(formData.media.videos)) {
            localAd.video_responsive_ad.videos = formData.media.videos;
          }
          if (Array.isArray(formData.media.companion_banners)) {
            localAd.video_responsive_ad.companion_banners = formData.media.companion_banners;
          }
        }
        
        return localAd;
      } catch (err) {
        console.error('Error getting video form data:', err);
        return ad;
      }
    }
    
    return ad;
  }, [ad, currentFormData]);

  const layoutUser = user
    ? {
        name: user.username || 'User',
        email: user.email || '',
        role: user.roles?.[0] || 'user',
      }
    : undefined;

  const handleUserAction = async (action: string) => {
    if (action === 'settings') {
      router.push('/profile/settings');
    } else if (action === 'logout') {
      await logout();
    }
  };

  const handleVideoAdValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    setVideoAdValidation({ isValid, errors });
  }, []);
  
  const handleFormDataChange = useCallback((getFormData: () => any) => {
    // Store both the getter and invoke it to get current data
    setFormDataGetter(() => getFormData);
    try {
      const data = getFormData();
      setCurrentFormData(data);
      console.log('Form data updated:', data);
    } catch (err) {
      console.error('Error getting form data:', err);
    }
  }, []);

  useEffect(() => {
    if (adId) {
      fetchAd(parseInt(adId as string));
    }
  }, [adId, fetchAd]);

  const handleSave = async () => {
    try {
      await saveAd(formDataGetter || undefined);
      // Show success message or toast
    } catch (err) {
      console.error('Failed to save ad:', err);
    }
  };

  const handlePublish = async () => {
    try {
      await publishAd();
      // Redirect to ads list or show success message
      router.push('/google_ads');
    } catch (err) {
      console.error('Failed to publish ad:', err);
    }
  };

  const handleBack = () => {
    const safeReturnTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : '/google_ads';
    router.push(safeReturnTo);
  };

  if (loading) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading ad
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleBack}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Back to Ads
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!ad) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Ad not found</h1>
            <p className="mt-2 text-gray-600">The requested ad could not be found.</p>
            <button
              onClick={handleBack}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Back to Ads
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const renderAdForm = () => {
    switch (ad.type) {
      case 'RESPONSIVE_SEARCH_AD':
        return (
          <ResponsiveSearchAdForm
            ad={ad}
            onUpdate={updateAd}
            saving={saving}
          />
        );
      case 'RESPONSIVE_DISPLAY_AD':
        return (
          <ResponsiveDisplayAdForm
            ad={ad}
            onUpdate={updateAd}
            saving={saving}
            onFormDataChange={handleFormDataChange}
          />
        );
      case 'VIDEO_RESPONSIVE_AD':
        return (
          <VideoResponsiveAdForm
            ad={ad}
            onUpdate={updateAd}
            saving={saving}
            onValidationChange={handleVideoAdValidationChange}
            onFormDataChange={handleFormDataChange}
          />
        );
      default:
        return (
          <div className="p-6 text-center">
            <p className="text-gray-500">Unsupported ad type: {ad.type}</p>
          </div>
        );
    }
  };

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <DesignPageLayout
        ad={ad}
        completenessPercentage={(() => {
          const percentage = completenessPercentageFn(localAdData);
          console.log('Progress calculated:', percentage, 'for localAdData:', localAdData);
          return percentage;
        })()}
        isComplete={isCompleteFn(localAdData)}
        missingFields={missingFieldsFn(localAdData)}
        onSave={handleSave}
        onPublish={handlePublish}
        onBack={handleBack}
        saving={saving}
        videoAdValidation={videoAdValidation}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left side - Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {ad.name || 'Untitled Ad'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {ad.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              {renderAdForm()}
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              <AdPreviewPanel ad={localAdData || ad} />
            </div>
          </div>
        </div>
      </DesignPageLayout>
    </Layout>
  );
}

export default function GoogleAdsDesignPage() {
  return (
    <ProtectedRoute>
      <GoogleAdsDesignPageContent />
    </ProtectedRoute>
  );
}
