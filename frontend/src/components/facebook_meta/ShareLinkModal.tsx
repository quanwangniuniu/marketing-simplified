    import React, { useState, useEffect, useRef } from 'react';
    import { createPortal } from 'react-dom';
    import { X, Trash2, ChevronDown, TriangleAlert, ExternalLink, Files, Loader2, Info } from 'lucide-react';
    import { createSharePreview, getSharePreview, deleteSharePreview, SharePreviewData } from '@/lib/api/sharePreviewApi';
    import { toast } from 'react-hot-toast';

    interface AdCreative {
        id: string;
        name?: string;
        // Add other AdCreative properties as needed
    }

    interface ShareLinkModalProps {
        isOpen: boolean;
        onClose: () => void;
        adCreative?: AdCreative;
        /** modal renders inside this element instead of document.body (e.g. for Storybook) */
        portalTarget?: HTMLElement | null;
    }

    const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
        isOpen,
        onClose,
        adCreative,
        portalTarget
    }) => {
        const [isLinkSharingOn, setIsLinkSharingOn] = useState(true);
        const [selectedDays, setSelectedDays] = useState<string>('');
        const [preview, setPreview] = useState<SharePreviewData | null>(null);
        const [showDaysDropdown, setShowDaysDropdown] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const dropdownRef = useRef<HTMLDivElement>(null);

        // Close dropdown when clicking outside
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                    setShowDaysDropdown(false);
                }
            };

            if (showDaysDropdown) {
                document.addEventListener('mousedown', handleClickOutside);
            }

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [showDaysDropdown]);

        const daysOptions = [
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
        ];

        // Load existing preview when modal opens
        useEffect(() => {
            if (isOpen && adCreative?.id) {
                loadExistingPreviews();
            }
        }, [isOpen, adCreative?.id]);

        const loadExistingPreviews = async () => {
            if (!adCreative?.id) return;

            try {
                setIsLoading(true);
                const preview = await getSharePreview(adCreative.id);
                if (preview.link) {
                    setPreview(preview);
                }
            } catch (error) {
                console.error('Error loading existing preview:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const handleDaysSelect = async (value: string) => {
            setSelectedDays(value);
            setShowDaysDropdown(false);

            // Create preview link when days are selected
            if (adCreative?.id && value) {
                try {
                    setIsLoading(true);
                    const preview = await createSharePreview(adCreative.id, {
                        days: parseInt(value),
                    });
                    setPreview(preview);
                } catch (error) {
                    console.error('Error creating share preview:', error);
                    toast.error('Failed to create preview link');
                } finally {
                    setIsLoading(false);
                }
            }
        };

        const handleCopyLink = () => {
            if (preview && preview.link) {
                navigator.clipboard.writeText(preview.link);
                // You could add a toast notification here
                toast.success('Link copied to clipboard');
            }
        };

        const handleDeleteLink = async () => {
            if (!adCreative?.id) return;

            try {
                setIsLoading(true);
                await deleteSharePreview(adCreative.id);
                setPreview(null);
                setSelectedDays('');
                toast.success('Preview link deleted successfully');
            } catch (error) {
                console.error('Error deleting share preview:', error);
                toast.error('Failed to delete preview link');
            } finally {
                setIsLoading(false);
            }
        };

        const handleExternalLink = (link: string) => {
            if (link) {
                window.open(link, '_blank');
            }
        };

        if (!isOpen) return null;

        const portalContainer = portalTarget ?? document.body;

        return createPortal(
            <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-hidden relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
                            <Loader2 className="w-8 h-8 animate-spin text-[#3CCED7]" />
                        </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between px-3 pt-2">
                        <div className="text-lg font-semibold text-gray-900">
                            Share preview of {adCreative?.name}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Description */}
                    <div className="text-sm pl-3 mr-14">
                        Give others access to this preview with a link. You can choose how many days the link will be active.
                    </div>

                    {/* Content */}
                    <div className="p-3 space-y-6">

                        {/* Warning box */}
                        <div className="border-l-4 border-[#d47b04] rounded-md p-4 shadow-md border-t border-t-gray-100">
                            <div className="flex items-start space-x-3">
                                <TriangleAlert className="w-5 h-5 text-[#b35401] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm">
                                        Sharing variation previews is not available. The preview that you share will only include your original creative.                                </p>
                                </div>
                            </div>
                        </div>

                        {/* Link Sharing Toggle */}
                        <div className="space-y-2">
                            <div className="flex items-start">
                                <button
                                    onClick={() => setIsLinkSharingOn(!isLinkSharingOn)}
                                    className={`relative mr-4 inline-flex h-6 w-11 items-center rounded-full transition-colors ${isLinkSharingOn ? 'bg-[#3CCED7]' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLinkSharingOn ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                                <label className="text-sm font-medium text-gray-900">
                                    Link sharing is {isLinkSharingOn ? 'on' : 'off'}
                                    <p className="text-xs text-gray-500">
                                        {isLinkSharingOn ? 'Anyone with this link can see a preview for ' + adCreative?.name + '.' : 'This link is disabled. No one can see this preview, even if they already have the link.'}
                                    </p>
                                </label>
                            </div>
                        </div>
                        {isLinkSharingOn && (
                            <div>
                                <div className='grid grid-cols-[10.3125rem_auto] items-center justify-stretch'>
                                    {/* Days Active */}
                                    <div className="space-y-2 mr-1">
                                        <label className="text-sm font-semibold">Days active</label>
                                        <div className="relative" ref={dropdownRef}>
                                            <button
                                                onClick={() => setShowDaysDropdown(!showDaysDropdown)}
                                                disabled={preview ? true : false}
                                                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-left text-sm text-gray-900 ${preview ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]'
                                                    }`}
                                            >
                                                {preview && preview.days_active ? daysOptions.find(opt => opt.value === preview.days_active.toString())?.label : selectedDays ? daysOptions.find(opt => opt.value === selectedDays)?.label : 'Select an option'}
                                                <ChevronDown className="w-4 h-4 float-right mt-0.5" />
                                            </button>

                                            {showDaysDropdown && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                                                    {daysOptions.map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => handleDaysSelect(option.value)}
                                                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 first:rounded-t-md last:rounded-b-md"
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Link */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold">Link</label>
                                        <div className="flex items-stretch">
                                            <div className="flex flex-1 items-stretch">
                                                <input
                                                    type="text"
                                                    value={preview && preview.link ? preview.link : ''}
                                                    placeholder="Select days active to create a link"
                                                    readOnly
                                                    disabled={!preview}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md text-sm text-gray-900 bg-gray-50"
                                                />
                                                <button
                                                    onClick={() => handleExternalLink(preview && preview.link ? preview.link : '')}
                                                    className={`px-3 text-gray-500 border border-l-0 border-gray-300 rounded-r-md flex items-center justify-center transition-colors ${!preview ? 'cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                                    title="External link"
                                                    disabled={!preview}
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {true && (
                                                <div className="flex items-stretch ml-2">
                                                    <button
                                                        onClick={handleDeleteLink}
                                                        className={`p-2 text-gray-500 transition-colors border border-gray-300 rounded-l-md ${!preview ? 'cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                                        title="Delete link"
                                                        disabled={!preview}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={handleCopyLink}
                                                        className={`p-2 text-gray-500 transition-colors border border-l-0 border-gray-300 rounded-r-md ${!preview ? 'cursor-not-allowed' : 'hover:bg-gray-100'}`}
                                                        disabled={!preview}
                                                        title="Copy link"
                                                    >
                                                        <Files className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Days left info alert - shown when days left is available */}
                                {preview && preview.days_left && (
                                <div className="pt-4">
                                    <div className="border-gray-300 border-l-4 border-t border-t-gray-100 rounded-md p-2 shadow-md">
                                        <div className="flex items-start space-x-3">
                                            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm">
                                                This link expires in {preview.days_left} days.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>  
                                )}
                            </div>  
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end p-6 my-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7] transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>,
            portalContainer
        );
    };

    export default ShareLinkModal;
