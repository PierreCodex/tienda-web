import type { Product } from "@/lib/shopify/types";
import React from "react";
import "swiper/css";
import "swiper/css/pagination";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const HeroSlider = ({ products }: { products: Product[] }) => {
  return (
    <>
      <Swiper
        pagination={{
          clickable: true,
          bulletClass: "banner-pagination-bullet",
          bulletActiveClass: "banner-pagination-bullet-active",
        }}
        modules={[Pagination]}
      >
        {products?.map((item: Product) => (
          <SwiperSlide key={item.id}>
            <div className="row items-center px-4 xl:px-8 py-8">
              <div className="sm:col-12 lg:col-6 order-2 lg:order-0">
                <div className="text-center py-6 lg:py-0">
                  {item?.description && (
                    <p className="mb-2 lg:mb-2 text-text-light dark:text-darkmode-text-light font-medium text-base md:text-lg">
                      {item.description}
                    </p>
                  )}
                  <div className="row">
                    <h2 className="mb-3 lg:mb-6 col-10 sm:col-8 lg:col-12 mx-auto text-2xl md:text-3xl lg:text-4xl">
                      {item.title}
                    </h2>
                  </div>
                  {item.handle && (
                    <a
                      className="btn btn-sm md:btn-md btn-primary font-medium"
                      href={`products/${item.handle}`}
                    >
                      Ver Producto
                    </a>
                  )}
                </div>
              </div>

              <div className="sm:col-12 lg:col-6">
                {item.featuredImage && (
                  <div className="relative mx-auto w-[280px] h-[280px] lg:w-[350px] lg:h-[350px]">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl opacity-30"></div>
                    <img
                      src={item.featuredImage.url}
                      className="relative w-full h-full object-cover rounded-full shadow-2xl border-4 border-white/20"
                      width={"350"}
                      height={"350"}
                      alt={item.title}
                    />
                  </div>
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </>
  );
};

export default HeroSlider;
