import React, { useState, useEffect } from 'react';
import { Earth, Ellipsis, X, ChevronUp, Link, Facebook } from 'lucide-react';
import PreviewHeader from './PreviewHeader';
import PreviewExpandModal from '../PreviewExpandModal';

interface MediaFile {
  id: number;
  type: 'photo' | 'video';
  url?: string;
  thumbnail?: string;
  caption?: string;
}

interface FacebookStoriesPreviewProps {
  mediaToShow: MediaFile;
  primaryText: string;
  showHeaderOnHover?: boolean;
  scale?: 75 | 90 | 100;
}

const FacebookStoriesPreviewContent: React.FC<FacebookStoriesPreviewProps> = ({
  mediaToShow,
  primaryText,
}) => {
  const pageName = 'page name';
  const [progress, setProgress] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          setIsResetting(true);
          setTimeout(() => setIsResetting(false), 10);
          return 0;
        }
        return prevProgress + 1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div
        style={{ background: "linear-gradient(to top, #626262, #626262)" }}
        className="h-[613px] w-[307px] mt-4 relative rounded-sm group flex-1 overflow-hidden"
      >
        <div>
          {/* Progress Bar */}
          <div className="w-auto h-[1px] mt-1 mx-1 bg-gray-400">
            <div
              className={`h-full bg-gray-50 ${isResetting ? '' : 'transition-all duration-100 ease-linear'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center px-2 mb-2">
            <div className="w-8 h-8 pr-2 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full overflow-hidden">
                {mediaToShow.type == 'video' ? (
                  <video
                    src={mediaToShow.url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={mediaToShow.url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-50">{pageName}</p>
              <p className="text-xs text-gray-50 text-opacity-60 flex items-center justify-center">Sponsored ·&nbsp;<Earth className="inline-block w-3 h-3" /></p>
            </div>
            <div className="ml-auto flex items-center space-x-1 text-gray-50">
              <Ellipsis className="w-4 h-4" />
              <X className="w-4 h-4" />
            </div>
          </div>
          <div>
            {mediaToShow.type === 'video' ? (
              <video
                src={mediaToShow.url || mediaToShow.thumbnail}
                className="w-full aspect-square object-cover"
                controls
              />
            ) : (
              <img
                src={mediaToShow.url || mediaToShow.thumbnail}
                alt={mediaToShow.caption || 'Ad content'}
                className="w-full aspect-square object-cover"
              />
            )}
          </div>
          {primaryText && <div className="text-center mt-9 mb-6">
            <p className="text-sm text-gray-50">{primaryText}</p>
          </div>}
          <div className="flex items-center justify-center mb-1">
            <ChevronUp className="w-4 h-4 text-gray-50" />
          </div>
          <div className="flex items-center justify-center">
            <button className="bg-gray-50 rounded-md text-2xl p-2 cursor-text inline-flex items-center gap-2 text-[#0f757a]">
              <Link className="w-6 h-6" />
              Download
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const FacebookStoriesPreview: React.FC<FacebookStoriesPreviewProps> = ({
  mediaToShow,
  primaryText,
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
        title="Facebook Stories"
        icon={<Facebook />}
        isVisible={showHeaderOnHover ? isHovered : true}
        showDropdown={showDropdown}
        onToggleDropdown={() => setShowDropdown(!showDropdown)}
        onExpand={() => setIsModalOpen(true)}
        onReportProblem={() => console.log('Report Facebook Stories problem')}
      />
      <FacebookStoriesPreviewContent mediaToShow={mediaToShow} primaryText={primaryText} />
      <PreviewExpandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Facebook Stories"
      >
        <FacebookStoriesPreviewContent mediaToShow={mediaToShow} primaryText={primaryText} />
      </PreviewExpandModal>
    </div>
  );
};

export default FacebookStoriesPreview;
