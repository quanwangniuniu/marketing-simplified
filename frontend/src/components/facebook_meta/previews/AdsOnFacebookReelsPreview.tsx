import React, { useState } from 'react';
import { ThumbsUp, X, MoreHorizontal, ChevronLeft, ChevronRight, Forward, MessageSquare, Facebook } from 'lucide-react';
import PreviewHeader from './PreviewHeader';
import PreviewExpandModal from '../PreviewExpandModal';

interface MediaFile {
  id: number;
  type: 'photo' | 'video';
  url?: string;
  thumbnail?: string;
  caption?: string;
}

interface AdsOnFacebookReelsPreviewProps {
  mediaToShow: MediaFile;
  primaryText?: string;
  showHeaderOnHover?: boolean;
  scale?: 75 | 90 | 100;
}

const AdsOnFacebookReelsPreviewContent: React.FC<AdsOnFacebookReelsPreviewProps> = ({
  mediaToShow,
  primaryText
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handlePrevious = () => {
    setCurrentSlide((prev) => (prev === 0 ? 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev === 1 ? 0 : prev + 1));
  };

  return (
    <>
      <div className="h-[613px] w-[307px] mt-4 relative bg-gray-200 rounded-sm group flex-1 overflow-hidden flex flex-col justify-center">
        <div className="flex flex-col px-2">
          {/* Placeholder Element */}
          <div className="p-2 bg-white">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <div className="h-2 bg-gray-200 rounded w-1/3"></div>
                <div className="h-2 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
            <div className="mt-1 h-2 bg-gray-200 rounded w-2/3"></div>
          </div>

          {/* Upper Video Section with Gray Background */}
          <div
            className="relative flex items-center justify-center bg-[#d3d3d3] w-full aspect-square">
            <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center border border-gray-50">
              <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1"></div>
            </div>
          </div>

          {/* Carousel Container */}
          <div className="relative flex flex-col items-center justify-center bg-white">
            <div className="relative w-full flex justify-center h-full pt-2">
              {/* Navigation Arrows */}
              <button onClick={handlePrevious} className="absolute left-[-5px] top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10 hover:text-gray-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNext} className="absolute right-[-5px] top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10 hover:text-gray-600">
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Main Ad Card */}
              <div className="w-full max-w-sm px-2">
                <div>
                  <div className="bg-gray-200 grid grid-cols-[auto_1fr_auto] gap-2">
                    {/* Left Section - Image */}
                    <div>
                      {mediaToShow.type === 'photo' ? (
                        <img
                          src={mediaToShow.url}
                          alt="Profile"
                          className="w-20 h-20 object-cover"
                        />
                      ) : (
                        <video
                          src={mediaToShow.url}
                          className="w-20 h-20 object-cover overflow-hidden"
                        />
                      )}
                    </div>

                    {/* Middle Section - Content */}
                    {currentSlide === 0 && (
                      <div className="flex flex-col justify-center">
                        <div>
                          <p className="font-bold text-black text-xs">{primaryText}</p>
                          <p className="text-xs text-gray-500">Asdda • Sponsored</p>
                        </div>
                      </div>
                    )}
                    {currentSlide === 1 && (
                      <div className="flex flex-col justify-center">
                        <div>
                          <p className="font-bold text-black text-xs">{primaryText}</p>
                          <p className="text-xs text-gray-500">Asdda • Sponsored</p>
                        </div>
                        {/* Download Button */}
                        <button className="bg-red-600 text-gray-50 py-2 px-3 rounded-lg text-xs font-medium w-full cursor-default">
                          Download
                        </button>
                      </div>

                    )}
                    {/* Right Section - Close and More Options */}
                    <div className="flex flex-col justify-between h-full">
                      <X className="w-4 h-4 text-gray-400" />
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  {/* Pagination Dots - Below the card */}
                  <div className="flex space-x-1 justify-center items-center py-1">
                    {[0, 1].map((_, index) => (
                      <div
                        key={index}
                        className={`w-1 h-1 rounded-full cursor-pointer ${index === currentSlide ? 'bg-[#3CCED7]' : 'bg-gray-400'
                          }`}
                        onClick={() => setCurrentSlide(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white border-t border-gray-100 pb-10">
            <div className="flex justify-around pt-2">
              <div className="flex items-center space-x-1">
                <ThumbsUp className="w-4 h-4" />
                <span className="text-xs font-semibold text-gray-700">Like</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-semibold text-gray-700">Comment</span>
              </div>
              <div className="flex items-center space-x-1">
                <Forward className="w-4 h-4" />
                <span className="text-xs font-semibold text-gray-700">Share</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const AdsOnFacebookReelsPreview: React.FC<AdsOnFacebookReelsPreviewProps> = ({
  mediaToShow,
  primaryText = '',
  showHeaderOnHover = false,
  scale = 75
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const getScaleClass = () => {
    if (scale === 75) return 'scale-75';
    if (scale === 90) return 'scale-90';
    return 'scale-100';
  };

  return (
    <div
      className={`w-[307px] h-[613px] flex flex-col ${getScaleClass()}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDropdown(false);
      }}
    >
      <PreviewHeader
        title="Ads on Facebook Reels"
        icon={<Facebook />}
        isVisible={showHeaderOnHover ? isHovered : true}
        showDropdown={showDropdown}
        onToggleDropdown={() => setShowDropdown(!showDropdown)}
        onExpand={() => setIsModalOpen(true)}
        onReportProblem={() => console.log('Report Ads on Facebook Reels problem')}
      />
      <AdsOnFacebookReelsPreviewContent mediaToShow={mediaToShow} primaryText={primaryText} />
      <PreviewExpandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Ads on Facebook Reels"
      >
        <AdsOnFacebookReelsPreviewContent mediaToShow={mediaToShow} primaryText={primaryText} />
      </PreviewExpandModal>
    </div>
  );
};

export default AdsOnFacebookReelsPreview;
