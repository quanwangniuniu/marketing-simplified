import React from 'react';

interface MediaFile {
  id: number;
  type: 'photo' | 'video';
  url?: string;
  thumbnail?: string;
  caption?: string;
}

interface FacebookVideoFeedsPreviewProps {
  mediaToShow: MediaFile;
}

const FacebookVideoFeedsPreview: React.FC<FacebookVideoFeedsPreviewProps> = ({ mediaToShow }) => {
  const profileImageUrl = 'https://scontent.fmel5-1.fna.fbcdn.net/v/t39.30808-1/556919477_774947058638775_2831962322869321570_n.jpg?stp=c420.0.1080.1080a_dst-jpg_s200x200_tt6&_nc_cat=103&ccb=1-7&_nc_sid=029d72&_nc_ohc=NbR323sazlIQ7kNvwGGdBP8&_nc_oc=AdmiTyFfOfri54PfwBbV5Gore0d1F4ymnAEA8IBAoRO66StdchxfXDODVvrzEDypStY&_nc_zt=24&_nc_ht=scontent.fmel5-1.fna&_nc_gid=eTfwRkSwikI570FlgVx3ZQ&oh=00_AfeVZbY3Bt05OX_aERbq2nMApHqz51XVri85dzkA-hU4xQ&oe=68ED0B52';

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center mb-3">
        <img
          src={profileImageUrl}
          alt="Profile"
          className="w-10 h-10 rounded-full mr-3"
        />
        <div>
          <p className="font-semibold text-gray-900">Asdda</p>
          <p className="text-xs text-gray-500">Sponsored · <img alt="Privacy" className="inline-block w-3 h-3" src="/images/mobile/privacy/wordmark/everyone.png" /></p>
        </div>
        <i className="ml-auto w-4 h-4 bg-gray-500" style={{ backgroundImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/ys/r/8iNp4rfqH7z.png")', backgroundPosition: '0px 0px', backgroundSize: '25px 740px', backgroundRepeat: 'no-repeat', display: 'inline-block' }}></i>
      </div>
      <p className="text-sm text-gray-900 mb-3">im am dumb</p>
      <div className="mb-3">
        {mediaToShow.type === 'video' ? (
          <div className="relative">
            <video
              src={mediaToShow.url || mediaToShow.thumbnail}
              className="w-full h-64 object-cover rounded-lg"
              controls
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-white bg-opacity-80 rounded-full flex items-center justify-center">
                <div className="w-0 h-0 border-l-[8px] border-l-blue-600 border-y-[6px] border-y-transparent ml-1"></div>
              </div>
            </div>
          </div>
        ) : (
          <img
            src={mediaToShow.url || mediaToShow.thumbnail}
            alt={mediaToShow.caption || 'Ad content'}
            className="w-full h-64 object-cover rounded-lg"
          />
        )}
      </div>
      <p className="text-xs text-gray-500 mb-1">AIDS resource centre</p>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-900">Asdda</p>
        <button className="bg-[#3CCED7] text-white py-2 px-4 rounded-lg text-sm font-medium">
          Download
        </button>
      </div>
      <div className="flex justify-around mt-4 border-t pt-3 text-gray-500 text-sm">
        <div className="flex items-center space-x-1">
          <i className="w-4 h-4 bg-gray-500" style={{ backgroundImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/yE/r/OjWysreHsvM.png")', backgroundPosition: '-35px -196px', backgroundSize: '73px 575px', backgroundRepeat: 'no-repeat', display: 'inline-block' }}></i>
          <span>Like</span>
        </div>
        <div className="flex items-center space-x-1">
          <i className="w-4 h-4 bg-gray-500" style={{ backgroundImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/yC/r/wmA8SkKUWBY.png")', backgroundPosition: '-76px -1778px', backgroundSize: '97px 2727px', backgroundRepeat: 'no-repeat', display: 'inline-block' }}></i>
          <span>Comment</span>
        </div>
        <div className="flex items-center space-x-1">
          <i className="w-4 h-4 bg-gray-500" style={{ backgroundImage: 'url("https://static.xx.fbcdn.net/rsrc.php/v4/yC/r/wmA8SkKUWBY.png")', backgroundPosition: '-76px -1835px', backgroundSize: '97px 2727px', backgroundRepeat: 'no-repeat', display: 'inline-block' }}></i>
          <span>Share</span>
        </div>
      </div>
    </div>
  );
};

export default FacebookVideoFeedsPreview;
