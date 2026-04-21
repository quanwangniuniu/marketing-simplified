import React from 'react';

interface MediaFile {
  id: number;
  type: 'photo' | 'video';
  url?: string;
  thumbnail?: string;
  caption?: string;
}

interface InstagramStoriesPreviewProps {
  mediaToShow: MediaFile;
  scale?: 75 | 90 | 100;
}

const InstagramStoriesPreview: React.FC<InstagramStoriesPreviewProps> = ({ 
  mediaToShow,
  scale = 75
}) => {
  const profileImageUrl = 'https://scontent.fmel5-1.fna.fbcdn.net/v/t39.30808-1/556919477_774947058638775_2831962322869321570_n.jpg?stp=c420.0.1080.1080a_dst-jpg_s200x200_tt6&_nc_cat=103&ccb=1-7&_nc_sid=029d72&_nc_ohc=NbR323sazlIQ7kNvwGGdBP8&_nc_oc=AdmiTyFfOfri54PfwBbV5Gore0d1F4ymnAEA8IBAoRO66StdchxfXDODVvrzEDypStY&_nc_zt=24&_nc_ht=scontent.fmel5-1.fna&_nc_gid=eTfwRkSwikI570FlgVx3ZQ&oh=00_AfeVZbY3Bt05OX_aERbq2nMApHqz51XVri85dzkA-hU4xQ&oe=68ED0B52';

  const getScaleClass = () => {
    if (scale === 75) return 'scale-75';
    if (scale === 90) return 'scale-90';
    return 'scale-100';
  };

  return (
    <div 
      className={`w-[307px] h-[613px] bg-white rounded-lg shadow-md p-4 relative overflow-hidden ${getScaleClass()}`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 to-transparent z-10"></div>
      {mediaToShow.type === 'video' ? (
        <video
          src={mediaToShow.url || mediaToShow.thumbnail}
          className="absolute inset-0 w-full h-full object-cover"
          controls
        />
      ) : (
        <img
          src={mediaToShow.url || mediaToShow.thumbnail}
          alt={mediaToShow.caption || 'Story content'}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex items-center">
        <img
          src={profileImageUrl}
          alt="Profile"
          className="w-8 h-8 rounded-full mr-3 border-2 border-white"
        />
        <p className="font-semibold text-white">Asdda</p>
        <div className="ml-auto w-1/3 h-1 bg-white/50 rounded-full">
          <div className="w-1/2 h-full bg-white rounded-full"></div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        <p className="text-white text-sm mb-3">im am dumb</p>
        <button className="w-full bg-[#3CCED7] text-white py-2 px-4 rounded-lg text-sm font-medium">
          Download
        </button>
      </div>
    </div>
  );
};

export default InstagramStoriesPreview;
