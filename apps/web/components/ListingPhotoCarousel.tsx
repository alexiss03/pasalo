"use client";

import { useMemo, useState } from "react";

type ListingCarouselPhoto = {
  id: string;
  src: string;
  isPrimary?: boolean;
};

interface ListingPhotoCarouselProps {
  title: string;
  photos: ListingCarouselPhoto[];
}

export function ListingPhotoCarousel({ title, photos }: ListingPhotoCarouselProps) {
  const initialIndex = useMemo(() => {
    const primaryIndex = photos.findIndex((photo) => photo.isPrimary);
    return primaryIndex >= 0 ? primaryIndex : 0;
  }, [photos]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);

  if (photos.length === 0) {
    return null;
  }

  const activePhoto = photos[activeIndex] ?? photos[0];

  const movePrevious = () => {
    setActiveIndex((current) => (current === 0 ? photos.length - 1 : current - 1));
  };

  const moveNext = () => {
    setActiveIndex((current) => (current === photos.length - 1 ? 0 : current + 1));
  };

  return (
    <div className="detail-carousel">
      <div className="detail-carousel-main">
        <img
          alt={`${title} photo ${activeIndex + 1}`}
          className="detail-carousel-main-image"
          src={activePhoto.src}
        />
      </div>

      <div className="detail-carousel-toolbar">
        <p className="small">
          Photo {activeIndex + 1} of {photos.length}
        </p>
        <div className="detail-carousel-actions">
          <button className="ghost-button detail-carousel-button" onClick={movePrevious} type="button">
            Previous
          </button>
          <button className="ghost-button detail-carousel-button" onClick={moveNext} type="button">
            Next
          </button>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="detail-carousel-thumbs" role="tablist" aria-label="Listing photo thumbnails">
          {photos.map((photo, index) => (
            <button
              aria-label={`Show photo ${index + 1}`}
              className={`detail-carousel-thumb${index === activeIndex ? " active" : ""}`}
              key={photo.id}
              onClick={() => setActiveIndex(index)}
              role="tab"
              type="button"
            >
              <img alt="" src={photo.src} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
