import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { Order, AgentStatus, OrderStatus } from '../../types';
import { LiveTrackingModal } from '../../components/LiveTrackingModal';
import {
  Truck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Phone,
  Navigation,
  Clock,
  ShieldCheck,
  X,
  Package,
  Eye,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [taskFilter, setTaskFilter] = useState<'active' | 'completed' | 'failed'>('active');
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState<string | null>(null);

  const [currentStatus, setCurrentStatus] = useState<AgentStatus>(AgentStatus.AVAILABLE);
  const [selectedOrderForFailure, setSelectedOrderForFailure] = useState<Order | null>(null);
  const [failureReasonNotes, setFailureReasonNotes] = useState('Recipient unavailable at destination address.');

  useEffect(() => {
    fetchProfileAndAnalytics();
    fetchOrders();
  }, [taskFilter]);

  const fetchProfileAndAnalytics = async () => {
    try {
      const [profRes, analyticsRes] = await Promise.all([
        apiClient.get('/agent/profile'),
        apiClient.get('/agent/analytics'),
      ]);
      if (profRes.data.success) {
        setProfile(profRes.data.data.profile);
        setCurrentStatus(profRes.data.data.profile.status);
      }
      if (analyticsRes.data.success) {
        setAnalytics(analyticsRes.data.data);
      }
    } catch (err) {}
  };

  const fetchOrders = async () => {
    try {
      const res = await apiClient.get(`/agent/orders?filter=${taskFilter}`);
      if (res.data.success) setOrders(res.data.data);
    } catch (err) {}
  };

  const handleBroadcastGPS = async () => {
    const sendLocation = async (lat: number, lng: number) => {
      try {
        const res = await apiClient.put('/agent/location', {
          latitude: lat,
          longitude: lng,
          status: currentStatus,
        });
        if (res.data.success) {
          alert(`📍 GPS Location Broadcasted Successfully!\nLat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
          fetchProfileAndAnalytics();
        }
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to broadcast GPS location.');
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
        () => {
          const lat = profile?.current_lat ? Number(profile.current_lat) + 0.001 : 28.7041;
          const lng = profile?.current_lng ? Number(profile.current_lng) + 0.001 : 77.1025;
          sendLocation(lat, lng);
        }
      );
    } else {
      const lat = profile?.current_lat ? Number(profile.current_lat) + 0.001 : 28.7041;
      const lng = profile?.current_lng ? Number(profile.current_lng) + 0.001 : 77.1025;
      sendLocation(lat, lng);
    }
  };

  const handleUpdateStatusAndLocation = async (newStatus: AgentStatus) => {
    try {
      const lat = profile?.current_lat ? Number(profile.current_lat) + (Math.random() * 0.002 - 0.001) : 28.7041;
      const lng = profile?.current_lng ? Number(profile.current_lng) + (Math.random() * 0.002 - 0.001) : 77.1025;

      const res = await apiClient.put('/agent/location', {
        latitude: lat,
        longitude: lng,
        status: newStatus,
      });

      if (res.data.success) {
        setCurrentStatus(newStatus);
        fetchProfileAndAnalytics();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update location/status.');
    }
  };

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await apiClient.put(`/agent/orders/${orderId}/status`, {
        status: nextStatus,
        latitude: profile?.current_lat ? Number(profile.current_lat) : 28.7041,
        longitude: profile?.current_lng ? Number(profile.current_lng) : 77.1025,
        notes: `Agent milestone: ${nextStatus.replace(/_/g, ' ')}`,
      });

      if (res.data.success) {
        fetchOrders();
        fetchProfileAndAnalytics();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to advance status.');
    }
  };

  const handleReportFailureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForFailure) return;
    try {
      await apiClient.put(`/agent/orders/${selectedOrderForFailure.id}/fail`, {
        reasonNotes: failureReasonNotes,
        latitude: profile?.current_lat ? Number(profile.current_lat) : 28.7041,
        longitude: profile?.current_lng ? Number(profile.current_lng) : 77.1025,
      });
      alert('Delivery attempt flagged as FAILED. Customer notified to reschedule.');
      setSelectedOrderForFailure(null);
      fetchOrders();
      fetchProfileAndAnalytics();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to flag delivery failure.');
    }
  };

  const getNextStatus = (status: OrderStatus): OrderStatus | null => {
    switch (status) {
      case OrderStatus.ASSIGNED:
        return OrderStatus.PICKED_UP;
      case OrderStatus.PICKED_UP:
        return OrderStatus.IN_TRANSIT;
      case OrderStatus.IN_TRANSIT:
        return OrderStatus.OUT_FOR_DELIVERY;
      case OrderStatus.OUT_FOR_DELIVERY:
        return OrderStatus.DELIVERED;
      default:
        return null;
    }
  };

  const getNextStatusLabel = (status: OrderStatus): string => {
    switch (status) {
      case OrderStatus.ASSIGNED:
        return 'Mark Picked Up';
      case OrderStatus.PICKED_UP:
        return 'Mark In Transit';
      case OrderStatus.IN_TRANSIT:
        return 'Mark Out for Delivery';
      case OrderStatus.OUT_FOR_DELIVERY:
        return 'Mark Delivered';
      default:
        return 'Completed';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Agent-Focused Hero Header */}
      <div className="bg-slate-900 border-b border-slate-800 pt-8 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-full text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>Delivery Agent Operations Console</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Hello, {user?.name || 'Agent'} 
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Manage your assigned deliveries, update statuses, and keep every shipment moving efficiently.
              </p>
            </div>

            {/* Duty Availability Selector & GPS Broadcast */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
              <span className="text-xs font-semibold text-slate-400 pl-2 uppercase tracking-wider">Status:</span>
              <button
                onClick={() => handleUpdateStatusAndLocation(AgentStatus.AVAILABLE)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  currentStatus === AgentStatus.AVAILABLE
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AVAILABLE
              </button>
              <button
                onClick={() => handleUpdateStatusAndLocation(AgentStatus.BUSY)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  currentStatus === AgentStatus.BUSY
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUSY
              </button>
              <button
                onClick={() => handleUpdateStatusAndLocation(AgentStatus.OFFLINE)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  currentStatus === AgentStatus.OFFLINE
                    ? 'bg-slate-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                OFFLINE
              </button>

              <button
                onClick={handleBroadcastGPS}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
                title="Broadcast current GPS location"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>GPS</span>
              </button>
            </div>
          </div>

          {/* 4 Agent-Specific Operational Metric Cards */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.assignedActiveTasks ?? 0}</p>
                <p className="text-xs text-slate-400 font-medium">Assigned Orders</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.inTransit ?? 0}</p>
                <p className="text-xs text-slate-400 font-medium">In Transit</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.deliveredToday ?? 0}</p>
                <p className="text-xs text-slate-400 font-medium">Delivered Today</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex items-center space-x-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.failedTasksTotal ?? 0}</p>
                <p className="text-xs text-slate-400 font-medium">Failed Attempts</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Content: Task Queue */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
          <div>
            <h2 className="text-xl font-bold text-white">Today's Assigned Task Queue</h2>
            <p className="text-xs text-slate-400">View package details, contact customers, and advance order status milestones</p>
          </div>

          <div className="flex border-b border-slate-800 space-x-2">
            <button
              onClick={() => setTaskFilter('active')}
              className={`py-2 px-3 font-semibold text-xs rounded-xl transition-all ${
                taskFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Active Queue ({analytics?.assignedActiveTasks || 0})
            </button>
            <button
              onClick={() => setTaskFilter('completed')}
              className={`py-2 px-3 font-semibold text-xs rounded-xl transition-all ${
                taskFilter === 'completed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Completed ({analytics?.completedTasksTotal || 0})
            </button>
            <button
              onClick={() => setTaskFilter('failed')}
              className={`py-2 px-3 font-semibold text-xs rounded-xl transition-all ${
                taskFilter === 'failed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Failed ({analytics?.failedTasksTotal || 0})
            </button>
          </div>
        </div>

        {/* Empty State */}
        {orders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
            <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">No deliveries assigned in this view</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              New delivery tasks assigned to you by the dispatch system will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orders.map((o) => {
              const nextStat = getNextStatus(o.status);
              return (
                <div
                  key={o.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 relative flex flex-col justify-between hover:border-slate-700 transition-colors shadow-xl"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                      <span className="text-xs font-mono font-bold text-blue-400">{o.tracking_number}</span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <p className="text-slate-500 font-medium">Customer Information:</p>
                        <p className="font-bold text-white text-sm">{o.customer_name}</p>
                        <a
                          href={`tel:${o.customer_phone}`}
                          className="text-blue-400 hover:underline inline-flex items-center space-x-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{o.customer_phone}</span>
                        </a>
                      </div>

                      <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 space-y-1.5">
                        <p className="text-slate-300">📍 <strong>Pickup:</strong> {o.pickup_address}</p>
                        <p className="text-slate-300">🏁 <strong>Drop:</strong> {o.drop_address}</p>
                      </div>

                      <div className="flex justify-between text-slate-400 pt-1">
                        <span>
                          Weight: <strong className="text-white">{o.chargeable_weight_kg} kg</strong>
                        </span>
                        <span>
                          Payment: <strong className="text-emerald-400">{o.payment_type} (₹{o.total_charge})</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                    {/* View Details & Live Timeline Button */}
                    <button
                      onClick={() => setSelectedTrackingNumber(o.tracking_number)}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Timeline</span>
                    </button>

                    {taskFilter === 'active' && (
                      <>
                        {nextStat && (
                          <button
                            onClick={() => handleAdvanceStatus(o.id, nextStat)}
                            className="flex-1 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-lg hover:shadow-blue-500/20"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>{getNextStatusLabel(o.status)}</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedOrderForFailure(o)}
                          className="w-full sm:w-auto bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors"
                        >
                          Report Failure
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Failure Modal */}
      {selectedOrderForFailure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white relative">
            <button
              onClick={() => setSelectedOrderForFailure(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-2">Report Delivery Failure</h3>
            <p className="text-xs text-slate-400 mb-4">Flag failed attempt and notify customer to reschedule</p>

            <form onSubmit={handleReportFailureSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Failure Reason</label>
                <select
                  value={failureReasonNotes}
                  onChange={(e) => setFailureReasonNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Recipient unavailable at destination address.">Recipient Unavailable at Home</option>
                  <option value="Destination door locked / premises closed.">Destination Premises Closed</option>
                  <option value="Recipient refused delivery.">Customer Refused Delivery</option>
                  <option value="Incorrect or incomplete destination address provided.">Incorrect Address</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium">Additional Notes</label>
                <textarea
                  rows={3}
                  value={failureReasonNotes}
                  onChange={(e) => setFailureReasonNotes(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-500 font-bold py-3 rounded-xl text-xs transition-colors">
                Flag Failure & Reset Agent Availability
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assigned Order Live Tracking Timeline Modal */}
      {selectedTrackingNumber && (
        <LiveTrackingModal trackingNumber={selectedTrackingNumber} onClose={() => setSelectedTrackingNumber(null)} />
      )}
    </div>
  );
};
