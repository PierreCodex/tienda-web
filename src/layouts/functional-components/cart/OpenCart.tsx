import React from "react";
import { BsCart3 } from "react-icons/bs";

interface OpenCartProps {
  className?: string;
  quantity?: number;
}

const OpenCart: React.FC<OpenCartProps> = ({ className = "", quantity }) => {
  return (
    <div className="relative text-2xl text-black hover:text-primary dark:text-white">
      <BsCart3 className={`${className}`} />

      {quantity ? (
        <div className="bg-black text-white dark:bg-white dark:text-black text-xs rounded-full p-1 absolute -top-1 md:-top-2 -right-3 md:-right-4 w-5 h-5 flex items-center justify-center">
          {quantity}
        </div>
      ) : null}
    </div>
  );
};

export default OpenCart;
