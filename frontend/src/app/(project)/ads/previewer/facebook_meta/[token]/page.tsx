'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicPreview, AdCreativeData } from '@/lib/api/publicPreviewApi';
import { Loader2, AlertCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import FacebookFeedPreview from '@/components/facebook_meta/previews/FacebookFeedPreview';
import InstagramFeedPreview from '@/components/facebook_meta/previews/InstagramFeedPreview';
import FacebookProfileFeedsPreview from '@/components/facebook_meta/previews/FacebookProfileFeedsPreview';
import InstagramProfileFeedPreview from '@/components/facebook_meta/previews/InstagramProfileFeedPreview';
import FacebookStoriesPreview from '@/components/facebook_meta/previews/FacebookStoriesPreview';
import FacebookReelsPreview from '@/components/facebook_meta/previews/FacebookReelsPreview';
import InstagramReelsPreview from '@/components/facebook_meta/previews/InstagramReelsPreview';
import AdsOnFacebookReelsPreview from '@/components/facebook_meta/previews/AdsOnFacebookReelsPreview';
import FacebookMarketplacePreview from '@/components/facebook_meta/previews/FacebookMarketplacePreview';
import InstagramExplorePreview from '@/components/facebook_meta/previews/InstagramExplorePreview';

interface MediaFile {
    id: number;
    type: 'photo' | 'video';
    thumbnail?: string;
    caption?: string;
    url?: string;
}

export default function PublicPreviewPage() {
    const params = useParams();
    const token = params?.token as string;

    const [adCreative, setAdCreative] = useState<AdCreativeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPreviewData = async () => {
            if (!token) return;

            try {
                setLoading(true);

                // Fetch ad creative data (includes photo_data and video_data in object_story_spec)
                const adCreativeData = await getPublicPreview(token);
                setAdCreative(adCreativeData);

            } catch (err: any) {
                console.error('Error fetching preview:', err);
                setError(err.response?.data?.error || err.message || 'Failed to load preview');
            } finally {
                setLoading(false);
            }
        };

        fetchPreviewData();
    }, [token]);

    // Extract media from object_story_spec (photo_data and video_data)
    const getMediaFiles = (): MediaFile[] => {
        if (!adCreative?.object_story_spec) return [];

        const media: MediaFile[] = [];
        let idCounter = 1;

        // Extract photos from photo_data
        if (adCreative.object_story_spec.photo_data) {
            const photoData = Array.isArray(adCreative.object_story_spec.photo_data)
                ? adCreative.object_story_spec.photo_data
                : [adCreative.object_story_spec.photo_data];

            photoData.forEach((photo: any) => {
                if (photo) {
                    const photoUrl = photo.url?.startsWith('http')
                        ? photo.url
                        : photo.url?.startsWith('/')
                            ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${photo.url}`
                            : photo.url;

                    if (photoUrl) {
                        media.push({
                            id: idCounter++,
                            type: 'photo',
                            url: photoUrl,
                            caption: photo.caption || '',
                            thumbnail: photoUrl,
                        });
                    }
                }
            });
        }

        // Extract videos from video_data
        if (adCreative.object_story_spec.video_data) {
            const videoData = Array.isArray(adCreative.object_story_spec.video_data)
                ? adCreative.object_story_spec.video_data
                : [adCreative.object_story_spec.video_data];

            videoData.forEach((video: any) => {
                if (video) {
                    const videoUrl = (video.image_url || video.url)?.startsWith('http')
                        ? (video.image_url || video.url)
                        : (video.image_url || video.url)?.startsWith('/')
                            ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${video.image_url || video.url}`
                            : (video.image_url || video.url);

                    const thumbnailUrl = video.thumbnail?.startsWith('http')
                        ? video.thumbnail
                        : video.thumbnail?.startsWith('/')
                            ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${video.thumbnail}`
                            : video.thumbnail;

                    if (videoUrl) {
                        media.push({
                            id: idCounter++,
                            type: 'video',
                            url: videoUrl,
                            caption: video.caption || video.title || '',
                            thumbnail: thumbnailUrl || videoUrl,
                        });
                    }
                }
            });
        }

        return media;
    };

    // Extract primary text from object_story_spec
    const getPrimaryText = (): string => {
        if (!adCreative?.object_story_spec) return '';

        const spec = adCreative.object_story_spec;
        return spec.link_data?.message || spec.video_data?.message || '';
    };

    const renderLayout = (content: React.ReactNode) => (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                {content}
            </div>
        </Layout>
    );

    const mediaFiles = getMediaFiles();
    const primaryText = getPrimaryText();

    if (loading) {
        return renderLayout(
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading preview...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return renderLayout(
            <div className="flex items-center justify-center py-20">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Preview Not Available</h1>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <p className="text-sm text-gray-500">
                        This preview may have expired or the link is invalid.
                    </p>
                </div>
            </div>
        );
    }

    if (!adCreative || mediaFiles.length === 0) {
        return renderLayout(
            <div className="flex items-center justify-center py-20">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Preview Not Available</h1>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <p className="text-sm text-gray-500">
                        Add photos and videos to the ad creative to see the preview.
                    </p>
                </div>
            </div>
        );
    }

    return renderLayout(
        <div className="py-8">
            <div className="w-full px-4 sm:px-6 lg:px-8">
                 {/* Two Column Layout */}
                 <div className="flex gap-8">
                     {/* Left Column - Header and Preview Content */}
                     <div className="flex-1">
                         {/* Page Header */}
                         <div className="mb-8">
                             <div className="text-sm text-gray-500 mb-2">Preview for:</div>
                             <div className="text-xl font-bold mb-2">
                                 {adCreative.name}
                             </div>
                         </div>

                         {/* Preview Container */}
                         <div className="rounded-lg">
                             {mediaFiles.length > 0 && (
                                 <div>
                                     {/* Feeds Section */}
                                     <div>
                                         <h2 className="text-base font-semibold mb-[-30px]">Feeds</h2>
                                         <div className="grid grid-cols-4 gap-6 mb-[-30px] ml-[-40px]">
                                             <FacebookFeedPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                             <FacebookProfileFeedsPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                             <InstagramFeedPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                             <InstagramProfileFeedPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                         </div>
                                     </div>

                                     {/* Stories, status, reels Section */}
                                     <div>
                                         <h2 className="text-base font-semibold mb-[-30px]">Stories, status, reels
                                         </h2>
                                         <div className="grid grid-cols-4 gap-6 mb-[-30px] ml-[-40px]">
                                             <FacebookStoriesPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                             <FacebookReelsPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                             <InstagramReelsPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                         </div>
                                     </div>

                                     {/* In-stream ads for videos and reels Section */}
                                     <div>
                                         <h2 className="text-base font-semibold mb-[-30px]">In-stream ads for videos and reels</h2>
                                         <div className="grid grid-cols-4 gap-6 max-w-md mb-[-30px] ml-[-40px]">
                                             <AdsOnFacebookReelsPreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                         </div>
                                     </div>

                                     {/* Search results Section */}
                                     <div>
                                         <h2 className="text-base font-semibold mb-[-30px]">Search results</h2>
                                         <div className="grid grid-cols-4 gap-6 mb-[-30px] ml-[-40px]">
                                             <FacebookMarketplacePreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                             <InstagramExplorePreview
                                                 mediaToShow={mediaFiles[0]}
                                                 primaryText={primaryText}
                                                 showHeaderOnHover={false}
                                                 scale={75}
                                             />
                                         </div>
                                     </div>
                                 </div>
                             )}
                         </div>
                     </div>
                     
                     {/* Right Column - Expire Info */}
                     <div className="flex-shrink-0">
                         {adCreative.days_left !== undefined && (
                             <div className="bg-red-700 rounded-lg px-2 text-center">
                                 <div className="text-white font-bold text-xs">
                                     This link expires in {adCreative.days_left} {adCreative.days_left === 1 ? 'day' : 'days'}
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
            </div>
        </div>
    );
}

