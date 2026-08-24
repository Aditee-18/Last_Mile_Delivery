import React, { useState } from 'react';
import { Package, Users, Truck, DollarSign, Search, ShieldCheck, ArrowRight } from 'lucide-react';

interface HeroBannerProps {
  metrics?: {
    totalOrders?: number;
    completed?: number;
    active?: number;
    totalCustomers?: number;
    availableAgents?: number;
    totalRevenue?: number;
  };
  onTrackOrder?: (trackingNumber: string) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ metrics, onTrackOrder }) => {
  const [trackingInput, setTrackingInput] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingInput.trim() && onTrackOrder) {
      onTrackOrder(trackingInput.trim());
    }
  };

  return (
    <div className="relative bg-slate-900 text-white overflow-hidden border-b border-slate-800">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/95 to-blue-950/80 z-10" />
      <img
        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80"
        alt="Logistics Delivery Network"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-25 mix-blend-overlay"
      />

      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 px-3.5 py-1.5 rounded-full text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Fast, Reliable & Real-Time Delivery Service</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Intelligent Last-Mile <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-400 bg-clip-text text-transparent">
              Delivery Management
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            Fast and secure parcel delivery across India with instant pricing quotes and live order tracking.
          </p>

          <form onSubmit={handleTrackSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Enter Tracking Number (e.g. TRK-...)"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center space-x-2 text-sm whitespace-nowrap"
            >
              <span>Track Live Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.completed ?? 0}</p>
              <p className="text-xs text-slate-400 font-medium">Completed Deliveries</p>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.active ?? 0}</p>
              <p className="text-xs text-slate-400 font-medium">Active Shipments</p>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.totalCustomers ?? 0}</p>
              <p className="text-xs text-slate-400 font-medium">Registered Customers</p>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">₹{metrics?.totalRevenue ? metrics.totalRevenue.toLocaleString() : '0'}</p>
              <p className="text-xs text-slate-400 font-medium">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
