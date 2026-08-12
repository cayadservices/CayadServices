import { useEffect, useRef, useState, memo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay, Pagination } from "swiper/modules";
import { Swiper as SwiperInstance } from 'swiper';
import part4 from '../../public/img/part4.webp'
import facebookReview2 from '../../public/img/facebookReview2.webp'
import santiago from '../../public/img/santiago.webp'
import moe from '../../public/img/moe.webp'
import hhrg from '../../public/img/hhrg.webp'
import kimmy from '../../public/img/kimmy.webp'
import jordan from '../../public/img/jordan.webp'
import jose from '../../public/img/jose.webp'
import abir from '../../public/img/abir.webp'


import 'swiper/css'
import '../styles/animate.css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { FaQuoteRight } from "react-icons/fa6";

// Preload cache to keep blobs/URLs in memory and avoid
// revalidations/re-fetch when Swiper clones slides or re-mounts nodes.
const PRELOADED = new Map<string, HTMLImageElement>();
const PRELOADED_BLOBS = new Map<string, string>(); // src -> objectURL

// Helper to get source string safely from potentially different import types
const getSrc = (img: any): string => {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (typeof img === 'object' && 'src' in img) return img.src;
  return '';
};

// Check if all needed images are already in blob cache
const areAllCached = (sources: string[]) => {
  return sources.every(s => PRELOADED_BLOBS.has(s));
};

const testimonials = [
  {
    name: "Moe Omar",
    image: moe,
    rating: 5,
    comment: "Awesome service, second time using the service",
    link: "https://www.google.com/maps/contrib/112079156209575097076/reviews?hl=en-GB",
    userImage: part4,
    altText: "Moe Omar",
    id: 0,
  },
  {
    name: "Hhrg Ramirez",
    image: hhrg,
    rating: 5,
    comment: "Muy profesional y excelente servicio hasta ahora el mejor servicio de transporte que he contratado. Recomiendo 100%,. Muy rápida y buena comunicación.",
    link: "https://www.facebook.com/permalink.php?story_fbid=1548929205689939&id=100017186221123&ref=embed_post",
    userImage: facebookReview2,
    altText: "Hhrg Ramirez",
    id: 2
  },
  {
    name: "Santiago Caceres",
    image: santiago,
    rating: 5,
    comment: "Alex G at Cayad Auto Transport was amazing to work with. He helps me ship a car from Utah to Idaho without problems and with fair price. I’d definitely be using their services again.",
    link: "https://www.google.com/maps/contrib/102787767697976243009/reviews/@36.8332502,-101.4969573,5z/data=!3m1!4b1!4m3!8m2!3m1!1e1?hl=en-GB&entry=ttu",
    userImage: part4,
    altText: "Santiago Caceres",
    id: 1
  },
  {
    name: "Kimmy Tennant",
    image: kimmy,
    rating: 5,
    comment: "very good company Lucas was on top of things and kept me updated on everything very good transportation company thanks again!!!",
    link: "https://www.facebook.com/kimmy.tennant/posts/10168525934190481?ref=embed_post",
    userImage: facebookReview2,
    altText: "Kimmy Tennant",
    id: 3
  },
  {
    name: "Jordan Allen",
    image: jordan,
    rating: 5,
    comment: "I've worked with AD for a couple years now, he's shipped 10 or so rigs for me. First time I was a little worried doing all this through messenger, but now he's my go to guy.",
    link: "https://www.google.com/maps/contrib/115116084854189813969/reviews/@37.0668996,-96.2086757,5z/data=!3m1!4b1!4m3!8m2!3m1!1e1?entry=ttu",
    userImage: part4,
    altText: "jordan allen",
    id: 4
  },
  {
    name: "Abir Khan",
    image: abir,
    rating: 5,
    comment: "11/10. Maiky was amazing in his communication and transparency. Car was delivered from IL to NY with no issues and they even provide live upates and location tracking! Would not hesitate to use their services again.",
    link: "https://www.facebook.com/adot.khan.7/posts/10232305783965435?ref=embed_post",
    userImage: facebookReview2,
    altText: "Abir Khan",
    id: 5
  },
  {
    name: "Jose Santiago",
    image: jose,
    rating: 5,
    comment: "Call  Leo Took care of me. They brought my vehicle to my house. The best service I ever have. These are the great people that you can trust on",
    link: "https://www.google.com/maps/contrib/105406262029060010977/reviews?hl=en-GB",
    userImage: part4,
    altText: "Jose Santiago",
    id: 6
  }
];

const renderStars = (rating: number) => {
  return (
    <div className="flex flex-row gap-0.5">
      {[...Array(rating)].map((_, index) => (
        <svg key={index} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400 drop-shadow-sm">
          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
        </svg>
      ))}
    </div>
  );
};

