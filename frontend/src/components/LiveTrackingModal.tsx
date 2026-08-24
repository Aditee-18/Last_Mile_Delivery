import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Clock, MapPin, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { Order, OrderHistoryItem, OrderStatus } from '../types';
import { apiClient } from '../api/client';

interface LiveTrackingModalProps {
  trackingNumber: string;
  onClose: () => void;
}

export const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({ trackingNumber, onClose }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrackingData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await apiClient.get(`/orders/track/${trackingNumber}`);
        if (res.data.success) {
          setOrder(res.data.data.order);
          setTimeline(res.data.data.timeline);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch tracking details.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrackingData();
  }, [trackingNumber]);

  const stages: { key: OrderStatus; label: string }[] = [
    { key: OrderStatus.CREATED, label: 'Order Created' },
    { key: OrderStatus.ASSIGNED, label: 'Agent Assigned' },
    { key: OrderStatus.PICKED_UP, label: 'Picked Up' },
    { key: OrderStatus.IN_TRANSIT, label: 'In Transit' },
    { key: OrderStatus.OUT_FOR_DELIVERY, label: 'Out for Delivery' },
    { key: OrderStatus.DELIVERED, label: 'Delivered' },
  ];

  const getStageIndex = (status?: OrderStatus) => {
    if (!status) return 0;
    if (status === OrderStatus.FAILED) return -1;
    if (status === OrderStatus.RESCHEDULED) return 1;
    return stages.findIndex((s) => s.key === status);
  };

  const currentStageIndex = getStageIndex(order?.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6 border-b border-slate-800 pb-4">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Live Delivery Tracking</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Tracking Number: {trackingNumber}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium">Fetching live location & immutable history ledger...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <p className="font-semibold text-lg">{error}</p>
          </div>
        ) : order ? (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Current Status</p>
                <span className="inline-block mt-1 px-2.5 py-1 rounded-full font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Chargeable Weight</p>
                <p className="text-sm font-bold text-white mt-1">{order.chargeable_weight_kg} kg</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Order Type / Payment</p>
                <p className="text-sm font-bold text-white mt-1">{order.order_type} ({order.payment_type})</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Assigned Agent</p>
                <p className="text-sm font-bold text-white mt-1">{order.agent_name || 'Searching Agent...'}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-300 mb-4">Milestone Progress</h3>
              <div className="flex items-center justify-between relative px-2">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-1/2 z-0" />
                {stages.map((stage, idx) => {
                  const isCompleted = currentStageIndex >= idx;
                  const isCurrent = currentStageIndex === idx;
                  return (
                    <div key={stage.key} className="relative z-10 flex flex-col items-center group">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          isCompleted
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        } ${isCurrent ? 'ring-4 ring-blue-500/30 scale-110' : ''}`}
                      >
                        {isCompleted ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 mt-2 text-center max-w-[65px] truncate">
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Immutable History Audit Ledger</span>
              </h3>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {timeline.map((item) => (
                  <div key={item.id} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 text-xs flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-blue-400 uppercase">{item.new_status.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {item.actor_role}
                        </span>
                      </div>
                      {item.notes && <p className="text-slate-300 mt-1 italic">"{item.notes}"</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-4">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