interface testimonialsType {
  title: string
  position?: string
}

const Testimonials = ({ title, position }: testimonialsType) => {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Collect all sources for this run
  const allSources = (() => {
    const s: string[] = [];
    testimonials.forEach(t => {
      const s1 = getSrc(t.image);
      const s2 = getSrc((t as any).userImage);
      if (s1) s.push(s1);
      if (s2) s.push(s2);
    });
    return s;
  })();

  // Initialize ready state to TRUE if we already have blobs. 
  // This avoids the 'init' -> 'loaded' flip on re-mounts.
  const [ready, setReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    return areAllCached(allSources);
  });

  // Preload all testimonial and badge images once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1) Keep classic Image() references
    allSources.forEach((src) => {
      if (!PRELOADED.has(src)) {
        const img = new Image();
        img.decoding = 'sync';
        img.src = src;
        PRELOADED.set(src, img);
      }
    });

    // 2) Fetch blobs
    const fetchBlobs = async () => {
      if (areAllCached(allSources)) {
        setReady(true);
        return;
      }

      await Promise.all(
        allSources.map(async (src) => {
          if (PRELOADED_BLOBS.has(src)) return;
          try {
            const res = await fetch(src, { cache: 'force-cache' });
            if (!res.ok) return;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            PRELOADED_BLOBS.set(src, objectUrl);
          } catch (e) {
            console.warn('Failed to preload blob for', src, e);
          }
        })
      );
      setReady(true);
    };

    fetchBlobs();
  }, []);

  const handleSlideChange = () => {
    if (swiperRef.current) {
      setActiveIndex(swiperRef.current.realIndex);
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto fadeInUp md:w-11/12 px-4" data-wow-delay="0.5s">
      {position === 'left'
        ? <h2 className="px-4 w-full mb-10 text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-slate-900 tracking-tight">
          {title}
        </h2>
        : <h2 className="text-center mb-10 text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-slate-900 tracking-tight">
          {title}
        </h2>
      }
      <Swiper
        // Key forces re-mount when blobs are ready, ensuring cloned slides use Blob URLs.
        // If ready started as true (cached), key is 'loaded' immediately, preventing flicker/reset.
        key={ready ? 'loaded' : 'init'}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        modules={[Pagination, A11y, Autoplay]}
        spaceBetween={20}
        centeredSlides={true}
        loop={true}
        slidesPerView={1}
        breakpoints={{
          640: {
            slidesPerView: 1,
            spaceBetween: 20,
          },
          768: {
            slidesPerView: 2,
            spaceBetween: 40,
          },
          1024: {
            slidesPerView: 3,
            spaceBetween: 40,
          },
        }}
        pagination={{ clickable: true }}
        autoplay={{ delay: 3000 }}
        onSlideChange={handleSlideChange}
        className="min-h-[320px] md:h-[350px] w-full px-2 sm:px-4 overflow-hidden"
      >
        {testimonials.map((testimonial, index) => {
          const imgSrc = getSrc(testimonial.image);
          const badgeSrc = getSrc((testimonial as any).userImage);
          return (
            <SwiperSlide key={testimonial.id}>
              <div className={`relative w-full box-border overflow-hidden cursor-pointer p-6 my-4 bg-white rounded-2xl transition-all duration-300 ${activeIndex === index ? 'shadow-card-hover scale-[1.02] ring-1 ring-blue-50' : 'shadow-card hover:shadow-card-hover hover:scale-[1.01]'}`}>
                <a href={testimonial.link} target="_blank" className="block h-full">
                  <FaQuoteRight className="text-blue-100/50 text-6xl absolute top-4 right-4 -z-0" />
                  <div className="w-full flex flex-row items-center gap-4 relative z-10 mb-4">
                    <div className="shrink-0">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={PRELOADED_BLOBS.get(imgSrc) ?? imgSrc}
                        width={50}
                        height={50}
                        className="object-cover rounded-full h-14 w-14 ring-2 ring-white shadow-md"
                        alt="img customer"
                      />
                    </div>
                    <div className="text-left flex-grow">
                      <h4 className="text-lg font-bold font-heading text-slate-900">
                        {testimonial.name}
                      </h4>
                      {renderStars(testimonial.rating)}
                    </div>
                    <div className="shrink-0">
                      <img
                        loading="lazy"
                        decoding="async"
                        src={PRELOADED_BLOBS.get(badgeSrc) ?? badgeSrc}
                        width={50}
                        height={50}
                        className="object-contain w-8 h-8 opacity-80"
                        alt="image google"
                      />
                    </div>
                  </div>
                  <div className="relative z-10 text-slate-600 font-sans leading-relaxed text-base italic">
                    "{testimonial.comment}"
                  </div>
                </a>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};

export default memo(Testimonials);
